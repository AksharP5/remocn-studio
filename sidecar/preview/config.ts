import path from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { ExportCodec } from "@/shared/export";
import {
  configFile,
  importFile,
  importFrom,
  PreviewError,
  packageVersionOf,
  resolveFrom,
} from "./project";

export const CONFIG_ROOT_ENV = "REMOCN_CONFIG_ROOT";

export interface ConfiguredValue {
  readonly source: string;
  readonly value: unknown;
}

export interface ConfigProblem {
  readonly id: string;
  readonly message: string;
}

export interface AcceptedOptions {
  readonly composition: readonly string[];
  readonly media: readonly string[];
  readonly still: readonly string[];
}

export interface ResolvedConfig {
  readonly accepts: AcceptedOptions;
  readonly chromium: Record<string, unknown>;
  readonly codec: string | null;
  readonly concurrency: number | string | null;
  readonly envVariables: Record<string, string>;
  readonly ffmpegOverride: boolean;
  readonly options: Record<string, ConfiguredValue>;
  readonly outputLocation: string | null;
  readonly problems: readonly ConfigProblem[];
  readonly version: string;
}

export const EMPTY_CONFIG: ResolvedConfig = {
  accepts: { composition: [], media: [], still: [] },
  chromium: {},
  codec: null,
  concurrency: null,
  envVariables: {},
  ffmpegOverride: false,
  options: {},
  outputLocation: null,
  problems: [],
  version: "",
};

const CHROMIUM_PREFIX = "chromiumOptions.";

const CHROMIUM_SPELLING: Record<string, string> = {
  enableMultiprocessOnLinux: "enableMultiProcessOnLinux",
};

export const CHROMIUM_KEYS = new Set([
  "darkMode",
  "disableWebSecurity",
  "enableMultiProcessOnLinux",
  "gl",
  "headless",
  "ignoreCertificateErrors",
  "userAgent",
]);

const SEPARATE_IMAGE_FORMATS: Record<string, "media" | "still"> = {
  "still-image-format": "still",
  "video-image-format": "media",
};

const NOT_FROM_CONFIG = new Set([
  "codec",
  "on-browser-download",
  "webhook-custom-data",
]);

const OURS = new Set([
  "cancelSignal",
  "codec",
  "composition",
  "frame",
  "imageFormat",
  "inputProps",
  "logLevel",
  "onArtifact",
  "onBrowserDownload",
  "onBrowserLog",
  "onDownload",
  "onLog",
  "onProgress",
  "onStart",
  "output",
  "outDir",
  "outputLocation",
  "overwrite",
  "packageManager",
  "port",
  "publicDir",
  "publicPath",
  "scale",
  "serveUrl",
]);

const MEDIA_ANCHORS = ["serveUrl", "composition", "codec"];

const STILL_ANCHORS = ["serveUrl", "composition", "frame"];

const COMPOSITION_ANCHORS = ["serveUrl", "id"];

const FALLBACK_STILL = [
  "binariesDirectory",
  "browserExecutable",
  "chromeMode",
  "chromiumOptions",
  "envVariables",
  "jpegQuality",
  "mediaCacheSizeInBytes",
  "offthreadVideoCacheSizeInBytes",
  "offthreadVideoThreads",
  "timeoutInMilliseconds",
] as const;

const FALLBACK_COMPOSITION = [
  "binariesDirectory",
  "browserExecutable",
  "chromeMode",
  "chromiumOptions",
  "envVariables",
  "mediaCacheSizeInBytes",
  "offthreadVideoCacheSizeInBytes",
  "offthreadVideoThreads",
  "timeoutInMilliseconds",
] as const;

const FALLBACK_MEDIA = [
  "audioBitrate",
  "audioCodec",
  "binariesDirectory",
  "chromeMode",
  "chromiumOptions",
  "colorSpace",
  "concurrency",
  "crf",
  "disallowParallelEncoding",
  "encodingBufferSize",
  "encodingMaxRate",
  "enforceAudioTrack",
  "everyNthFrame",
  "forSeamlessAacConcatenation",
  "frameRange",
  "gopSize",
  "hardwareAcceleration",
  "jpegQuality",
  "mediaCacheSizeInBytes",
  "metadata",
  "muted",
  "numberOfGifLoops",
  "offthreadVideoCacheSizeInBytes",
  "offthreadVideoThreads",
  "pixelFormat",
  "preferLossless",
  "proResProfile",
  "sampleRate",
  "separateAudioTo",
  "timeoutInMilliseconds",
  "videoBitrate",
  "x264Preset",
] as const;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const PARAMETER = /^\s*(?:async\s+)?\(\s*\{([^}]*)\}/;

