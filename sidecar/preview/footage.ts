import { type FileHandle, open } from "node:fs/promises";
import path from "node:path";
import { Data, Effect, Exit, Result } from "effect";
import { causeMessage, errorMessage } from "@/lib/error-message";
import { escapee } from "../contained";
import type { DesignFinding, OffthreadFootage } from "./design";
import { makeFinding } from "./readiness-analysis";
import type { ReadinessFinding } from "./readiness-contract";

export class FootageError extends Data.TaggedError("FootageError")<{
  readonly message: string;
}> {}

export type ReadRange = (
  start: number,
  end: number
) => Effect.Effect<Uint8Array, FootageError>;

export interface FrameTimes {
  readonly ticks: readonly number[];
  readonly timescale: number;
}

export interface SlotReport {
  readonly lateSlots: number;
  readonly maxLatenessMs: number;
  readonly slots: number;
}

export const NOT_MP4 = "The file is not MP4 or MOV.";
export const LATE_TOLERANCE_SECONDS = 0.001;
export const MAX_MOVIE_HEADER_BYTES = 64 * 1024 * 1024;

const HEADER = 16;
const UNIT_RATE = 0x1_00_00;
const GRID_EPSILON = 1e-6;
const DOUBLE_EPSILON = 1e-9;

interface Box {
  readonly end: number;
  readonly start: number;
  readonly type: string;
}

const footageError = (message: string) => new FootageError({ message });

function typeAt(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(
    bytes[at] ?? 0,
    bytes[at + 1] ?? 0,
    bytes[at + 2] ?? 0,
    bytes[at + 3] ?? 0
  );
}

function sizeOf(
  view: DataView,
  at: number,
  limit: number
): { header: number; size: number } | null {
  if (at + 8 > view.byteLength) {
    return null;
  }
  const small = view.getUint32(at);
  if (small === 1) {
    if (at + HEADER > view.byteLength) {
      return null;
    }
    return { header: HEADER, size: Number(view.getBigUint64(at + 8)) };
  }
  if (small === 0) {
    return { header: 8, size: limit - at };
  }
  return { header: 8, size: small };
}

function children(bytes: Uint8Array, from: number, to: number): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    const sized = sizeOf(view, at, to);
    if (sized === null || sized.size < sized.header || at + sized.size > to) {
      throw footageError("The file's movie header is truncated.");
    }
    boxes.push({
      end: at + sized.size,
      start: at + sized.header,
      type: typeAt(bytes, at + 4),
    });
    at += sized.size;
  }
  return boxes;
}

function child(bytes: Uint8Array, parent: Box, type: string): Box | undefined {
  return children(bytes, parent.start, parent.end).find(
    (box) => box.type === type
  );
}

function descend(
  bytes: Uint8Array,
  parent: Box,
  types: readonly string[]
): Box | undefined {
  let current: Box | undefined = parent;
  for (const type of types) {
    if (current === undefined) {
      return;
    }
    current = child(bytes, current, type);
  }
  return current;
}

function reader(bytes: Uint8Array, box: Box) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const guard = (at: number, width: number) => {
    if (at + width > box.end) {
      throw footageError("The file's movie header is truncated.");
    }
    return at;
  };
  return {
    i32: (at: number) => view.getInt32(guard(at, 4)),
    i64: (at: number) => Number(view.getBigInt64(guard(at, 8))),
    u8: (at: number) => view.getUint8(guard(at, 1)),
    u32: (at: number) => view.getUint32(guard(at, 4)),
    u64: (at: number) => Number(view.getBigUint64(guard(at, 8))),
  };
}

function timescaleOf(bytes: Uint8Array, box: Box): number {
  const read = reader(bytes, box);
  const version = read.u8(box.start);
  const timescale = read.u32(box.start + (version === 1 ? 20 : 12));
  if (timescale === 0) {
    throw footageError("The file declares a time scale of zero.");
  }
  return timescale;
}

function decodeTimes(bytes: Uint8Array, stts: Box): number[] {
  const read = reader(bytes, stts);
  const count = read.u32(stts.start + 4);
  const times: number[] = [];
  let time = 0;
  for (let entry = 0; entry < count; entry += 1) {
    const at = stts.start + 8 + entry * 8;
    const samples = read.u32(at);
    const delta = read.u32(at + 4);
    for (let sample = 0; sample < samples; sample += 1) {
      times.push(time);
      time += delta;
    }
  }
  return times;
}

