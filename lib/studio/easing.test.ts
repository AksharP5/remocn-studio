import { describe, expect, it } from "vitest";
import {
  BEZIER_PRESETS,
  bezierOfValue,
  cssBezier,
  curvePath,
  curvePoint,
  easingKindOf,
  easingNameToBezier,
  matchPresetLabel,
  presetByLabel,
  viewPoint,
  withHandle,
} from "@/lib/studio/easing";
import type { TuningField } from "@/lib/studio/preview";

const CUBIC_SEGMENT = /^M [\d.]+ [\d.]+ C /;

function field(overrides: Partial<TuningField>): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Entry",
    label: "Easing",
    max: null,
    maxLength: null,
    min: null,
    minLength: null,
    newItemDefault: null,
    options: [],
    path: "entry.easing",
    step: null,
    targetId: "target-1",
    type: "enum",
    value: "ease-out",
    ...overrides,
  };
}

describe("easingNameToBezier", () => {
  it("reads a name in whatever casing a component spelled it", () => {
    const expected = [0.42, 0, 0.58, 1];

    expect(easingNameToBezier("ease-in-out")).toEqual(expected);
    expect(easingNameToBezier("easeInOut")).toEqual(expected);
    expect(easingNameToBezier("EASE_IN_OUT")).toEqual(expected);
  });

  it("knows the Penner families under both spellings", () => {
    expect(easingNameToBezier("easeOutCubic")).toEqual([0.215, 0.61, 0.355, 1]);
    expect(easingNameToBezier("cubic-out")).toEqual([0.215, 0.61, 0.355, 1]);
  });

  it("answers nothing for a name it does not know", () => {
    expect(easingNameToBezier("bounce")).toBeNull();
  });
});

describe("bezierOfValue", () => {
  it("takes a four-number array as it stands", () => {
    expect(bezierOfValue([0.42, 0, 0.58, 1])).toEqual([0.42, 0, 0.58, 1]);
  });

  it("refuses arrays that are not a bezier", () => {
    expect(bezierOfValue([0.42, 0, 0.58])).toBeNull();
    expect(bezierOfValue([0.42, 0, "a", 1])).toBeNull();
    expect(bezierOfValue(true)).toBeNull();
  });
});

describe("easingKindOf", () => {
  it("claims an enum whose path says easing", () => {
    expect(easingKindOf(field({ options: ["linear", "ease-out"] }))).toBe(
      "enum"
    );
    expect(easingKindOf(field({ path: "entryEasing" }))).toBe("enum");
    expect(easingKindOf(field({ path: "entry.ease" }))).toBe("enum");
  });

  it("does not read decrease or release as an easing", () => {
    expect(easingKindOf(field({ path: "decrease" }))).toBeNull();
    expect(easingKindOf(field({ path: "style.release" }))).toBeNull();
  });

  it("claims a four-number array on an easing path", () => {
    expect(
      easingKindOf(
        field({
          arrayItemType: "number",
          path: "easing",
          type: "array",
          value: [0.42, 0, 0.58, 1],
        })
      )
    ).toBe("bezier");
  });

  it("leaves other paths and other shapes alone", () => {
    expect(easingKindOf(field({ path: "emphasis" }))).toBeNull();
    expect(
      easingKindOf(field({ path: "style.opacity", type: "number", value: 1 }))
    ).toBeNull();
    expect(
      easingKindOf(
        field({
          arrayItemType: "number",
          path: "easing",
          type: "array",
          value: [0.42, 0, 0.58],
        })
      )
    ).toBeNull();
  });
});

describe("presets", () => {
  it("matches a bezier back to its preset with tolerance", () => {
    expect(matchPresetLabel([0.42, 0, 0.58, 1])).toBe("Ease In & Out");
    expect(matchPresetLabel([0.4201, 0.0001, 0.58, 1])).toBe("Ease In & Out");
    expect(matchPresetLabel([0.3, 0.3, 0.7, 0.7])).toBeNull();
  });

  it("finds a preset by its label", () => {
    for (const preset of BEZIER_PRESETS) {
      expect(presetByLabel(preset.label)).toEqual(preset.value);
    }
    expect(presetByLabel("Custom")).toBeNull();
  });
});

describe("withHandle", () => {
  it("moves one handle and rounds to hundredths", () => {
    expect(withHandle([0, 0, 1, 1], 1, 0.333_33, 0.5)).toEqual([
      0.33, 0.5, 1, 1,
    ]);
    expect(withHandle([0, 0, 1, 1], 2, 0.9, 0.9)).toEqual([0, 0, 0.9, 0.9]);
  });

  it("clamps x into the unit range and y into the overshoot range", () => {
    expect(withHandle([0, 0, 1, 1], 1, -1, 9)).toEqual([0, 1.5, 1, 1]);
    expect(withHandle([0, 0, 1, 1], 2, 2, -9)).toEqual([0, 0, 1, -0.5]);
  });
});

describe("curve geometry", () => {
  it("round-trips a point through the view mapping", () => {
    const view = viewPoint(0.42, 0.75);
    const back = curvePoint(view.x / 100, view.y / 100);

    expect(back.x).toBeCloseTo(0.42);
    expect(back.y).toBeCloseTo(0.75);
  });

  it("draws value zero below value one", () => {
    expect(viewPoint(0, 0).y).toBeGreaterThan(viewPoint(0, 1).y);
  });

  it("clamps a drag outside the card", () => {
    expect(curvePoint(-1, -1)).toEqual({ x: 0, y: 1.5 });
    expect(curvePoint(2, 2)).toEqual({ x: 1, y: -0.5 });
  });

  it("writes the curve as one cubic segment", () => {
    expect(curvePath([0, 0, 1, 1])).toMatch(CUBIC_SEGMENT);
  });
});

describe("cssBezier", () => {
  it("spells the value the way CSS takes it", () => {
    expect(cssBezier([0.42, 0, 0.58, 1])).toBe(
      "cubic-bezier(0.42, 0, 0.58, 1)"
    );
  });
});
