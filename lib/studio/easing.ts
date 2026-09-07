import type { PreviewWindow, TuningField } from "@/lib/studio/preview";
import type { TuningValue } from "@/shared/ipc";

export type Bezier = readonly [number, number, number, number];

export type EasingKind = "bezier" | "enum";

// `easing` may end any spelling — `entry.easing`, `entryEasing` — while bare
// `ease` counts only as a whole segment, or `decrease` and `release` would
// grow curves.
const EASING_PATH = /((^|\.)ease|easing)$/i;
const NOT_LETTERS = /[^a-z]/g;

// The classic Penner approximations, [in, out, inOut] per family — the names
// a component's enum is most likely to spell, in whatever casing.
const FAMILIES: Readonly<Record<string, readonly [Bezier, Bezier, Bezier]>> = {
  back: [
    [0.6, -0.28, 0.735, 0.045],
    [0.175, 0.885, 0.32, 1.275],
    [0.68, -0.55, 0.265, 1.55],
  ],
  circ: [
    [0.6, 0.04, 0.98, 0.335],
    [0.075, 0.82, 0.165, 1],
    [0.785, 0.135, 0.15, 0.86],
  ],
  cubic: [
    [0.55, 0.055, 0.675, 0.19],
    [0.215, 0.61, 0.355, 1],
    [0.645, 0.045, 0.355, 1],
  ],
  expo: [
    [0.95, 0.05, 0.795, 0.035],
    [0.19, 1, 0.22, 1],
    [1, 0, 0, 1],
  ],
  quad: [
    [0.55, 0.085, 0.68, 0.53],
    [0.25, 0.46, 0.45, 0.94],
    [0.455, 0.03, 0.515, 0.955],
  ],
  quart: [
    [0.895, 0.03, 0.685, 0.22],
    [0.165, 0.84, 0.44, 1],
    [0.77, 0, 0.175, 1],
  ],
  quint: [
    [0.755, 0.05, 0.855, 0.06],
    [0.23, 1, 0.32, 1],
    [0.86, 0, 0.07, 1],
  ],
  sine: [
    [0.47, 0, 0.745, 0.715],
    [0.39, 0.575, 0.565, 1],
    [0.445, 0.05, 0.55, 0.95],
  ],
};

const DIRECTIONS = ["in", "out", "inout"] as const;

function buildLookup(): ReadonlyMap<string, Bezier> {
  const lookup = new Map<string, Bezier>();

  lookup.set("linear", [0, 0, 1, 1]);
  lookup.set("ease", [0.25, 0.1, 0.25, 1]);
  lookup.set("easein", [0.42, 0, 1, 1]);
  lookup.set("in", [0.42, 0, 1, 1]);
  lookup.set("easeout", [0, 0, 0.58, 1]);
  lookup.set("out", [0, 0, 0.58, 1]);
  lookup.set("easeinout", [0.42, 0, 0.58, 1]);
  lookup.set("inout", [0.42, 0, 0.58, 1]);

  for (const [family, curves] of Object.entries(FAMILIES)) {
    DIRECTIONS.forEach((direction, index) => {
      const curve = curves[index] as Bezier;
      lookup.set(`${family}${direction}`, curve);
      lookup.set(`ease${direction}${family}`, curve);
    });
  }

  return lookup;
}

const LOOKUP = buildLookup();

export const BEZIER_PRESETS: readonly { label: string; value: Bezier }[] = [
  { label: "Linear", value: [0, 0, 1, 1] },
  { label: "Ease", value: [0.25, 0.1, 0.25, 1] },
  { label: "Ease In", value: [0.42, 0, 1, 1] },
  { label: "Ease Out", value: [0, 0, 0.58, 1] },
  { label: "Ease In & Out", value: [0.42, 0, 0.58, 1] },
  { label: "Cubic In", value: [0.55, 0.055, 0.675, 0.19] },
  { label: "Cubic Out", value: [0.215, 0.61, 0.355, 1] },
  { label: "Cubic In & Out", value: [0.645, 0.045, 0.355, 1] },
  { label: "Expo Out", value: [0.19, 1, 0.22, 1] },
  { label: "Back Out", value: [0.175, 0.885, 0.32, 1.275] },
];

export function easingNameToBezier(name: string): Bezier | null {
  return LOOKUP.get(name.toLowerCase().replace(NOT_LETTERS, "")) ?? null;
}

export function bezierOfValue(value: TuningValue): Bezier | null {
  if (typeof value === "string") {
    return easingNameToBezier(value);
  }

  if (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  ) {
    return value as unknown as Bezier;
  }

  return null;
}

export function easingKindOf(field: TuningField): EasingKind | null {
  if (!EASING_PATH.test(field.path)) {
    return null;
  }

  if (field.type === "enum") {
    return "enum";
  }

  if (
    field.type === "array" &&
    field.arrayItemType === "number" &&
    bezierOfValue(field.value) !== null
  ) {
    return "bezier";
  }

  return null;
}

export function matchPresetLabel(bezier: Bezier): string | null {
  const hit = BEZIER_PRESETS.find((preset) =>
    preset.value.every((entry, at) => Math.abs(entry - bezier[at]) < 0.001)
  );

  return hit?.label ?? null;
}

export function presetByLabel(label: string): Bezier | null {
  return BEZIER_PRESETS.find((preset) => preset.label === label)?.value ?? null;
}

export function cssBezier(bezier: Bezier): string {
  return `cubic-bezier(${bezier.join(", ")})`;
}

/**
 * How long the preview dot takes to cross, in seconds: the element's own
 * window, so the curve is watched at the speed it will really run. dialkit's
 * `EasingConfig` wants the same number and — measured in 2.0 — ignores it,
 * which is why the dot is still ours.
 */
export const PREVIEW_SECONDS = 1.8;
const SHORTEST_PREVIEW = 0.15;

export function windowSeconds(
  window: PreviewWindow | null | undefined,
  fps: number
): number {
  if (window === null || window === undefined) {
    return PREVIEW_SECONDS;
  }

  const frames = window.until - window.from;

  if (!(Number.isFinite(frames) && frames > 0 && fps > 0)) {
    return PREVIEW_SECONDS;
  }

  return Math.max(SHORTEST_PREVIEW, frames / fps);
}
