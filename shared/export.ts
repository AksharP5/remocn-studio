export const EXPORT_FORMATS = ["mp4", "webm", "gif", "mov"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_CODECS = ["h264", "vp9", "gif", "prores"] as const;

export type ExportCodec = (typeof EXPORT_CODECS)[number];

export const EXPORT_QUALITIES = [
  "project",
  "draft",
  "standard",
  "high",
] as const;

export type ExportQuality = (typeof EXPORT_QUALITIES)[number];

export type PickedQuality = Exclude<ExportQuality, "project">;

export const EXPORT_RESOLUTIONS = ["source", "720", "1080", "2160"] as const;

export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];

export const EXPORT_PRESETS = [
  "custom",
  "youtube",
  "shorts",
  "instagram",
] as const;

export type ExportPreset = (typeof EXPORT_PRESETS)[number];

export type NamedPreset = Exclude<ExportPreset, "custom">;

export type QualityKind = "crf" | "prores" | null;

export interface FormatSpec {
  readonly audio: boolean;
  readonly codec: ExportCodec;
  readonly container: string;
  readonly even: boolean;
  readonly extension: string;
  // Everything the renderer will accept for this codec, its own first. It
  // refuses an output filename whose ending it does not recognise, so a name
  // typed into the save panel is checked against this rather than assumed.
  readonly extensions: readonly string[];
  readonly label: string;
  readonly quality: QualityKind;
}

export const FORMAT_SPECS: Record<ExportFormat, FormatSpec> = {
  gif: {
    audio: false,
    codec: "gif",
    container: "GIF",
    even: false,
    extension: "gif",
    extensions: ["gif"],
    label: "GIF",
    quality: null,
  },
  mov: {
    audio: true,
    codec: "prores",
    container: "MOV",
    even: false,
    extension: "mov",
    extensions: ["mov", "mkv"],
    label: "MOV · ProRes",
    quality: "prores",
  },
  mp4: {
    audio: true,
    codec: "h264",
    container: "MP4",
    even: true,
    extension: "mp4",
    extensions: ["mp4", "mkv", "mov"],
    label: "MP4 · H.264",
    quality: "crf",
  },
  webm: {
    audio: true,
    codec: "vp9",
    container: "WebM",
    even: false,
    extension: "webm",
    extensions: ["webm"],
    label: "WebM · VP9",
    quality: "crf",
  },
};

export const DEFAULT_FORMAT: ExportFormat = "mp4";

const CRF: Record<"h264" | "vp9", Record<PickedQuality, number>> = {
  h264: { draft: 32, high: 12, standard: 18 },
  vp9: { draft: 40, high: 20, standard: 28 },
};

const PRORES: Record<PickedQuality, string> = {
  draft: "proxy",
  high: "hq",
  standard: "standard",
};

export const QUALITY_LABELS: Record<ExportQuality, string> = {
  draft: "Draft",
  high: "High",
  project: "Project default",
  standard: "Standard",
};

export const RESOLUTION_LABELS: Record<ExportResolution, string> = {
  "720": "720p",
  "1080": "1080p",
  "2160": "4K",
  source: "Source",
};

export interface PresetSpec {
  readonly label: string;
  readonly ratios: readonly (readonly [number, number])[];
  readonly settings: Omit<ExportSettings, "preset">;
}

const VERTICAL: Omit<ExportSettings, "preset"> = {
  format: "mp4",
  quality: "high",
  resolution: "1080",
};

export const PRESET_SPECS: Record<NamedPreset, PresetSpec> = {
  instagram: {
    label: "Instagram Feed",
    ratios: [
      [1, 1],
      [4, 5],
    ],
    settings: VERTICAL,
  },
  shorts: {
    label: "Shorts · Reels · TikTok",
    ratios: [[9, 16]],
    settings: VERTICAL,
  },
  youtube: {
    label: "YouTube",
    ratios: [[16, 9]],
    settings: VERTICAL,
  },
};

export interface ExportSettings {
  readonly format: ExportFormat;
  readonly preset: ExportPreset;
  readonly quality: ExportQuality;
  readonly resolution: ExportResolution;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: DEFAULT_FORMAT,
  preset: "custom",
  quality: "project",
  resolution: "source",
};

export interface CompositionSize {
  readonly height: number;
  readonly width: number;
}

export interface QualityChoice {
  readonly crf: number | null;
  readonly proResProfile: string | null;
}

export const NO_QUALITY: QualityChoice = { crf: null, proResProfile: null };

export function qualityFor(
  format: ExportFormat,
  quality: ExportQuality
): QualityChoice {
  const spec = FORMAT_SPECS[format];

  if (quality === "project" || spec.quality === null) {
    return NO_QUALITY;
  }

  if (spec.quality === "prores") {
    return { crf: null, proResProfile: PRORES[quality] };
  }

  const table = CRF[spec.codec === "vp9" ? "vp9" : "h264"];

  return { crf: table[quality], proResProfile: null };
}

export function scaleFor(
  resolution: ExportResolution,
  size: CompositionSize
): number {
  if (resolution === "source") {
    return 1;
  }

  const short = Math.min(size.width, size.height);

  if (!(Number.isFinite(short) && short > 0)) {
    return 1;
  }

  return Number(resolution) / short;
}

function evenSide(side: number, scale: number): number {
  let found = Math.round(side);

  while (found > 0 && Math.round(found * scale) % 2 !== 0) {
    found -= 1;
  }

  return found;
}

export function outputSize(input: {
  readonly format: ExportFormat;
  readonly scale: number;
  readonly size: CompositionSize;
}): CompositionSize {
  const { even } = FORMAT_SPECS[input.format];
  const { scale } = input;

  if (!(Number.isFinite(scale) && scale > 0)) {
    return { height: 0, width: 0 };
  }

  const width = even ? evenSide(input.size.width, scale) : input.size.width;
  const height = even ? evenSide(input.size.height, scale) : input.size.height;

  return {
    height: Math.round(height * scale),
    width: Math.round(width * scale),
  };
}