const UNPACKED = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*[A-Za-z_$][\w$]*/;

const SPREAD = /^\.\.\./;

function fieldsIn(block: string): readonly string[] {
  return block
    .split(",")
    .map((part) => (part.split(":")[0] ?? "").split("=")[0] ?? "")
    .map((name) => name.trim().replace(SPREAD, ""))
    .filter((name) => IDENTIFIER.test(name));
}

export function acceptedBy(candidate: unknown): readonly string[] {
  if (typeof candidate !== "function") {
    return [];
  }

  const source = Function.prototype.toString.call(candidate);
  const inParameters = PARAMETER.exec(source);

  if (inParameters?.[1] !== undefined) {
    return fieldsIn(inParameters[1]);
  }

  const unpacked = UNPACKED.exec(source);

  return unpacked?.[1] === undefined ? [] : fieldsIn(unpacked[1]);
}

function accepted(
  candidate: unknown,
  anchors: readonly string[],
  fallback: readonly string[]
): { names: readonly string[]; read: boolean } {
  const names = acceptedBy(candidate);
  const read = anchors.every((anchor) => names.includes(anchor));

  return read ? { names, read } : { names: fallback, read };
}

// Read out of the project's own @remotion/renderer, so `id` and `ssrName` are
// what that version happens to carry rather than what this one declares.
interface RemotionOption {
  getValue: (
    input: { commandLine: Record<string, unknown> },
    more?: unknown
  ) => { source: string; value: unknown };
  id?: string;
  ssrName?: string | null;
}

function readable(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  const kind = typeof value;

  if (kind === "function" || kind === "symbol" || kind === "bigint") {
    return false;
  }

  if (kind !== "object") {
    return true;
  }

  try {
    return JSON.parse(JSON.stringify(value)) !== undefined;
  } catch {
    return false;
  }
}

export interface ConfigInternals {
  getConcurrency?: () => number | string | null;
  getFfmpegOverrideFunction?: () => unknown;
  getOutputCodecOrUndefined?: () => string | undefined;
  getOutputLocation?: () => string | null;
  resetConfigOptions?: () => void;
}

export interface ConfigHost {
  readonly allOptions: Record<string, RemotionOption>;
  readonly composition: unknown;
  readonly configInternals: ConfigInternals;
  readonly envVariables: Record<string, string>;
  readonly ffmpegOverride: boolean;
  readonly renderMedia: unknown;
  readonly renderStill: unknown;
  readonly version: string;
}

interface Placed {
  chromium: Record<string, unknown>;
  options: Record<string, ConfiguredValue>;
  problems: ConfigProblem[];
}

function readOption(key: string, option: RemotionOption, into: Placed): void {
  const name = option.ssrName;

  if (
    typeof name !== "string" ||
    name.length === 0 ||
    NOT_FROM_CONFIG.has(option.id ?? "")
  ) {
    return;
  }

  let read: { source: string; value: unknown };

  try {
    read = option.getValue({ commandLine: {} });
  } catch (cause) {
    into.problems.push({
      id: option.id ?? key,
      message: `the installed Remotion could not answer for it: ${errorMessage(cause)}`,
    });
    return;
  }

  if (!readable(read.value)) {
    into.problems.push({
      id: option.id ?? key,
      message:
        "its value is not something the studio can carry between processes, so it is not applied",
    });
    return;
  }

  const bare = name.startsWith(CHROMIUM_PREFIX)
    ? name.slice(CHROMIUM_PREFIX.length)
    : name;
  const spelled = CHROMIUM_SPELLING[bare] ?? bare;

  if (name.startsWith(CHROMIUM_PREFIX) || CHROMIUM_KEYS.has(spelled)) {
    into.chromium[spelled] = read.value;
    return;
  }

  const only = SEPARATE_IMAGE_FORMATS[option.id ?? ""];

  into.options[only === undefined ? name : `${only}:${name}`] = {
    source: read.source,
    value: read.value,
  };
}