function compositionOffsets(bytes: Uint8Array, ctts: Box): number[] {
  const read = reader(bytes, ctts);
  const version = read.u8(ctts.start);
  const count = read.u32(ctts.start + 4);
  const offsets: number[] = [];
  for (let entry = 0; entry < count; entry += 1) {
    const at = ctts.start + 8 + entry * 8;
    const samples = read.u32(at);
    const offset = version === 1 ? read.i32(at + 4) : read.u32(at + 4);
    for (let sample = 0; sample < samples; sample += 1) {
      offsets.push(offset);
    }
  }
  return offsets;
}

interface Edit {
  readonly duration: number;
  readonly mediaTime: number;
  readonly rate: number;
}

function edits(bytes: Uint8Array, elst: Box): Edit[] {
  const read = reader(bytes, elst);
  const version = read.u8(elst.start);
  const count = read.u32(elst.start + 4);
  const width = version === 1 ? 20 : 12;
  const list: Edit[] = [];
  for (let entry = 0; entry < count; entry += 1) {
    const at = elst.start + 8 + entry * width;
    list.push(
      version === 1
        ? {
            duration: read.u64(at),
            mediaTime: read.i64(at + 8),
            rate: read.u32(at + 16),
          }
        : {
            duration: read.u32(at),
            mediaTime: read.i32(at + 4),
            rate: read.u32(at + 8),
          }
    );
  }
  return list;
}

function shiftOf(
  list: readonly Edit[],
  mediaScale: number,
  movieScale: number
): number {
  if (list.some((edit) => edit.rate !== UNIT_RATE)) {
    throw footageError("The file's edit list changes the playback rate.");
  }
  const [first, second] = list;
  if (list.length === 1 && first && first.mediaTime >= 0) {
    return -first.mediaTime;
  }
  if (
    list.length === 2 &&
    first &&
    second &&
    first.mediaTime === -1 &&
    second.mediaTime >= 0
  ) {
    return (first.duration * mediaScale) / movieScale - second.mediaTime;
  }
  throw footageError(
    "The file's edit list has a shape the studio does not model."
  );
}

function videoTrack(bytes: Uint8Array, moov: Box): Box {
  for (const trak of children(bytes, moov.start, moov.end)) {
    if (trak.type !== "trak") {
      continue;
    }
    const hdlr = descend(bytes, trak, ["mdia", "hdlr"]);
    if (hdlr && typeAt(bytes, hdlr.start + 8) === "vide") {
      return trak;
    }
  }
  throw footageError("The file has no video track.");
}

export function frameTimesFromMovie(bytes: Uint8Array): FrameTimes {
  const moov: Box = { end: bytes.byteLength, start: 0, type: "moov" };
  const mvhd = child(bytes, moov, "mvhd");
  const trak = videoTrack(bytes, moov);
  const mdhd = descend(bytes, trak, ["mdia", "mdhd"]);
  const stbl = descend(bytes, trak, ["mdia", "minf", "stbl"]);
  const stts = stbl && child(bytes, stbl, "stts");
  if (!(mvhd && mdhd && stts)) {
    throw footageError("The file's video track has no frame table.");
  }
  const timescale = timescaleOf(bytes, mdhd);
  const decoded = decodeTimes(bytes, stts);
  const ctts = stbl && child(bytes, stbl, "ctts");
  const offsets = ctts ? compositionOffsets(bytes, ctts) : null;
  if (offsets && offsets.length !== decoded.length) {
    throw footageError(
      "The file's frame table and its reorder table disagree."
    );
  }
  const elst = descend(bytes, trak, ["edts", "elst"]);
  const shift = elst
    ? shiftOf(edits(bytes, elst), timescale, timescaleOf(bytes, mvhd))
    : 0;
  const ticks = decoded
    .map((time, index) => time + (offsets?.[index] ?? 0) + shift)
    .sort((left, right) => left - right);
  if (ticks.length === 0) {
    throw footageError("The file's video track has no frames.");
  }
  return { ticks, timescale };
}

