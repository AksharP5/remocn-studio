import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import {
  type CompositionSize,
  type ExportSettings,
  FORMAT_SPECS,
  outputSize,
  qualityFor,
  scaleFor,
} from "@/shared/export";
import type { ExportEvent, Exported, ExportProgress } from "@/shared/ipc";
import {
  compatibleWith,
  type Dropped,
  optionsFor,
  type ResolvedConfig,
} from "./config";
import { type RenderContext, UNKNOWN_CONTEXT } from "./failure";
import { type Measured, PreviewError, type RenderOptions } from "./project";
import {
  type CompositionCache,
  DELAY_RENDER_TIMEOUT_MS,
  type RenderBrowser,
  type Renderer,
  renderErrorFor,
  warmComposition,
} from "./still";

export const CODEC = "h264";
export const EXTENSION = ".mp4";
export const OUT_DIR = "out";

const CANCEL_GRACE_MS = 10_000;
const LOG_LEVEL = "error";

export interface RenderMediaProgress {
  encodedFrames: number;
  progress: number;
  renderedFrames: number;
  stitchStage: string;
}

export interface Cancellation {
  cancel: () => void;
  cancelSignal: unknown;
}

export interface RenderMediaOptions {
  cancelSignal: unknown;
  chromeMode?: string;
  chromiumOptions: Record<string, unknown>;
  codec: string;
  composition: Measured;
  concurrency?: number;
  enforceAudioTrack?: boolean;
  frameRange?: [number, number];
  inputProps?: Record<string, unknown>;
  logLevel: string;
  onProgress: (progress: RenderMediaProgress) => void;
  onStart: (data: { frameCount: number }) => void;
  outputLocation: string;
  overwrite: boolean;
  puppeteerInstance?: RenderBrowser;
  scale?: number;
  serveUrl: string;
  timeoutInMilliseconds: number;
}

export interface Exporter {
  makeCancelSignal: () => Cancellation;
  renderMedia: (options: RenderMediaOptions) => Promise<unknown>;
}

export interface RenderPlan {
  readonly codec: string;
  readonly crf: number | null;
  readonly extra: Record<string, unknown>;
  readonly outputPath: string;
  readonly proResProfile: string | null;
  readonly scale: number;
}

export interface ExportInput {
  browser?: RenderBrowser | null;
  composition: string;
  context?: RenderContext;
  measured: Measured;
  onEvent: (event: ExportEvent) => void;
  options: RenderOptions;
  plan: RenderPlan;
  renderer: Exporter & Renderer;
  serveUrl: string;
}

// Everything the plan decides itself, so a value the project configured for
// the same thing cannot arrive beside it. `crf` and `proResProfile` leave only
// when the person picked a quality: on "Project default" the project's own is
// exactly what should go.
const SET_BY_PLAN = ["scale", "codec"];

export function planFor(input: {
  config: ResolvedConfig;
  outputPath: string;
  settings: ExportSettings;
  size: CompositionSize;
}): { dropped: readonly Dropped[]; plan: RenderPlan } {
  const { codec } = FORMAT_SPECS[input.settings.format];
  const picked = qualityFor(input.settings.format, input.settings.quality);
  const scale = scaleFor(input.settings.resolution, input.size);

  const fromProject = compatibleWith(codec, optionsFor(input.config, "media"));

  const ours = new Set(SET_BY_PLAN);

  if (picked.crf !== null) {
    ours.add("crf");
    ours.add("videoBitrate");
  }

  if (picked.proResProfile !== null) {
    ours.add("proResProfile");
  }

  const extra = Object.fromEntries(
    Object.entries(fromProject.options).filter(([name]) => !ours.has(name))
  );

  return {
    dropped: fromProject.dropped,
    plan: {
      codec,
      crf: picked.crf,
      extra,
      outputPath: input.outputPath,
      proResProfile: picked.proResProfile,
      scale,
    },
  };
}

export function exporterOf(
  renderer: Renderer
): Effect.Effect<Exporter & Renderer, PreviewError> {
  const found = renderer as Partial<Exporter> & Renderer;

  if (
    typeof found.renderMedia === "function" &&
    typeof found.makeCancelSignal === "function"
  ) {
    return Effect.succeed(found as Exporter & Renderer);
  }

  return Effect.fail(
    new PreviewError({
      message:
        "this project's @remotion/renderer does not expose renderMedia, so there is nothing here that can encode a video — upgrade Remotion in the project folder",
    })
  );
}

export function exportMedia(
  input: ExportInput
): Effect.Effect<Exported, PreviewError> {
  const context = input.context ?? UNKNOWN_CONTEXT;
  const failed = renderErrorFor(context);

  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      input.onEvent({ stage: "rendering", type: "stage" })
    );

    const { measured } = input;
    const output = input.plan.outputPath;
    const folder = path.dirname(output);
    const stem = path.basename(output, path.extname(output));
    const partial = path.join(
      folder,
      `.${stem}-${randomBytes(4).toString("hex")}${path.extname(output)}`
    );

    yield* Effect.acquireRelease(
      Effect.tryPromise({
        catch: failed,
        try: () => mkdir(folder, { recursive: true }),
      }),
      () => Effect.ignore(Effect.promise(() => rm(partial, { force: true })))
    );

    yield* render(input, measured, partial, context);

    yield* Effect.sync(() =>
      input.onEvent({ stage: "finalizing", type: "stage" })
    );

    yield* Effect.tryPromise({
      catch: failed,
      try: () => rename(partial, output),
    });

    const bytes = yield* Effect.tryPromise({
      catch: failed,
      try: async () => (await stat(output)).size,
    });

    const size = outputSize({
      format: formatOf(input.plan.codec),
      scale: input.plan.scale,
      size: { height: measured.height, width: measured.width },
    });

    return {
      bytes,
      height: size.height,
      path: output,
      width: size.width,
    };
  }).pipe(Effect.scoped);
}

