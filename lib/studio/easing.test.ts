import { describe, expect, it } from "bun:test";
import {
  BEZIER_PRESETS,
  bezierOfValue,
  cssBezier,
  easingKindOf,
  easingNameToBezier,
  matchPresetLabel,
  PREVIEW_SECONDS,
  presetByLabel,
  windowSeconds,
} from "@/lib/studio/easing";
import type { TuningField } from "@/lib/studio/preview";

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

describe("cssBezier", () => {
  it("spells the value the way CSS takes it", () => {
    expect(cssBezier([0.42, 0, 0.58, 1])).toBe(
      "cubic-bezier(0.42, 0, 0.58, 1)"
    );
  });
});

// The preview dot is ours, and it runs the element's own window: dialkit's
// `EasingConfig` takes a duration and — measured in 2.0 — draws nothing from
// it, so this number is the only thing that makes the dot honest.
describe("windowSeconds", () => {
  it("reads the element's window in seconds", () => {
    expect(windowSeconds({ from: 30, until: 120 }, 30)).toBe(3);
  });

  it("falls back where there is no window to read", () => {
    expect(windowSeconds(null, 30)).toBe(PREVIEW_SECONDS);
    expect(windowSeconds(undefined, 30)).toBe(PREVIEW_SECONDS);
    expect(windowSeconds({ from: 40, until: 40 }, 30)).toBe(PREVIEW_SECONDS);
    expect(windowSeconds({ from: 0, until: 60 }, 0)).toBe(PREVIEW_SECONDS);
  });

  it("keeps a very short window watchable rather than a strobe", () => {
    expect(windowSeconds({ from: 0, until: 1 }, 60)).toBe(0.15);
  });
});