export function readFrameTimes(
  read: ReadRange,
  size: number
): Effect.Effect<FrameTimes, FootageError> {
  return Effect.gen(function* () {
    let at = 0;
    while (at + 8 <= size) {
      const head = yield* read(at, Math.min(size, at + HEADER));
      const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
      const sized = sizeOf(view, 0, size - at);
      if (
        sized === null ||
        sized.size < sized.header ||
        at + sized.size > size
      ) {
        return yield* Effect.fail(
          footageError(
            at === 0 ? NOT_MP4 : "The file's box structure is truncated."
          )
        );
      }
      if (typeAt(head, 4) === "moov") {
        if (sized.size > MAX_MOVIE_HEADER_BYTES) {
          return yield* Effect.fail(
            footageError("The file's movie header is too large to read.")
          );
        }
        const movie = yield* read(at + sized.header, at + sized.size);
        return yield* Effect.try({
          catch: (cause) =>
            cause instanceof FootageError
              ? cause
              : footageError(errorMessage(cause)),
          try: () => frameTimesFromMovie(movie),
        });
      }
      at += sized.size;
    }
    return yield* Effect.fail(footageError(NOT_MP4));
  });
}

const UNREADABLE = "The file could not be read.";

function rangeOf(handle: FileHandle): ReadRange {
  return (start, end) =>
    Effect.tryPromise({
      catch: () => footageError(UNREADABLE),
      try: async () => {
        const bytes = new Uint8Array(end - start);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, start);
        return bytes.subarray(0, bytesRead);
      },
    });
}

export function frameTimesOf(
  file: string
): Effect.Effect<FrameTimes, FootageError> {
  return Effect.acquireUseRelease(
    Effect.tryPromise({
      catch: () => footageError(UNREADABLE),
      try: () => open(file, "r"),
    }),
    (handle) =>
      Effect.gen(function* () {
        const { size } = yield* Effect.tryPromise({
          catch: () => footageError(UNREADABLE),
          try: () => handle.stat(),
        });
        return yield* readFrameTimes(rangeOf(handle), size);
      }),
    (handle) => Effect.promise(() => handle.close())
  );
}

export function lateSlots(input: {
  readonly fps: number;
  readonly ticks: readonly number[];
  readonly timescale: number;
}): SlotReport {
  const { fps, ticks, timescale } = input;
  const late = new Map<number, number>();
  const whole = Number.isInteger(fps);
  for (const tick of ticks) {
    if (whole && Number.isInteger(tick)) {
      const scaled = tick * fps;
      const slot = Math.floor(scaled / timescale);
      const remainder = scaled - slot * timescale;
      if (
        remainder > 0 &&
        remainder <= LATE_TOLERANCE_SECONDS * timescale * fps
      ) {
        late.set(slot, (remainder * 1000) / (fps * timescale));
      }
      continue;
    }
    const seconds = tick / timescale;
    const slot = Math.floor(seconds * fps + DOUBLE_EPSILON);
    const lateness = seconds - slot / fps;
    if (
      lateness > DOUBLE_EPSILON &&
      lateness <= LATE_TOLERANCE_SECONDS + DOUBLE_EPSILON
    ) {
      late.set(slot, lateness * 1000);
    }
  }
  const first = ticks[0] ?? 0;
  const last = ticks.at(-1) ?? 0;
  const slots =
    Math.floor((last / timescale) * fps + DOUBLE_EPSILON) -
    Math.ceil((first / timescale) * fps - DOUBLE_EPSILON) +
    1;
  return {
    lateSlots: late.size,
    maxLatenessMs: Math.max(0, ...late.values()),
    slots: Math.max(0, slots),
  };
}

export function onGrid(times: readonly number[], fps: number): boolean {
  return times.every(
    (time) => Math.abs(time * fps - Math.round(time * fps)) <= GRID_EPSILON
  );
}

export const NOT_IN_PROJECT = "It is not a file in this project.";
export const OTHER_SPEED =
  "It plays at another speed, which the check does not model.";

