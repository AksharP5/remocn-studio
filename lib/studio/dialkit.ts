import type { TuningField } from "@/lib/studio/preview";
import {
  type Composite,
  fromPercent,
  isPercent,
  toPercent,
} from "@/lib/studio/tuning";
import type { TuningValue } from "@/shared/ipc";

export interface DialSliderSpec {
  readonly max: number;
  readonly min: number;
  readonly step: number;
  readonly unit?: string;
  readonly value: number;
}

/** dialkit's own axis notation: `[default, min, max, step]`. */
export type DialPadAxisSpec = readonly [number, number, number, number];

export interface DialPadSpec {
  readonly labels: { readonly x: string; readonly y: string };
  readonly value: { readonly x: number; readonly y: number };
  readonly x: DialPadAxisSpec;
  readonly y: DialPadAxisSpec;
}

const PADDED = new Set(["transform-origin", "translate", "uv-coordinate"]);

export function sliderOf(
  field: TuningField,
  original: TuningValue | undefined
): DialSliderSpec | null {
  if (typeof field.value !== "number") {
    return null;
  }

  if (isPercent(field)) {
    return {
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
      value: toPercent(field.value),
    };
  }

  const bounded = boundedRange(field);
  if (bounded !== null) {
    return { ...bounded, value: field.value };
  }

  if (field.type === "rotation-degrees") {
    return {
      max: 180,
      min: -180,
      step: field.step ?? 1,
      unit: "°",
      value: field.value,
    };
  }

  if (field.type === "scale") {
    return {
      max: scaleMaximum(typeof original === "number" ? original : field.value),
      min: 0,
      step: field.step ?? 0.01,
      value: field.value,
    };
  }

  return null;
}

export function valueFromSlider(
  field: TuningField,
  value: number
): TuningValue {
  return isPercent(field) ? fromPercent(value) : value;
}

export function axisSliderOf(
  field: TuningField,
  value: number,
  original: number,
  unit: string
): DialSliderSpec | null {
  const bounded = boundedRange(field);
  if (bounded !== null) {
    return { ...bounded, unit: unit || undefined, value };
  }

  switch (field.type) {
    case "rotation-css":
      return {
        max: 180,
        min: -180,
        step: field.step ?? 1,
        unit: unit || "°",
        value,
      };
    case "scale":
      return {
        max: scaleMaximum(original),
        min: 0,
        step: field.step ?? 0.01,
        unit: unit || undefined,
        value,
      };
    case "transform-origin":
      return {
        max: 100,
        min: 0,
        step: field.step ?? 1,
        unit: unit || "%",
        value,
      };
    case "translate": {
      const span = Math.max(100, Math.ceil(Math.abs(original) * 3));
      return {
        max: span,
        min: -span,
        step: field.step ?? 1,
        unit: unit || "px",
        value,
      };
    }
    case "uv-coordinate":
      return {
        max: 1,
        min: 0,
        step: field.step ?? 0.01,
        unit: unit || undefined,
        value,
      };
    default:
      return null;
  }
}

function boundedRange(
  field: TuningField
): Pick<DialSliderSpec, "max" | "min" | "step"> | null {
  if (field.min === null || field.max === null || field.max <= field.min) {
    return null;
  }

  return {
    max: field.max,
    min: field.min,
    step: field.step ?? inferredStep(field.max - field.min),
  };
}

function inferredStep(range: number): number {
  if (range <= 1) {
    return 0.01;
  }
  if (range <= 10) {
    return 0.1;
  }
  if (range <= 100) {
    return 1;
  }
  return 10;
}

function scaleMaximum(original: number): number {
  return Math.max(3, Math.ceil(Math.abs(original) * 3));
}

/**
 * A pair edited as one point rather than as two sliders.
 *
 * Only the three field types that really are a position on the frame —
 * `translate`, `transform-origin` and `uv-coordinate`. `scale` as a string is
 * two independent factors and `rotation-css` is one number, so both keep their
 * sliders. The ranges are the ones `axisSliderOf` already computed for those
 * sliders, per axis; the pad is a different instrument over the same numbers.
 */
export function padOf(
  field: TuningField,
  composite: Composite,
  original: Composite
): DialPadSpec | null {
  if (!PADDED.has(field.type) || composite.axes.length !== 2) {
    return null;
  }

  const axes = composite.axes.map((axis, index) =>
    axisSliderOf(
      field,
      axis.value,
      original.axes[index]?.value ?? axis.value,
      axis.unit
    )
  );
  const [x, y] = axes;

  if (x === null || y === null || x === undefined || y === undefined) {
    return null;
  }

  const originals = composite.axes.map(
    (axis, index) => original.axes[index]?.value ?? axis.value
  );

  return {
    labels: {
      x: composite.axes[0]?.label ?? "X",
      y: composite.axes[1]?.label ?? "Y",
    },
    value: { x: x.value, y: flipAxis(y.value, y) },
    x: [clampAxis(originals[0] ?? x.value, x), x.min, x.max, x.step],
    y: [
      flipAxis(clampAxis(originals[1] ?? y.value, y), y),
      y.min,
      y.max,
      y.step,
    ],
  };
}

/**
 * The two numbers a pad point stands for, in the value's own direction.
 *
 * A pad's Y grows upward and every one of these three field types measures it
 * downward — CSS translate and `transform-origin` from the top edge, and
 * Remotion's own `uv-coordinate`, whose `[0, 0]` is the top-left corner
 * (`getBilinearUvHandlePosition` mixes the top and bottom edges by `uv[1]`).
 * So Y is mirrored inside its own range rather than negated: `min + max - y`,
 * which for a symmetric translate span *is* a sign flip, leaves an origin's
 * 0–100 and a uv's 0–1 the right way up, and is its own inverse — the same
 * function reads the value and writes it back.
 */
export function padAxesFrom(
  pad: DialPadSpec,
  point: { readonly x: number; readonly y: number }
): [number, number] {
  return [point.x, flipAxis(point.y, spanOf(pad.y))];
}

function flipAxis(
  value: number,
  span: { readonly max: number; readonly min: number }
): number {
  return span.min + span.max - value;
}

function clampAxis(
  value: number,
  span: { readonly max: number; readonly min: number }
): number {
  return Math.min(span.max, Math.max(span.min, value));
}

function spanOf(axis: DialPadAxisSpec): { max: number; min: number } {
  return { max: axis[2], min: axis[1] };
}
