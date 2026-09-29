import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { $, which } from "bun";
import { Effect, Exit } from "effect";
import millisecondClock from "@/test/fixtures/footage/millisecond-clock.json";
import {
  FOOTAGE_FIX,
  FootageError,
  type FrameTimes,
  footageDesignFindings,
  footageFile,
  frameTimesOf,
  lateSlots,
  measureFootage,
  NOT_IN_PROJECT,
  NOT_MP4,
  OTHER_SPEED,
  onGrid,
  type ReadRange,
  readFrameTimes,
} from "./footage";

const encoder = new TextEncoder();

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function i32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value);
  return bytes;
}

function u64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value));
  return bytes;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload);
  return concat([u32(body.length + 8), encoder.encode(type), body]);
}

function wideBox(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(payload);
  return concat([u32(1), encoder.encode(type), u64(body.length + 16), body]);
}

function full(type: string, version: number, ...payload: Uint8Array[]) {
  return box(type, new Uint8Array([version, 0, 0, 0]), ...payload);
}

const zeros = (length: number) => new Uint8Array(length);

const mvhd = (timescale: number) =>
  full("mvhd", 0, zeros(8), u32(timescale), u32(0), zeros(80));

const mdhd = (timescale: number) =>
  full("mdhd", 0, zeros(8), u32(timescale), u32(0), zeros(4));

const hdlr = (handler: string) =>
  full("hdlr", 0, zeros(4), encoder.encode(handler), zeros(13));

const stts = (entries: readonly [number, number][]) =>
  full(
    "stts",
    0,
    u32(entries.length),
    ...entries.flatMap(([count, delta]) => [u32(count), u32(delta)])
  );

const ctts = (version: number, entries: readonly [number, number][]) =>
  full(
    "ctts",
    version,
    u32(entries.length),
    ...entries.flatMap(([count, offset]) => [
      u32(count),
      version === 1 ? i32(offset) : u32(offset),
    ])
  );

const elst = (entries: readonly [number, number][], rate = 0x1_00_00) =>
  full(
    "elst",
    0,
    u32(entries.length),
    ...entries.flatMap(([duration, mediaTime]) => [
      u32(duration),
      i32(mediaTime),
      u32(rate),
    ])
  );

function movie(input: {
  readonly ctts?: Uint8Array;
  readonly elst?: Uint8Array;
  readonly handler?: string;
  readonly mediaScale?: number;
  readonly movieScale?: number;
  readonly stts: Uint8Array;
}): Uint8Array {
  const stbl = box("stbl", input.stts, ...(input.ctts ? [input.ctts] : []));
  const trak = box(
    "trak",
    ...(input.elst ? [box("edts", input.elst)] : []),
    box(
      "mdia",
      mdhd(input.mediaScale ?? 16_000),
      hdlr(input.handler ?? "vide"),
      box("minf", stbl)
    )
  );
  return box("moov", mvhd(input.movieScale ?? 1000), trak);
}

const ftyp = box("ftyp", encoder.encode("isom"), zeros(4));

function inMemory(bytes: Uint8Array) {
  const reads: [number, number][] = [];
  const read: ReadRange = (start, end) => {
    reads.push([start, end]);
    return Effect.succeed(bytes.subarray(start, end));
  };
  return { read, reads };
}

async function times(bytes: Uint8Array) {
  return await Effect.runPromise(
    readFrameTimes(inMemory(bytes).read, bytes.length)
  );
}

async function failure(bytes: Uint8Array): Promise<string> {
  const exit = await Effect.runPromiseExit(
    readFrameTimes(inMemory(bytes).read, bytes.length)
  );
  if (Exit.isSuccess(exit)) {
    return "succeeded";
  }
  const [error] = exit.cause.reasons;
  return error && "error" in error && error.error instanceof FootageError
    ? error.error.message
    : String(exit.cause);
}

const MILLISECOND_STEPS: [number, number][] = [
  [1, 528],
  [1, 544],
  [1, 528],
  [1, 528],
  [1, 544],
  [1, 528],
];

