import type { TuningField } from "@/lib/studio/preview";
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

const HANDLE_MIN_Y = -0.5;
const HANDLE_MAX_Y = 1.5;

export function withHandle(
  bezier: Bezier,
  handle: 1 | 2,
  x: number,
  y: number
): number[] {
  const next = [...bezier];
  const at = handle === 1 ? 0 : 2;

  next[at] = hundredth(Math.min(1, Math.max(0, x)));
  next[at + 1] = hundredth(Math.min(HANDLE_MAX_Y, Math.max(HANDLE_MIN_Y, y)));

  return next;
}

function hundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

// The curve card's coordinate system: a 100×100 viewBox where progress 0→1
// spans a horizontal inset and value 0→1 a vertical band, leaving headroom so
// an overshooting handle (back easings) stays inside the card.
export const CURVE_VIEW = 100;
const X_INSET = 6;
const Y_ZERO = 76;
const Y_ONE = 24;

export const CURVE_GUIDES: readonly number[] = [Y_ONE, Y_ZERO];

export function viewPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: X_INSET + x * (CURVE_VIEW - 2 * X_INSET),
    y: Y_ZERO + y * (Y_ONE - Y_ZERO),
  };
}

/** The inverse of `viewPoint`, from fractions of the rendered box. */
export function curvePoint(
  fractionX: number,
  fractionY: number
): { x: number; y: number } {
  const x = (fractionX * CURVE_VIEW - X_INSET) / (CURVE_VIEW - 2 * X_INSET);
  const y = (fractionY * CURVE_VIEW - Y_ZERO) / (Y_ONE - Y_ZERO);

  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(HANDLE_MAX_Y, Math.max(HANDLE_MIN_Y, y)),
  };
}

export function curvePath(bezier: Bezier): string {
  const start = viewPoint(0, 0);
  const first = viewPoint(bezier[0], bezier[1]);
  const second = viewPoint(bezier[2], bezier[3]);
  const end = viewPoint(1, 1);

  return `M ${start.x} ${start.y} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`;
}
