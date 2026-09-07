import { describe, expect, it } from "bun:test";
import type { TuningField, TuningTarget } from "@/lib/studio/preview";
import {
  compositeOf,
  fractionOf,
  fromPercent,
  hexLabel,
  isPercent,
  subtitleOf,
  titleOf,
  toPercent,
  withAxis,
} from "@/lib/studio/tuning";

function field(overrides: Partial<TuningField>): TuningField {
  return {
    arrayItemType: null,
    description: null,
    group: "Transform",
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

describe("compositeOf", () => {
  it("splits a translate into editable X and Y with their unit", () => {
    expect(
      compositeOf(
        field({
          path: "style.translate",
          type: "translate",
          value: "-12px 8px",
        })
      )
    ).toEqual({
      axes: [
        { label: "X", unit: "px", value: -12 },
        { label: "Y", unit: "px", value: 8 },
      ],
      kind: "string",
    });
  });

  it("keeps a transform origin in percent", () => {
    expect(
      compositeOf(
        field({
          path: "style.transformOrigin",
          type: "transform-origin",
          value: "50% 25%",
        })
      )?.axes
    ).toEqual([
      { label: "X", unit: "%", value: 50 },
      { label: "Y", unit: "%", value: 25 },
    ]);
  });

  // `translate: 10px` is one token that means x only, and CSS reads the
  // missing half as zero — so the panel offers both and writes both back.
  it("fills the missing half of a one-token value", () => {
    expect(
      compositeOf(
        field({ path: "style.translate", type: "translate", value: "10px" })
      )?.axes
    ).toEqual([
      { label: "X", unit: "px", value: 10 },
      { label: "Y", unit: "px", value: 0 },
    ]);
  });

  it("reads a uv coordinate as an array of two", () => {
    const composite = compositeOf(
      field({ path: "focus", type: "uv-coordinate", value: [0.25, 0.75] })
    );

    expect(composite?.kind).toBe("array");
    expect(composite?.axes.map((axis) => axis.value)).toEqual([0.25, 0.75]);
  });

  it("gives a rotation one axis and its degrees", () => {
    expect(
      compositeOf(
        field({ path: "style.rotate", type: "rotation-css", value: "45deg" })
      )?.axes
    ).toEqual([{ label: "∠", unit: "deg", value: 45 }]);
  });

  it("leaves a plain number to its own control", () => {
    expect(compositeOf(field({ type: "scale", value: 1.5 }))).toBeNull();
    expect(compositeOf(field({ type: "number", value: 4 }))).toBeNull();
  });

  it("refuses a value it cannot parse rather than guessing", () => {
    expect(
      compositeOf(
        field({
          path: "style.translate",
          type: "translate",
          value: "calc(100% - 4px) 0",
        })
      )
    ).toBeNull();
  });
});

describe("withAxis", () => {
  it("writes one axis back in the shape it came in", () => {
    const composite = compositeOf(
      field({ path: "style.translate", type: "translate", value: "-12px 8px" })
    );

    expect(composite && withAxis(composite, 1, 24)).toBe("-12px 24px");
  });

  it("keeps an array an array", () => {
    const composite = compositeOf(
      field({ path: "focus", type: "uv-coordinate", value: [0.25, 0.75] })
    );

    expect(composite && withAxis(composite, 0, 0.5)).toEqual([0.5, 0.75]);
  });

  // A zero may drop its unit, and a non-zero may not — so the unit comes from
  // whichever half declared one, and from the type when neither did.
  it("supplies the unit a bare zero left out", () => {
    const composite = compositeOf(
      field({ path: "style.translate", type: "translate", value: "0 0" })
    );

    expect(composite && withAxis(composite, 0, 10)).toBe("10px 0px");
  });

  it("does not leave a trailing zero on a fractional axis", () => {
    const composite = compositeOf(
      field({ path: "style.translate", type: "translate", value: "0px 0px" })
    );

    expect(composite && withAxis(composite, 0, 0.300_000_000_000_000_04)).toBe(
      "0.3px 0px"
    );
  });
});

describe("percentages and colours", () => {
  it("treats only opacity as a percentage", () => {
    expect(isPercent(field({ max: 1, min: 0, path: "style.opacity" }))).toBe(
      true
    );
    expect(isPercent(field({ max: 1, min: 0, path: "progress" }))).toBe(false);
    expect(isPercent(field({ max: 40, min: 0, path: "opacity" }))).toBe(false);
  });

  it("round-trips a percentage", () => {
    expect(toPercent(0.42)).toBe(42);
    expect(fromPercent(42)).toBe(0.42);
  });

  it("shows a hex the way a design tool does", () => {
    expect(hexLabel("#8B7BFF")).toBe("8B7BFF");
    expect(hexLabel(12)).toBe("");
  });
});

describe("fractionOf", () => {
  it("places a value inside its bounds", () => {
    expect(fractionOf(12, 0, 40)).toBe(0.3);
    expect(fractionOf(-10, -20, 0)).toBe(0.5);
  });

  it("clamps a value that escaped its bounds", () => {
    expect(fractionOf(50, 0, 40)).toBe(1);
    expect(fractionOf(-5, 0, 40)).toBe(0);
  });

  it("answers nothing without real bounds", () => {
    expect(fractionOf(12, null, 40)).toBeUndefined();
    expect(fractionOf(12, 0, null)).toBeUndefined();
    expect(fractionOf(12, 40, 40)).toBeUndefined();
  });
});

function target(overrides: Partial<TuningTarget> = {}): TuningTarget {
  return {
    componentName: "<Interactive.Div>",
    fields: [],
    identity: null,
    instanceId: '[data-design-id="claim"]',
    instances: 1,
    keys: [],
    name: null,
    ordinal: 1,
    origin: null,
    targetId: "div-1",
    where: null,
    ...overrides,
  };
}

describe("titleOf", () => {
  it("is the name the agent gave the element", () => {
    expect(titleOf(target({ name: "Pushed line" }))).toBe("Pushed line");
  });

  it("falls back to the component, without Remotion's brackets", () => {
    expect(titleOf(target())).toBe("Div");
    expect(titleOf(target({ componentName: "CameraRig" }))).toBe("CameraRig");
  });
});

describe("subtitleOf", () => {
  const owner = target({
    componentName: "withInteractivitySchema(WordPush)",
    name: "WordPush",
    targetId: "push-1",
  });
  const where = {
    column: 11,
    file: "/Users/me/video/src/components/WordPush.tsx",
    line: 245,
  };

  it("says what this is, inside what, and where that is", () => {
    expect(subtitleOf(target({ where }), owner, "/Users/me/video")).toBe(
      "Div in WordPush · src/components/WordPush.tsx:245"
    );
  });

  it("is just the location when nothing renders it", () => {
    expect(subtitleOf(target({ where }), null, "/Users/me/video")).toBe(
      "src/components/WordPush.tsx:245"
    );
  });

  it("drops the line when the source could not be resolved that far", () => {
    expect(
      subtitleOf(target({ where: { ...where, line: null } }), null, null)
    ).toBe("/Users/me/video/src/components/WordPush.tsx");
  });

  it("says so when there is no source at all", () => {
    expect(subtitleOf(target(), null, "/Users/me/video")).toBe("no source");
    expect(subtitleOf(target(), owner, "/Users/me/video")).toBe(
      "Div in WordPush"
    );
  });
});
