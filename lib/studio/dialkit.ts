import type { TuningField } from "@/lib/studio/preview";
import { fromPercent, isPercent, toPercent } from "@/lib/studio/tuning";
import type { TuningValue } from "@/shared/ipc";

export interface DialSliderSpec {
  readonly max: number;
  readonly min: number;
  readonly step: number;
  readonly unit?: string;
  readonly value: number;
}

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
