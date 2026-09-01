import { describe, expect, it } from "vitest";
import {
  controlsAt,
  controlsChain,
  describeTuning,
  fieldAt,
  isFieldValue,
  labelFor,
  nearestInteractive,
  overridePlan,
} from "./tuning";

const SCHEMA = {
  amount: {
    default: 12,
    description: "Amount",
    max: 40,
    min: 0,
    step: 1,
    type: "number" as const,
  },
  mode: {
    default: "plain",
    description: "Mode",
    type: "enum" as const,
    variants: {
      plain: {},
      shimmer: {
        "style.translate": {
          default: "0px 12px",
          description: "Offset",
          step: 1,
          type: "translate" as const,
        },
      },
    },
  },
  stops: {
    default: [0, 1],
    item: { type: "number" as const },
    maxLength: 4,
    minLength: 2,
    newItemDefault: 0,
    type: "array" as const,
  },
} as const;

describe("describeTuning", () => {
  it("serializes supported controls with their constraints", () => {
    expect(
      describeTuning({
        componentName: "Hero",
        schema: SCHEMA,
        targetId: "hero-1",
        values: { amount: 20, mode: "plain", stops: [0, 0.5, 1] },
      })
    ).toMatchObject({
      componentName: "Hero",
      fields: [
        { max: 40, min: 0, path: "amount", type: "number", value: 20 },
        { options: ["plain", "shimmer"], path: "mode", type: "enum" },
        { maxLength: 4, minLength: 2, path: "stops", type: "array" },
      ],
      targetId: "hero-1",
    });
  });

  it("shows only the selected enum branch", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: SCHEMA,
      targetId: "hero-1",
      values: { amount: 20, mode: "shimmer", stops: [0, 1] },
    });

    expect(tuning?.fields.map((field) => field.path)).toContain(
      "style.translate"
    );
  });

  it("groups fields by what moment of the element's life they touch", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        durationInFrames: { default: 30, type: "number" },
        effectStrength: { default: 1, type: "number" },
        label: { default: "Hi", type: "color" },
        "style.translate": { default: "0px 0px", type: "translate" },
        "transitionIn.blur": { default: 4, type: "number" },
        "transitionOut.fade": { default: 1, type: "number" },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(
      Object.fromEntries(
        (tuning?.fields ?? []).map((field) => [field.path, field.group])
      )
    ).toEqual({
      durationInFrames: "Timing",
      effectStrength: "Effects",
      label: "Parameters",
      "style.translate": "Transform",
      "transitionIn.blur": "Entry",
      "transitionOut.fade": "Exit",
    });
  });

  it("sorts a design tool's groups apart", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        fillColor: { default: "#fff", type: "color" },
        hidden: { default: false, type: "boolean" },
        strokeWidth: { default: 1, type: "number" },
        "style.color": { default: "#000", type: "color" },
        "style.opacity": { default: 1, max: 1, min: 0, type: "number" },
        "style.translate": { default: "0px 0px", type: "translate" },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(
      Object.fromEntries(
        (tuning?.fields ?? []).map((field) => [field.path, field.group])
      )
    ).toEqual({
      fillColor: "Fill",
      hidden: "Layer",
      strokeWidth: "Stroke",
      "style.color": "Typography",
      "style.opacity": "Layer",
      "style.translate": "Transform",
    });
  });

  // Remotion marks `from`, `durationInFrames`, `trimBefore` and `freeze` as
  // belonging to a timeline rather than a property list, and the panel is not
  // a timeline.
  it("honours the schema's own hiddenFromList", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        amount: { default: 3, type: "number" },
        from: { default: 0, hiddenFromList: true, type: "number" },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(tuning?.fields.map((field) => field.path)).toEqual(["amount"]);
  });

  it("skips hidden and unknown future field types without failing", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: {
        amount: { default: 3, type: "number" },
        internal: { default: 1, type: "hidden" },
        novel: { default: 1, type: "holo-gradient" as never },
      },
      targetId: "hero-1",
      values: {},
    });

    expect(tuning?.fields.map((field) => field.path)).toEqual(["amount"]);
  });

  it("falls back to the schema default when no value is mounted", () => {
    const tuning = describeTuning({
      componentName: "Hero",
      schema: SCHEMA,
      targetId: "hero-1",
      values: {},
    });

    expect(tuning?.fields.find((field) => field.path === "amount")?.value).toBe(
      12
    );
  });

  it("refuses out-of-bounds numbers instead of clamping them", () => {
    const amount = fieldAt(SCHEMA, { mode: "plain" }, "amount");

    expect(amount !== null && isFieldValue(amount, 41)).toBe(false);
    expect(amount !== null && isFieldValue(amount, -1)).toBe(false);
    expect(amount !== null && isFieldValue(amount, Number.NaN)).toBe(false);
  });

  it("validates uv coordinates as bounded pairs", () => {
    const schema = {
      focus: { max: 1, min: 0, type: "uv-coordinate" as const },
    };
    const field = fieldAt(schema, {}, "focus");

    expect(field !== null && isFieldValue(field, [0.2, 0.8])).toBe(true);
    expect(field !== null && isFieldValue(field, [0.2, 1.4])).toBe(false);
    expect(field !== null && isFieldValue(field, [0.2])).toBe(false);
  });

  it("validates values against the active field and array constraints", () => {
    const amount = fieldAt(SCHEMA, { mode: "plain" }, "amount");
    const stops = fieldAt(SCHEMA, { mode: "plain" }, "stops");

    expect(amount !== null && isFieldValue(amount, 32)).toBe(true);
    expect(amount !== null && isFieldValue(amount, "32")).toBe(false);
    expect(stops !== null && isFieldValue(stops, [0, 1])).toBe(true);
    expect(stops !== null && isFieldValue(stops, [0])).toBe(false);
    expect(stops !== null && isFieldValue(stops, [0, "1"])).toBe(false);
  });
});