export function footageFile(input: {
  readonly publicDir: string;
  readonly serveUrl: string;
  readonly src: string;
  readonly staticBase: string;
}): Effect.Effect<string, FootageError> {
  return Effect.gen(function* () {
    const url = yield* Effect.try({
      catch: () => footageError(NOT_IN_PROJECT),
      try: () => new URL(input.src),
    });
    const origin = yield* Effect.try({
      catch: () => footageError(NOT_IN_PROJECT),
      try: () => new URL(input.serveUrl).origin,
    });
    const prefix = `${input.staticBase}/`;
    if (url.origin !== origin || !url.pathname.startsWith(prefix)) {
      return yield* Effect.fail(footageError(NOT_IN_PROJECT));
    }
    const relative = yield* Effect.try({
      catch: () => footageError(NOT_IN_PROJECT),
      try: () => decodeURIComponent(url.pathname.slice(prefix.length)),
    });
    const file = path.join(input.publicDir, relative);
    const outside = yield* Effect.tryPromise({
      catch: () => footageError(NOT_IN_PROJECT),
      try: () => escapee(input.publicDir, [], [file]),
    });
    if (outside !== null) {
      return yield* Effect.fail(footageError(NOT_IN_PROJECT));
    }
    return file;
  });
}

export interface FootageSighting {
  readonly footage?: readonly OffthreadFootage[];
  readonly frame: number;
}

export type FootageOutcome =
  | {
      readonly file: string;
      readonly frames: readonly number[];
      readonly kind: "late";
      readonly report: SlotReport;
    }
  | {
      readonly file: string;
      readonly frames: readonly number[];
      readonly kind: "clean";
    }
  | {
      readonly file: string;
      readonly frames: readonly number[];
      readonly kind: "unmeasured";
      readonly reason: string;
    };

interface Sighted {
  readonly frames: Set<number>;
  readonly src: string;
  readonly times: number[];
}

export interface FootageMeasurement {
  readonly fps: number;
  readonly publicDir: string;
  readonly root: string;
  readonly serveUrl: string;
  readonly sightings: readonly FootageSighting[];
  readonly staticBase: string;
}

function sighted(sightings: readonly FootageSighting[]): Sighted[] {
  const bySource = new Map<string, Sighted>();
  for (const { footage, frame } of sightings) {
    for (const { src, time } of footage ?? []) {
      const entry = bySource.get(src) ?? {
        frames: new Set<number>(),
        src,
        times: [],
      };
      entry.frames.add(frame);
      entry.times.push(time);
      bySource.set(src, entry);
    }
  }
  return [...bySource.values()];
}

function outcomeOf(
  input: FootageMeasurement,
  entry: Sighted,
  readTimes: (file: string) => Effect.Effect<FrameTimes, FootageError>
): Effect.Effect<FootageOutcome> {
  return Effect.gen(function* () {
    const frames = [...entry.frames].sort((left, right) => left - right);
    const unmeasured = (named: string, reason: string): FootageOutcome => ({
      file: named,
      frames,
      kind: "unmeasured",
      reason,
    });
    const located = yield* Effect.result(
      footageFile({ ...input, src: entry.src })
    );
    if (Result.isFailure(located)) {
      return unmeasured(entry.src, located.failure.message);
    }
    const file = path
      .relative(input.root, located.success)
      .split(path.sep)
      .join("/");
    if (!onGrid(entry.times, input.fps)) {
      return unmeasured(file, OTHER_SPEED);
    }
    const read = yield* Effect.result(readTimes(located.success));
    if (Result.isFailure(read)) {
      return unmeasured(file, read.failure.message);
    }
    const report = lateSlots({ fps: input.fps, ...read.success });
    return report.lateSlots > 0
      ? { file, frames, kind: "late", report }
      : { file, frames, kind: "clean" };
  });
}

export function measureFootage(
  input: FootageMeasurement,
  readTimes: (
    file: string
  ) => Effect.Effect<FrameTimes, FootageError> = frameTimesOf
): Effect.Effect<FootageOutcome[]> {
  return Effect.forEach(sighted(input.sightings), (entry) =>
    outcomeOf(input, entry, readTimes)
  );
}

const milliseconds = (value: number) => `${Math.round(value * 100) / 100} ms`;

export const FOOTAGE_FIX =
  "Embed this clip with <Video> from @remotion/media, which accepts a frame that starts within a millisecond of the time it is asked for. Switch the component; do not rewrite the file.";

export function lateMessage(
  outcome: Extract<FootageOutcome, { kind: "late" }>
): string {
  const { lateSlots: late, maxLatenessMs, slots } = outcome.report;
  return `${outcome.file}: ${late} of ${slots} frame slots start up to ${milliseconds(maxLatenessMs)} after the moment OffthreadVideo asks for them, so the export shows the previous frame again there and then skips one.`;
}