function formatOf(codec: string) {
  const found = Object.entries(FORMAT_SPECS).find(
    ([, spec]) => spec.codec === codec
  );

  return (found?.[0] ?? "mp4") as keyof typeof FORMAT_SPECS;
}

function render(
  input: ExportInput,
  measured: Measured,
  output: string,
  context: RenderContext,
  extra: Partial<RenderMediaOptions> = {}
): Effect.Effect<void, PreviewError> {
  const { chromeMode, chromiumOptions } = input.options;
  const timeoutInMilliseconds =
    input.options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS;
  const failed = renderErrorFor(context);

  return Effect.callback<void, PreviewError>((resume) => {
    let total = frameCountOf(measured);
    const { cancel, cancelSignal } = input.renderer.makeCancelSignal();

    const settled = input.renderer
      .renderMedia({
        ...input.plan.extra,
        ...(chromeMode === null ? {} : { chromeMode }),
        ...(input.options.browserExecutable
          ? { browserExecutable: input.options.browserExecutable }
          : {}),
        ...(input.plan.crf === null ? {} : { crf: input.plan.crf }),
        ...(input.plan.proResProfile === null
          ? {}
          : { proResProfile: input.plan.proResProfile }),
        cancelSignal,
        chromiumOptions,
        codec: input.plan.codec,
        composition: measured,
        logLevel: LOG_LEVEL,
        onProgress: (progress) => input.onEvent(progressOf(progress, total)),
        onStart: (data) => {
          total = data.frameCount;
        },
        outputLocation: output,
        overwrite: true,
        ...(input.browser ? { puppeteerInstance: input.browser } : {}),
        scale: input.plan.scale,
        serveUrl: input.serveUrl,
        timeoutInMilliseconds,
        ...extra,
      })
      .then(
        () => resume(Effect.void),
        (cause: unknown) => resume(Effect.fail(failed(cause)))
      );

    return Effect.promise(() => {
      cancel();
      return settled;
    }).pipe(Effect.timeout(CANCEL_GRACE_MS), Effect.ignore);
  });
}

const CLIP_SECONDS = 6;
const CLIP_WIDTH = 640;
const CLIPS_DIR = "clips";

export interface ClipInput {
  browser?: RenderBrowser | null;
  cache: CompositionCache;
  composition: string;
  context?: RenderContext;
  dir: string;
  frame: number;
  options: RenderOptions;
  renderer: Exporter & Renderer;
  serveUrl: string;
}

// A hover preview, not an export: a few seconds of the composition from the
// frame the person is looking at, downscaled so a grid of cards costs little
// to decode. Best-effort by contract — the caller swallows every failure.
export function clipMedia(
  input: ClipInput
): Effect.Effect<string, PreviewError> {
  const context = input.context ?? UNKNOWN_CONTEXT;
  const failed = renderErrorFor(context);

  return Effect.gen(function* () {
    const measured = yield* warmComposition({
      browser: input.browser,
      cache: input.cache,
      composition: input.composition,
      context,
      options: input.options,
      renderer: input.renderer,
      serveUrl: input.serveUrl,
    });

    const folder = path.join(input.dir, CLIPS_DIR);

    yield* Effect.tryPromise({
      catch: failed,
      try: async () => {
        await rm(folder, { force: true, recursive: true });
        await mkdir(folder, { recursive: true });
      },
    });

    const output = path.join(
      folder,
      `clip-${randomBytes(4).toString("hex")}${EXTENSION}`
    );

    const fps = numberOf(measured.fps, 30);
    const duration = frameCountOf(measured);
    const start = Math.max(0, Math.min(Math.trunc(input.frame), duration - 1));
    const end = Math.min(
      duration - 1,
      start + Math.round(CLIP_SECONDS * fps) - 1
    );
    const scale = Math.min(1, CLIP_WIDTH / Math.max(1, measured.width));

    yield* render(
      {
        browser: input.browser,
        composition: input.composition,
        context,
        measured,
        onEvent: () => undefined,
        options: input.options,
        plan: {
          codec: CODEC,
          crf: null,
          extra: {},
          outputPath: output,
          proResProfile: null,
          scale,
        },
        renderer: input.renderer,
        serveUrl: input.serveUrl,
      },
      measured,
      output,
      context,
      { frameRange: [start, Math.max(start, end)] }
    );

    return output;
  });
}

function numberOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function progressOf(
  progress: RenderMediaProgress,
  total: number
): ExportProgress {
  return {
    encoded: whole(progress.encodedFrames),
    percent: percentOf(progress.progress),
    rendered: whole(progress.renderedFrames),
    stage: progress.stitchStage === "muxing" ? "muxing" : "encoding",
    total: whole(total),
    type: "progress",
  };
}

function frameCountOf(measured: Measured): number {
  const found = measured.durationInFrames;
  return typeof found === "number" ? whole(found) : 0;
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function percentOf(value: number): number {
  return Math.min(100, whole(value * 100));
}