describe("reading frame times", () => {
  it("reads a movie header that follows the media", async () => {
    const file = concat([
      ftyp,
      box("mdat", zeros(64)),
      movie({ mediaScale: 15_360, stts: stts([[4, 512]]) }),
    ]);

    expect(await times(file)).toEqual({
      ticks: [0, 512, 1024, 1536],
      timescale: 15_360,
    });
  });

  it("walks past a box with a 64-bit size", async () => {
    const file = concat([
      ftyp,
      wideBox("mdat", zeros(32)),
      movie({ stts: stts(MILLISECOND_STEPS) }),
    ]);

    expect((await times(file)).ticks.slice(0, 4)).toEqual([0, 528, 1072, 1600]);
  });

  it("applies unsigned reorder offsets and sorts into presentation order", async () => {
    const file = concat([
      ftyp,
      movie({
        ctts: ctts(0, [
          [1, 1024],
          [1, 2048],
          [2, 512],
        ]),
        elst: elst([[0, 1024]]),
        mediaScale: 15_360,
        stts: stts([[4, 512]]),
      }),
    ]);

    expect((await times(file)).ticks).toEqual([0, 512, 1024, 1536]);
  });

  it("reads signed reorder offsets from a version 1 table", async () => {
    const file = concat([
      ftyp,
      movie({
        ctts: ctts(1, [
          [1, 0],
          [1, 512],
          [1, -512],
        ]),
        mediaScale: 15_360,
        stts: stts([[3, 512]]),
      }),
    ]);

    expect((await times(file)).ticks).toEqual([0, 512, 1024]);
  });

  it("delays by a leading empty edit, in the movie's time scale", async () => {
    const file = concat([
      ftyp,
      movie({
        elst: elst([
          [100, -1],
          [0, 0],
        ]),
        mediaScale: 16_000,
        movieScale: 1000,
        stts: stts([[2, 528]]),
      }),
    ]);

    expect((await times(file)).ticks).toEqual([1600, 2128]);
  });

  it("refuses an edit list it does not model", async () => {
    const file = concat([
      ftyp,
      movie({
        elst: elst([
          [100, 0],
          [100, 2000],
        ]),
        stts: stts([[2, 528]]),
      }),
    ]);

    expect(await failure(file)).toBe(
      "The file's edit list has a shape the studio does not model."
    );
  });

  it("refuses an edit that changes the playback rate", async () => {
    const file = concat([
      ftyp,
      movie({ elst: elst([[0, 0]], 0x2_00_00), stts: stts([[2, 528]]) }),
    ]);

    expect(await failure(file)).toBe(
      "The file's edit list changes the playback rate."
    );
  });

  it("names a file with no video track", async () => {
    const file = concat([
      ftyp,
      movie({ handler: "soun", stts: stts([[2, 1024]]) }),
    ]);

    expect(await failure(file)).toBe("The file has no video track.");
  });

  it("names a truncated movie header", async () => {
    const whole = concat([ftyp, movie({ stts: stts([[2, 528]]) })]);
    const cut = whole.slice(0, whole.length - 6);

    expect(await failure(cut)).toBe("The file's box structure is truncated.");
  });

  it("names a file that is not MP4 or MOV", async () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...zeros(60)]);

    expect(await failure(webm)).toBe(NOT_MP4);
    expect(await failure(concat([ftyp, box("mdat", zeros(8))]))).toBe(NOT_MP4);
  });

  it("reads the headers and the movie box, never the media", async () => {
    const media = 10 * 1024 * 1024;
    const file = concat([
      ftyp,
      box("mdat", zeros(media)),
      movie({ stts: stts(MILLISECOND_STEPS) }),
    ]);
    const { read, reads } = inMemory(file);

    await Effect.runPromise(readFrameTimes(read, file.length));

    const total = reads.reduce((sum, [start, end]) => sum + end - start, 0);
    expect(total).toBeLessThan(file.length / 100);
  });
});

describe("late slots", () => {
  it("finds every third slot late on a millisecond-rounded clock", () => {
    const ticks = [0, 528, 1072, 1600, 2128, 2672, 3200];

    expect(lateSlots({ fps: 30, ticks, timescale: 16_000 })).toEqual({
      lateSlots: 2,
      maxLatenessMs: 1 / 3,
      slots: 7,
    });
  });

  it("finds nothing late on an exact grid", () => {
    const ticks = Array.from({ length: 60 }, (_, index) => index * 512);

    expect(lateSlots({ fps: 30, ticks, timescale: 15_360 }).lateSlots).toBe(0);
  });

  it("finds nothing late at 29.97 on an exact grid", () => {
    const ticks = Array.from({ length: 60 }, (_, index) => index * 1001);

    expect(
      lateSlots({ fps: 30_000 / 1001, ticks, timescale: 30_000 }).lateSlots
    ).toBe(0);
  });

  it("does not count a frame two milliseconds late", () => {
    const ticks = [0, 533 + 32, 1067 + 32];

    expect(lateSlots({ fps: 30, ticks, timescale: 16_000 }).lateSlots).toBe(0);
  });

  it("predicts the measured export of the test clip", () => {
    expect(lateSlots({ fps: 30, ...millisecondClock })).toEqual({
      lateSlots: 75,
      maxLatenessMs: 1 / 3,
      slots: 226,
    });
  });
});

describe("the frame grid", () => {
  it("accepts times a clip at normal speed asks for", () => {
    expect(onGrid([0, 1 / 30, 2 / 30, 45 / 30], 30)).toBe(true);
  });

  it("rejects times a clip at 1.5 times speed asks for", () => {
    expect(onGrid([0, 1.5 / 30, 3 / 30], 30)).toBe(false);
  });
});