describe("overridePlan", () => {
  it("publishes a prop status for exactly the overridden keys", () => {
    const plan = overridePlan({ hidden: true, "style.fontSize": 120 });

    expect(plan.overrides).toEqual([
      { path: "hidden", value: true },
      { path: "style.fontSize", value: 120 },
    ]);
    expect(plan.statuses).toEqual({
      canUpdate: true,
      effects: [],
      props: {
        hidden: { codeValue: true, status: "static" },
        "style.fontSize": { codeValue: 120, status: "static" },
      },
    });
  });

  it("withdraws every status once the draft is empty, so animations run again", () => {
    const plan = overridePlan({});

    expect(plan.overrides).toEqual([]);
    expect(plan.statuses).toEqual({ canUpdate: true, effects: [], props: {} });
  });
});

describe("nearestInteractive", () => {
  function mounted() {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const leaf = document.createElement("span");
    inner.append(leaf);
    outer.append(inner);
    document.body.append(outer);
    return { inner, leaf, outer };
  }

  it("resolves the deepest registered sequence containing the element", () => {
    const { inner, leaf, outer } = mounted();
    const sequences = [
      { controls: { overrideId: "outer" }, refForOutline: { current: outer } },
      { controls: { overrideId: "inner" }, refForOutline: { current: inner } },
    ];

    expect(nearestInteractive(sequences, leaf)?.controls).toEqual({
      overrideId: "inner",
    });
  });

  it("distinguishes two instances of the same component", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);
    const sequences = [
      {
        controls: { overrideId: "title-1" },
        refForOutline: { current: first },
      },
      {
        controls: { overrideId: "title-2" },
        refForOutline: { current: second },
      },
    ];

    expect(nearestInteractive(sequences, second)?.controls).toEqual({
      overrideId: "title-2",
    });
  });

  it("ignores sequences with no controls or no mounted outline", () => {
    const { leaf, outer } = mounted();
    const sequences = [
      { controls: null, refForOutline: { current: outer } },
      { controls: { overrideId: "gone" }, refForOutline: { current: null } },
      { controls: { overrideId: "off" }, refForOutline: null },
    ];

    expect(nearestInteractive(sequences, leaf)).toBeNull();
  });
});

