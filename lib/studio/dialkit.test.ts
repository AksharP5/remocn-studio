import { describe, expect, it } from "vitest";
import { axisSliderOf, sliderOf, valueFromSlider } from "@/lib/studio/dialkit";
import type { TuningField } from "@/lib/studio/preview";

function field(overrides: Partial<TuningField> = {}): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Parameters",
    label: "Field",
    max: null,
    maxLength: null,
    min: null,
    minLength: null,
    newItemDefault: null,
    options: [],
    path: "field",
    step: null,
    targetId: "target-1",
    type: "number",
    value: 0,
    ...overrides,
  };
}

describe("sliderOf", () => {
  it("uses declared bounds without changing the value", () => {
    expect(
      sliderOf(field({ max: 40, min: -20, step: 2, value: 12 }), 0)
    ).toEqual({
      max: 40,
      min: -20,
      step: 2,
      value: 12,
    });
  });

  it("shows opacity as percent and converts it back to a fraction", () => {
    const opacity = field({
      max: 1,
      min: 0,
      path: "style.opacity",
      step: 0.01,
      value: 0.42,
    });

    expect(sliderOf(opacity, 0)).toEqual({
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
      value: 42,
    });
    expect(valueFromSlider(opacity, 73)).toBe(0.73);
  });

  it("keeps an unbounded generic number on the fallback control", () => {
    expect(sliderOf(field({ value: 12 }), 0)).toBeNull();
  });

  it("gives scalar scale a stable range from its original value", () => {
    expect(sliderOf(field({ type: "scale", value: 1.5 }), 2)).toEqual({
      max: 6,
      min: 0,
      step: 0.01,
      value: 1.5,
    });
  });
});

describe("axisSliderOf", () => {
  it("gives zero translation a useful symmetric pixel range", () => {
    expect(axisSliderOf(field({ type: "translate" }), 0, 0, "px")).toEqual({
      max: 100,
      min: -100,
      step: 1,
      unit: "px",
      value: 0,
    });
  });

  it("preserves explicit bounds and CSS units", () => {
    expect(
      axisSliderOf(
        field({ max: 200, min: -200, step: 0.5, type: "translate" }),
        12,
        0,
        "%"
      )
    ).toEqual({ max: 200, min: -200, step: 0.5, unit: "%", value: 12 });
  });

  it("uses normalized UV coordinates", () => {
    expect(
      axisSliderOf(field({ type: "uv-coordinate" }), 0.3, 0.5, "")
    ).toEqual({
      max: 1,
      min: 0,
      step: 0.01,
      unit: undefined,
      value: 0.3,
    });
  });
});