export function configFrom(host: ConfigHost): ResolvedConfig {
  const into: Placed = { chromium: {}, options: {}, problems: [] };

  for (const [key, option] of Object.entries(host.allOptions)) {
    readOption(key, option, into);
  }

  const media = accepted(host.renderMedia, MEDIA_ANCHORS, FALLBACK_MEDIA);
  const still = accepted(host.renderStill, STILL_ANCHORS, FALLBACK_STILL);
  const composition = accepted(
    host.composition,
    COMPOSITION_ANCHORS,
    FALLBACK_COMPOSITION
  );

  for (const [name, read] of [
    ["renderMedia", media.read],
    ["renderStill", still.read],
    ["selectComposition", composition.read],
  ] as const) {
    if (!read) {
      into.problems.push({
        id: name,
        message: `the studio could not read which options this Remotion's ${name} takes, so it applies the set it knows`,
      });
    }
  }

  return {
    accepts: {
      composition: composition.names,
      media: media.names,
      still: still.names,
    },
    chromium: into.chromium,
    codec: host.configInternals.getOutputCodecOrUndefined?.() ?? null,
    concurrency: host.configInternals.getConcurrency?.() ?? null,
    envVariables: host.envVariables,
    ffmpegOverride: host.ffmpegOverride,
    options: into.options,
    outputLocation: host.configInternals.getOutputLocation?.() ?? null,
    problems: into.problems,
    version: host.version,
  };
}

export type OptionSet = "composition" | "media" | "still";

export function optionsFor(
  config: ResolvedConfig,
  set: OptionSet
): Record<string, unknown> {
  const takes = new Set(config.accepts[set]);
  const picked: Record<string, unknown> = {};

  for (const [key, held] of Object.entries(config.options)) {
    const [scope, bare] = key.includes(":") ? key.split(":") : [null, key];

    if (scope !== null && scope !== set) {
      continue;
    }

    const name = bare ?? key;

    if (OURS.has(name) || !takes.has(name)) {
      continue;
    }

    picked[name] = held.value;
  }

  return picked;
}

export interface Dropped {
  readonly name: string;
  readonly reason: string;
}

const CODEC_ONLY: Record<string, readonly ExportCodec[]> = {
  crf: ["h264", "vp9"],
  encodingBufferSize: ["h264", "vp9"],
  encodingMaxRate: ["h264", "vp9"],
  numberOfGifLoops: ["gif"],
  proResProfile: ["prores"],
  videoBitrate: ["h264", "vp9"],
  x264Preset: ["h264"],
};

export const AUDIO_CODECS: Record<ExportCodec, readonly string[]> = {
  gif: [],
  h264: ["aac", "mp3", "pcm-16"],
  prores: ["aac", "pcm-16"],
  vp9: ["opus", "pcm-16"],
};

function empty(value: unknown): boolean {
  return value === null || value === undefined;
}

export function compatibleWith(
  codec: ExportCodec,
  options: Record<string, unknown>
): { dropped: readonly Dropped[]; options: Record<string, unknown> } {
  const kept: Record<string, unknown> = {};
  const dropped: Dropped[] = [];

  for (const [name, value] of Object.entries(options)) {
    const only = CODEC_ONLY[name];

    if (!empty(value) && only !== undefined && !only.includes(codec)) {
      dropped.push({
        name,
        reason: `${name} belongs to ${only.join(" or ")}, not ${codec}`,
      });
      continue;
    }

    if (
      name === "audioCodec" &&
      typeof value === "string" &&
      !AUDIO_CODECS[codec].includes(value)
    ) {
      dropped.push({
        name,
        reason:
          AUDIO_CODECS[codec].length === 0
            ? `${codec} carries no audio`
            : `${codec} takes ${AUDIO_CODECS[codec].join(" or ")}, not ${value}`,
      });
      continue;
    }

    kept[name] = value;
  }

  if (!(empty(kept.crf) || empty(kept.videoBitrate))) {
    dropped.push({
      name: "videoBitrate",
      reason: "a video bitrate and a quality cannot both be set",
    });
    kept.videoBitrate = null;
  }

  if (!empty(kept.encodingMaxRate) && empty(kept.encodingBufferSize)) {
    dropped.push({
      name: "encodingMaxRate",
      reason: "a maximum rate needs an encoding buffer size beside it",
    });
    kept.encodingMaxRate = null;
  }

  return { dropped, options: kept };
}

