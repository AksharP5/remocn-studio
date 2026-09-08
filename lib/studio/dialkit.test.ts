import { describe, expect, it } from "bun:test";
import {
  axisSliderOf,
  type DialPadSpec,
  padAxesFrom,
  padOf,
  sliderOf,
  valueFromSlider,
} from "@/lib/studio/dialkit";
import type { TuningField } from "@/lib/studio/preview";
import { type Composite, compositeOf, withAxes } from "@/lib/studio/tuning";

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

function withAxesOf(
  composite: Composite,
  pad: DialPadSpec,
  point: { x: number; y: number }
) {
  return withAxes(composite, padAxesFrom(pad, point));
}

describe("padOf", () => {
  function padFor(
    overrides: Partial<TuningField>,
    original?: Partial<TuningField>
  ) {
    const current = field(overrides);
    const composite = compositeOf(current);
    const before = compositeOf(field({ ...overrides, ...original }));

    if (composite === null || before === null) {
      throw new Error("the value is not a pair");
    }

    return { composite, pad: padOf(current, composite, before) };
  }

  // A pad's Y grows upward; CSS translate measures it downward. The mirror is
  // `min + max - y`, which on a symmetric span is a sign flip.
  it("mirrors Y for a CSS translate and writes it back the same way", () => {
    const { composite, pad } = padFor({
      type: "translate",
      value: "12px 40px",
    });

    if (pad === null) {
      throw new Error("a translate is a pad");
    }

    expect(pad.value).toEqual({ x: 12, y: -40 });
    expect(pad.x).toEqual([12, -100, 100, 1]);
    expect(pad.y).toEqual([-40, -120, 120, 1]);
    expect(padAxesFrom(pad, { x: 12, y: -40 })).toEqual([12, 40]);
    expect(padAxesFrom(pad, { x: 30, y: 10 })).toEqual([30, -10]);
    expect(withAxesOf(composite, pad, { x: 30, y: 10 })).toBe("30px -10px");
  });

  // Mirroring inside the range rather than negating is what keeps 0–100 the
  // right way up: a `transform-origin` at the top is `0%`, and the pad's top.
  it("keeps an origin inside its own 0–100 range", () => {
    const { pad } = padFor({ type: "transform-origin", value: "50% 20%" });

    if (pad === null) {
      throw new Error("an origin is a pad");
    }

    expect(pad.value).toEqual({ x: 50, y: 80 });
    expect(pad.y).toEqual([80, 0, 100, 1]);
    expect(padAxesFrom(pad, { x: 50, y: 80 })).toEqual([50, 20]);
  });

  // Remotion's own `uv[1] = 0` is the top edge, so it mirrors like the rest.
  it("keeps a UV coordinate inside 0–1", () => {
    const { composite, pad } = padFor({
      type: "uv-coordinate",
      value: [0.25, 0.75],
    });

    if (pad === null) {
      throw new Error("a uv coordinate is a pad");
    }

    expect(pad.value).toEqual({ x: 0.25, y: 0.25 });
    expect(pad.y).toEqual([0.25, 0, 1, 0.01]);
    expect(withAxesOf(composite, pad, { x: 0.25, y: 0.25 })).toEqual([
      0.25, 0.75,
    ]);
  });

  // The pad's own default is where a double-click and Home land, so it is the
  // value the reset would restore — mirrored like everything else on that axis.
  it("takes its default from the original value", () => {
    const { pad } = padFor(
      { type: "translate", value: "0px 0px" },
      { value: "8px 24px" }
    );

    expect(pad?.x[0]).toBe(8);
    expect(pad?.y[0]).toBe(-24);
  });

  it("leaves scale and rotation on their sliders", () => {
    const { pad: scale } = padFor({ type: "scale", value: "1.2 0.8" });
    const { pad: rotation } = padFor({ type: "rotation-css", value: "12deg" });

    expect(scale).toBeNull();
    expect(rotation).toBeNull();
  });
});