describe("the file behind a footage address", () => {
  const input = {
    publicDir: "/projects/film/public",
    serveUrl: "http://localhost:4312",
    staticBase: "/static-abc123",
  };

  const resolved = (src: string) =>
    Effect.runPromiseExit(footageFile({ ...input, src }));

  it("resolves a static file, decoding its name", async () => {
    const exit = await resolved(
      "http://localhost:4312/static-abc123/library/1%20(3).mp4"
    );

    expect(exit).toEqual(
      Exit.succeed("/projects/film/public/library/1 (3).mp4")
    );
  });

  it("refuses a remote address", async () => {
    const exit = await resolved("https://example.com/static-abc123/clip.mp4");

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(Exit.isFailure(exit) && exit.cause)).toContain(
      NOT_IN_PROJECT
    );
  });

  it("refuses a path that climbs out of public/", async () => {
    const exit = await resolved(
      "http://localhost:4312/static-abc123/..%2F..%2Fsecret.mp4"
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

const SMOKE_CLIP = path.join(
  import.meta.dir,
  "../../test/fixtures/render-smoke/public/clip.mp4"
);
const ffprobe = which("ffprobe");

describe.skipIf(!(existsSync(SMOKE_CLIP) && ffprobe))("against ffprobe", () => {
  it("reads the render-smoke clip's times exactly as ffprobe does", async () => {
    const probed = (
      await $`${ffprobe} -v error -select_streams v:0 -show_entries packet=pts -of csv=p=0 ${SMOKE_CLIP}`.text()
    )
      .trim()
      .split("\n")
      .map(Number)
      .sort((left, right) => left - right);

    const read = await Effect.runPromise(frameTimesOf(SMOKE_CLIP));

    expect(read.ticks).toEqual(probed);
  });
});

describe("a file on disk", () => {
  it("names a file that cannot be read", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "footage-"));
    const exit = await Effect.runPromiseExit(
      frameTimesOf(path.join(dir, "missing.mp4"))
    );
    await rm(dir, { force: true, recursive: true });

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("measuring the footage a check saw", () => {
  const base = "http://127.0.0.1:4312/static-abc/";
  const project = {
    fps: 30,
    publicDir: "/projects/film/public",
    root: "/projects/film",
    serveUrl: "http://127.0.0.1:4312/render/index.html",
    staticBase: "/static-abc",
  };
  const exact: FrameTimes = {
    ticks: Array.from({ length: 30 }, (_, index) => index * 512),
    timescale: 15_360,
  };
  const files: Record<string, FrameTimes | string> = {
    "/projects/film/public/clean.mp4": exact,
    "/projects/film/public/library/1 (3).mp4": millisecondClock,
    "/projects/film/public/notes.webm": "The file is not MP4 or MOV.",
  };
  const readTimes = (file: string) => {
    const known = files[file];
    return typeof known === "string" || known === undefined
      ? Effect.fail(new FootageError({ message: known ?? "missing" }))
      : Effect.succeed(known);
  };
  const seen = (src: string, frame: number, time = frame / 30) => ({
    footage: [{ src, time }],
    frame,
  });

  const measured = (
    sightings: Parameters<typeof measureFootage>[0]["sightings"]
  ) =>
    Effect.runPromise(
      measureFootage({ ...project, sightings }, readTimes).pipe(
        Effect.map(footageDesignFindings)
      )
    );

  it("reports a late file once, with its counts and the fix, across every frame it was on", async () => {
    const late = `${base}library/1%20(3).mp4`;

    const findings = await measured([
      seen(late, 10),
      seen(late, 40),
      seen(late, 90),
    ]);

    expect(findings).toEqual([
      {
        bbox: null,
        code: "footage_late_frames",
        expected: "Every frame of the clip starts on or before its frame slot.",
        fix: FOOTAGE_FIX,
        frames: [10, 40, 90],
        message:
          "public/library/1 (3).mp4: 75 of 226 frame slots start up to 0.33 ms after the moment OffthreadVideo asks for them, so the export shows the previous frame again there and then skips one.",
        observed: "75 of 226 slots late by up to 0.33 ms.",
        selector: "public/library/1 (3).mp4",
        severity: "warning",
        text: null,
      },
    ]);
  });

  it("adds nothing for a clean file", async () => {
    expect(await measured([seen(`${base}clean.mp4`, 5)])).toEqual([]);
  });

  it("adds nothing when no frame showed footage through OffthreadVideo", async () => {
    expect(await measured([{ frame: 5 }, { footage: [], frame: 9 }])).toEqual(
      []
    );
  });

  it("names a file it could not measure, and why, as information", async () => {
    const findings = await measured([
      seen(`${base}notes.webm`, 12),
      seen("https://cdn.example.com/clip.mp4", 12),
    ]);

    expect(
      findings.map(({ code, message, severity }) => ({
        code,
        message,
        severity,
      }))
    ).toEqual([
      {
        code: "footage_unmeasured",
        message:
          "public/notes.webm could not be checked for late frames. The file is not MP4 or MOV.",
        severity: "info",
      },
      {
        code: "footage_unmeasured",
        message: `https://cdn.example.com/clip.mp4 could not be checked for late frames. ${NOT_IN_PROJECT}`,
        severity: "info",
      },
    ]);
  });

  it("leaves a clip played at another speed unmeasured", async () => {
    const findings = await measured([seen(`${base}clean.mp4`, 2, 1.5 / 30)]);

    expect(findings.map(({ observed }) => observed)).toEqual([OTHER_SPEED]);
  });
});