export function readRenderConfig(
  root: string
): Effect.Effect<ResolvedConfig, PreviewError> {
  return Effect.gen(function* () {
    const internals = yield* configInternalsOf(root);

    yield* Effect.try({
      catch: (cause) =>
        new PreviewError({
          message: `the project's Remotion config could not be reset: ${errorMessage(cause)}`,
        }),
      try: () => internals.resetConfigOptions?.(),
    });

    const untouched = internals.getFfmpegOverrideFunction?.() ?? null;

    yield* loadProjectConfig(root);

    const ffmpegOverride =
      (internals.getFfmpegOverrideFunction?.() ?? null) !== untouched;

    const manifest = yield* resolveFrom(
      root,
      "@remotion/renderer/package.json"
    );

    const registry = yield* importFile<{
      allOptions?: Record<string, RemotionOption>;
      default?: { allOptions?: Record<string, RemotionOption> };
    }>(path.join(path.dirname(manifest), "dist/options/index.js"));

    const allOptions = registry.allOptions ?? registry.default?.allOptions;

    if (allOptions === undefined) {
      return yield* Effect.fail(
        new PreviewError({
          message:
            "this project's @remotion/renderer does not expose its option registry, so the studio cannot read the project's render settings",
        })
      );
    }

    const renderer = yield* importFrom<Record<string, unknown>>(
      root,
      "@remotion/renderer"
    );
    const exported = rendererExports(renderer);

    return configFrom({
      allOptions,
      composition: exported.selectComposition,
      configInternals: internals,
      envVariables: yield* environmentOf(root),
      ffmpegOverride,
      renderMedia: exported.renderMedia,
      renderStill: exported.renderStill,
      version: yield* remotionVersion(root),
    });
  });
}

function rendererExports(module: Record<string, unknown>) {
  const found = module as Record<string, unknown> & {
    default?: Record<string, unknown>;
  };
  const source =
    typeof found.renderStill === "function" ? found : (found.default ?? found);

  return source as Record<string, unknown>;
}

function configInternalsOf(root: string) {
  return importFrom<{
    ConfigInternals?: ConfigHost["configInternals"];
    default?: { ConfigInternals?: ConfigHost["configInternals"] };
  }>(root, "@remotion/cli/config").pipe(
    Effect.map(
      (module) =>
        module.ConfigInternals ?? module.default?.ConfigInternals ?? {}
    ),
    Effect.catch(() => Effect.succeed({} as ConfigHost["configInternals"]))
  );
}

function loadProjectConfig(root: string): Effect.Effect<void, PreviewError> {
  const file = configFile(root);
  return file === null ? Effect.void : Effect.asVoid(importFile(file));
}

interface EnvModule {
  getEnvironmentVariables?: (
    onUpdate: null,
    logLevel: string,
    indent: boolean
  ) => Record<string, string>;
}

function environmentOf(
  root: string
): Effect.Effect<Record<string, string>, never> {
  return Effect.gen(function* () {
    const manifest = yield* resolveFrom(
      root,
      "@remotion/cli/package.json"
    ).pipe(Effect.catch(() => Effect.succeed(null)));

    if (manifest === null) {
      return {};
    }

    const module = yield* importFile<EnvModule>(
      path.join(path.dirname(manifest), "dist/get-env.js")
    ).pipe(Effect.catch(() => Effect.succeed({} as EnvModule)));

    return yield* Effect.try(
      () => module.getEnvironmentVariables?.(null, "error", false) ?? {}
    ).pipe(Effect.catch(() => Effect.succeed({})));
  });
}

function remotionVersion(root: string): Effect.Effect<string, never> {
  return packageVersionOf(root, "remotion").pipe(
    Effect.catch(() => Effect.succeed(""))
  );
}