describe("controlsAt", () => {
  const CONTROLS = {
    componentName: "Title",
    currentRuntimeValueDotNotation: { amount: 12 },
    overrideId: "title-1",
    schema: SCHEMA,
  };

  function chain(...props: (Record<string, unknown> | null)[]) {
    let fiber: unknown = null;
    for (const memoizedProps of props) {
      fiber = { memoizedProps, return: fiber, type: null };
    }

    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: fiber,
    });

    return node;
  }

  // Remotion resolves a `<Sequence layout="none">`'s outline ref to null unless
  // the author passed `outlineRef`, so the DOM search misses a component that
  // is otherwise entirely correct. The prop is on the fiber either way.
  it("finds the controls a component passed, with no outline ref anywhere", () => {
    expect(controlsAt(chain({ controls: CONTROLS }, null))).toEqual(CONTROLS);
  });

  it("takes the innermost interactive ancestor", () => {
    const outer = { ...CONTROLS, componentName: "Scene", overrideId: "scene" };

    expect(
      controlsAt(chain({ controls: outer }, { controls: CONTROLS }, null))
    ).toEqual(CONTROLS);
  });

  it("is not fooled by other props called controls", () => {
    expect(controlsAt(chain({ controls: true }, null))).toBeNull();
    expect(
      controlsAt(chain({ controls: { overrideId: "" } }, null))
    ).toBeNull();
    expect(
      controlsAt(chain({ controls: { overrideId: "x", schema: null } }, null))
    ).toBeNull();
  });

  it("answers nothing outside a React tree", () => {
    expect(controlsAt(document.createElement("div"))).toBeNull();
  });
});

describe("controlsChain", () => {
  function chainOf(...props: (Record<string, unknown> | null)[]) {
    let fiber: unknown = null;
    for (const memoizedProps of props) {
      fiber = { memoizedProps, return: fiber, type: null };
    }

    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: fiber,
    });

    return node;
  }

  const div = {
    componentName: "<Interactive.Div>",
    currentRuntimeValueDotNotation: {},
    overrideId: "div-1",
    schema: {},
  };
  const title = {
    componentName: "Title",
    currentRuntimeValueDotNotation: {},
    overrideId: "title-1",
    schema: {},
  };

  // The conventions ask for both wrappers, so this nesting is the normal shape
  // of agent-written markup — not an edge case.
  it("collects every interactive around the element, innermost first", () => {
    expect(
      controlsChain(chainOf({ controls: title }, { controls: div }, null)).map(
        (each) => each.controls.overrideId
      )
    ).toEqual(["div-1", "title-1"]);
  });

  it("counts one interactive once, however many fibers carry its controls", () => {
    expect(
      controlsChain(chainOf({ controls: div }, { controls: div }, null))
    ).toHaveLength(1);
  });
});

describe("labelFor", () => {
  // Remotion's own built-ins describe themselves in two words, and those read
  // better than the path would.
  it("takes a short description as the label", () => {
    expect(labelFor("Font size", "style.fontSize")).toBe("Font size");
    expect(labelFor("Opacity", "style.opacity")).toBe("Opacity");
  });

  // What an agent writes is prose, and prose is not a label whatever the pane
  // does with it — it belongs under the control.
  it("falls back to the prop's own name when the description is a sentence", () => {
    expect(
      labelFor(
        "Frames per drift cycle — kept coprime with the ambient periods",
        "driftCycleFrames"
      )
    ).toBe("Drift cycle frames");
    expect(labelFor("Horizontal drift amplitude in pixels", "driftX")).toBe(
      "Drift x"
    );
  });

  it("names the prop when there is no description at all", () => {
    expect(labelFor(undefined, "style.transformOrigin")).toBe(
      "Transform origin"
    );
    expect(labelFor("", "easing")).toBe("Easing");
  });
});