export function unmeasuredMessage(
  outcome: Extract<FootageOutcome, { kind: "unmeasured" }>
): string {
  return `${outcome.file} could not be checked for late frames. ${outcome.reason}`;
}

export const LATE_EXPECTED =
  "Every frame of the clip starts on or before its frame slot.";

export function lateObserved(
  outcome: Extract<FootageOutcome, { kind: "late" }>
): string {
  const { lateSlots: late, maxLatenessMs, slots } = outcome.report;
  return `${late} of ${slots} slots late by up to ${milliseconds(maxLatenessMs)}.`;
}

export const UNMEASURED_EXPECTED =
  "A local MP4 or MOV file from the project, played at normal speed.";

export const UNMEASURED_FIX =
  "Nothing to change for this check. Watch the exported clip for a repeated then skipped frame.";

export function footageDesignFindings(
  outcomes: readonly FootageOutcome[]
): DesignFinding[] {
  return outcomes.flatMap((outcome): DesignFinding[] => {
    if (outcome.kind === "late") {
      return [
        {
          bbox: null,
          code: "footage_late_frames",
          expected: LATE_EXPECTED,
          fix: FOOTAGE_FIX,
          frames: [...outcome.frames],
          message: lateMessage(outcome),
          observed: lateObserved(outcome),
          selector: outcome.file,
          severity: "warning",
          text: null,
        },
      ];
    }
    if (outcome.kind === "unmeasured") {
      return [
        {
          bbox: null,
          code: "footage_unmeasured",
          expected: UNMEASURED_EXPECTED,
          fix: UNMEASURED_FIX,
          frames: [...outcome.frames],
          message: unmeasuredMessage(outcome),
          observed: outcome.reason,
          selector: outcome.file,
          severity: "info",
          text: null,
        },
      ];
    }
    return [];
  });
}

export const FOOTAGE_CONFIDENCE =
  "Measured from the file's own frame times against OffthreadVideo's exact-time frame lookup, as observed on Remotion 4.0.520.";

export interface FootageReadiness {
  readonly findings: readonly ReadinessFinding[];
  readonly reason: string;
  readonly status: "completed" | "not_applicable" | "skipped";
}

export function footageReadiness(
  outcomes: readonly FootageOutcome[]
): FootageReadiness {
  const findings = outcomes.flatMap((outcome) =>
    outcome.kind === "late"
      ? [
          makeFinding({
            category: "footage",
            code: "footage_late_frames",
            conclusion: "measurement",
            confidence: FOOTAGE_CONFIDENCE,
            expected: LATE_EXPECTED,
            fix: FOOTAGE_FIX,
            frames: [...outcome.frames],
            from: outcome.frames[0] ?? 0,
            measurements: {
              lateSlots: outcome.report.lateSlots,
              maxLatenessMs: outcome.report.maxLatenessMs,
              slots: outcome.report.slots,
            },
            message: lateMessage(outcome),
            observed: lateObserved(outcome),
            selector: outcome.file,
            severity: "warning",
            to: (outcome.frames.at(-1) ?? 0) + 1,
          }),
        ]
      : []
  );
  if (outcomes.length === 0) {
    return {
      findings,
      reason: "No inspected frame showed footage through OffthreadVideo.",
      status: "not_applicable",
    };
  }
  const unmeasured = outcomes.flatMap((outcome) =>
    outcome.kind === "unmeasured" ? [unmeasuredMessage(outcome)] : []
  );
  if (unmeasured.length > 0) {
    return { findings, reason: unmeasured.join(" "), status: "skipped" };
  }
  return {
    findings,
    reason: `Measured ${outcomes.length} ${outcomes.length === 1 ? "clip" : "clips"} shown through OffthreadVideo.`,
    status: "completed",
  };
}

export interface FootageRule {
  readonly findings: readonly ReadinessFinding[];
  readonly reason: string;
  readonly status: FootageReadiness["status"] | "failed";
}

export async function footageRule(
  measured: Effect.Effect<FootageOutcome[]>
): Promise<FootageRule> {
  const exit = await Effect.runPromiseExit(measured);
  if (Exit.isSuccess(exit)) {
    return footageReadiness(exit.value);
  }
  return {
    findings: [],
    reason: `Footage timing could not be measured: ${causeMessage(exit.cause) ?? "the check was interrupted"}.`,
    status: "failed",
  };
}