export function presetSettings(preset: NamedPreset): ExportSettings {
  return { ...PRESET_SPECS[preset].settings, preset };
}

export function changeSettings(
  settings: ExportSettings,
  patch: Partial<Omit<ExportSettings, "preset">>
): ExportSettings {
  const next = { ...settings, ...patch };

  const moved =
    next.format !== settings.format ||
    next.quality !== settings.quality ||
    next.resolution !== settings.resolution;

  return moved ? { ...next, preset: "custom" } : settings;
}

function gcd(left: number, right: number): number {
  return right === 0 ? left : gcd(right, left % right);
}

export function ratioLabel(size: CompositionSize): string {
  const width = Math.round(size.width);
  const height = Math.round(size.height);

  if (!(width > 0 && height > 0)) {
    return "unknown";
  }

  const divisor = gcd(width, height);
  const left = width / divisor;
  const right = height / divisor;

  return left > 50 || right > 50
    ? `${(width / height).toFixed(2)}:1`
    : `${left}:${right}`;
}

const RATIO_TOLERANCE = 0.01;

function matchesRatio(
  size: CompositionSize,
  [width, height]: readonly [number, number]
): boolean {
  if (!(size.width > 0 && size.height > 0)) {
    return false;
  }

  const target = width / height;

  return (
    Math.abs(size.width / size.height - target) / target <= RATIO_TOLERANCE
  );
}

export function ratioWarning(
  preset: ExportPreset,
  size: CompositionSize
): string | null {
  if (preset === "custom") {
    return null;
  }

  const spec = PRESET_SPECS[preset];

  if (spec.ratios.some((ratio) => matchesRatio(size, ratio))) {
    return null;
  }

  const expected = spec.ratios
    .map(([width, height]) => `${width}:${height}`)
    .join(" or ");

  return `${spec.label} expects ${expected} and this video is ${ratioLabel(size)}. The export keeps the video’s own shape.`;
}

const UNSAFE = /[^a-zA-Z0-9._-]+/g;

const SEPARATORS = /[/\\]/g;

export function fileStem(composition: string): string {
  const cleaned = composition.replace(UNSAFE, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "video";
}

export function stemOf(input: {
  readonly composition: string;
  readonly preset: ExportPreset;
}): string {
  const stem = fileStem(input.composition);

  return input.preset === "custom" ? stem : `${stem}-${input.preset}`;
}

export function fileNameOf(input: {
  readonly composition: string;
  readonly format: ExportFormat;
  readonly preset: ExportPreset;
}): string {
  return `${stemOf(input)}.${FORMAT_SPECS[input.format].extension}`;
}

/**
 * The name a person typed, made safe to put in a path: a separator would send
 * the file somewhere they cannot see in the dialog, and an empty name has
 * nothing to save to.
 */
export function typedName(typed: string): string {
  return typed.replace(SEPARATORS, "-").trimStart();
}

/** What a chosen file is called once its own ending is taken off. */
export function stemFrom(name: string, format: ExportFormat): string {
  const dot = name.lastIndexOf(".");

  if (dot <= 0) {
    return name;
  }

  return FORMAT_SPECS[format].extensions.includes(
    name.slice(dot + 1).toLowerCase()
  )
    ? name.slice(0, dot)
    : name;
}

// The renderer refuses an output filename whose ending it does not know for the
// codec, so a name the save panel let through is corrected here — by appending,
// never by replacing, so nothing the person typed is thrown away.
export function withExtension(
  target: string,
  format: ExportFormat
): { changed: boolean; path: string } {
  const spec = FORMAT_SPECS[format];
  const name = target.slice(target.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const ending = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";

  return spec.extensions.includes(ending)
    ? { changed: false, path: target }
    : { changed: true, path: `${target}.${spec.extension}` };
}

export const MAX_SCALE = 16;

const MIN_SIDE = 2;

export interface ExportReview {
  readonly output: CompositionSize;
  readonly problems: readonly string[];
  readonly scale: number;
  readonly warnings: readonly string[];
}

export function reviewExport(
  settings: ExportSettings,
  size: CompositionSize
): ExportReview {
  const scale = scaleFor(settings.resolution, size);
  const output = outputSize({ format: settings.format, scale, size });
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!(size.width > 0 && size.height > 0)) {
    problems.push("The composition has no measured size yet.");
  } else if (scale > MAX_SCALE) {
    problems.push(
      `${RESOLUTION_LABELS[settings.resolution]} is more than ${MAX_SCALE}× this video, which the renderer refuses.`
    );
  } else if (output.width < MIN_SIDE || output.height < MIN_SIDE) {
    problems.push(
      `That would be ${output.width}×${output.height}, which is too small to encode.`
    );
  }

  if (scale > 1) {
    warnings.push(
      "This is an upscale: pictures and video in the scene are drawn larger than their own pixels."
    );
  }

  if (
    problems.length === 0 &&
    FORMAT_SPECS[settings.format].even &&
    (evenSide(size.width, scale) !== Math.round(size.width) ||
      evenSide(size.height, scale) !== Math.round(size.height))
  ) {
    warnings.push(
      `H.264 needs even dimensions, so the frame is trimmed to ${output.width}×${output.height}.`
    );
  }

  const ratio = ratioWarning(settings.preset, size);

  if (ratio !== null) {
    warnings.push(ratio);
  }

  if (!FORMAT_SPECS[settings.format].audio) {
    warnings.push("A GIF carries no audio.");
  }

  return { output, problems, scale, warnings };
}
