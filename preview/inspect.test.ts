import { afterEach, describe, expect, it } from "bun:test";
import {
  armInspect,
  clearSelection,
  componentAt,
  highlightTarget,
  nameOf,
  type Stage,
} from "./inspect";

const STAGE: Stage = {
  composition: () => "main",
  fps: () => 30,
  frame: () => 0,
};

describe("armInspect", () => {
  it("forces canvas hit-testing on only while armed", () => {
    const canvas = document.createElement("div");
    canvas.className = "__remotion-player";
    document.body.append(canvas);

    expect(armInspect(true, STAGE)).toBe("no-grab");

    const style = document.head.querySelector("style[data-remocn-inspect]");
    expect(style?.textContent).toContain("pointer-events: auto !important");
    expect(style?.textContent).toContain(".__remotion-player");

    expect(armInspect(false, STAGE)).toBe("disarmed");
    expect(
      document.head.querySelector("style[data-remocn-inspect]")
    ).toBeNull();

    canvas.remove();
  });

  it("reports no-canvas without touching the document", () => {
    expect(armInspect(true, STAGE)).toBe("no-canvas");
    expect(
      document.head.querySelector("style[data-remocn-inspect]")
    ).toBeNull();
  });
});

describe("what a click while armed is allowed to reach", () => {
  function staged() {
    for (const stale of document.querySelectorAll(".__remotion-player")) {
      stale.remove();
    }

    const canvas = document.createElement("div");
    canvas.className = "__remotion-player";
    canvas.getBoundingClientRect = () =>
      ({
        bottom: 100,
        height: 100,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
      }) as DOMRect;

    const bar = document.createElement("div");
    const inside = document.createElement("span");
    canvas.append(inside);
    document.body.append(canvas, bar);

    return { bar, canvas, inside };
  }

  function pointAt(topmost: Element | undefined) {
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: () => (topmost === undefined ? [] : [topmost]),
      writable: true,
    });
  }

  function clicked() {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    return event;
  }

  it("hands the transport bar its own clicks back", () => {
    const { bar } = staged();
    pointAt(bar);
    armInspect(true, STAGE);

    expect(clicked().defaultPrevented).toBe(false);
  });

  it("still swallows a click that lands on the frame itself", () => {
    const { inside } = staged();
    pointAt(inside);
    armInspect(true, STAGE);

    expect(clicked().defaultPrevented).toBe(true);
  });

  it("falls back to the canvas rectangle when nothing can be hit-tested", () => {
    staged();
    pointAt(undefined);
    armInspect(true, STAGE);

    expect(clicked().defaultPrevented).toBe(true);
  });

  it("wears a crosshair only while it is armed", () => {
    const { canvas } = staged();
    canvas.style.cursor = "pointer";

    armInspect(true, STAGE);
    expect(canvas.style.cursor).toBe("crosshair");

    armInspect(false, STAGE);
    expect(canvas.style.cursor).toBe("pointer");
  });
});

describe("componentAt", () => {
  function mounted(
    ...fibers: { props?: Record<string, unknown>; type?: unknown }[]
  ) {
    let fiber: unknown = null;
    for (const each of fibers) {
      fiber = {
        memoizedProps: each.props ?? null,
        return: fiber,
        type: each.type ?? null,
      };
    }

    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: fiber,
    });

    return node;
  }

  function named(name: string) {
    return { displayName: name };
  }

  it("names the interactive component you could actually tune", () => {
    const controls = {
      componentName: "Title",
      currentRuntimeValueDotNotation: {},
      overrideId: "title-1",
      schema: {},
    };

    expect(
      componentAt(
        mounted(
          { props: { controls }, type: named("Whatever") },
          { type: "div" }
        )
      )
    ).toBe("Title");
  });

  // The label used to read `RegularSequenceRefForwardingFunction.div`, which is
  // true and useless: it is the function every `<Sequence>` renders through.
  it("walks past Remotion's plumbing to the component that is really there", () => {
    expect(
      componentAt(
        mounted(
          { type: named("RisingText") },
          { type: named("withInteractivitySchema(TitleBase)") },
          { type: named("RegularSequenceRefForwardingFunction") },
          { type: named("AbsoluteFill") },
          { type: "div" }
        )
      )
    ).toBe("RisingText");
  });

  it("has no name for a tree that is all plumbing", () => {
    expect(
      componentAt(mounted({ type: named("Sequence") }, { type: "div" }))
    ).toBeNull();
  });
});

// The pane shows one link of the chain at a time and the switcher's names —
// `<Series>`, `CameraRig` — are words, not places. The box is drawn inside the
// preview document, beside the hover box and for the same reason.
describe("highlightTarget", () => {
  function armed() {
    const canvas = document.createElement("div");
    canvas.className = "__remotion-player";
    document.body.append(canvas);
    armInspect(true, STAGE);

    return canvas;
  }

  function selectionBox(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>(
      "div[data-remocn-selection]"
    );
  }

  it("draws nothing for a target the selection never carried", () => {
    armed();
    highlightTarget("nobody");

    expect(selectionBox()?.style.display).toBe("none");
  });

  it("clears the box when the pane has nothing open", () => {
    armed();
    highlightTarget(null);

    expect(selectionBox()?.style.display).toBe("none");
  });

  it("survives being called with no session at all", () => {
    armInspect(false, STAGE);

    expect(() => highlightTarget("anything")).not.toThrow();
  });
});

describe("the selection box", () => {
  function armed() {
    const canvas = document.createElement("div");
    canvas.className = "__remotion-player";
    document.body.append(canvas);
    armInspect(true, STAGE);

    return canvas;
  }

  function boxes(): HTMLElement[] {
    return [
      ...document.body.querySelectorAll<HTMLElement>(
        "div[data-remocn-inspect]"
      ),
    ];
  }

  it("is a pair of its own, beside the hover pair", () => {
    armed();
    highlightTarget(null);

    expect(
      boxes().filter((node) => node.hasAttribute("data-remocn-selection"))
    ).toHaveLength(1);
  });

  it("stays in the document when the mode is turned off", () => {
    armed();
    highlightTarget(null);
    armInspect(false, STAGE);

    expect(
      document.body.querySelector("div[data-remocn-selection]")
    ).not.toBeNull();
  });

  it("carries a pulse rule the browser can turn off for reduced motion", () => {
    armed();
    highlightTarget(null);

    const style = document.head.querySelector("style[data-remocn-selection]");

    expect(style?.textContent).toContain("prefers-reduced-motion");
    expect(style?.textContent).toContain("remocn-selection-pulse");
  });

  it("is forgotten only when the page is rebuilt", () => {
    armed();

    expect(() => clearSelection()).not.toThrow();
    expect(
      document.body.querySelector<HTMLElement>("div[data-remocn-selection]")
        ?.style.display
    ).toBe("none");
  });
});

describe("nameOf", () => {
  function mounted(props: Record<string, unknown> | null) {
    const node = document.createElement("div");
    Object.defineProperty(node, "__reactFiber$abc123", {
      configurable: true,
      enumerable: true,
      value: { memoizedProps: props, return: null, type: null },
    });

    return node;
  }

  it("reads the name the agent wrote", () => {
    expect(
      nameOf(
        mounted({
          controls: {
            componentName: "<Interactive.Div>",
            currentRuntimeValueDotNotation: { name: "Pushed line" },
            overrideId: "div-1",
            schema: {},
          },
        })
      )
    ).toBe("Pushed line · div");
  });

  it("falls back to the component, without Remotion's brackets", () => {
    expect(
      nameOf(
        mounted({
          controls: {
            componentName: "<Interactive.Div>",
            currentRuntimeValueDotNotation: {},
            overrideId: "div-1",
            schema: {},
          },
        })
      )
    ).toBe("Div · div");
  });

  it("is the bare tag when nothing names it", () => {
    expect(nameOf(mounted(null))).toBe("div");
  });
});

afterEach(() => {
  armInspect(false, STAGE);
  clearSelection();
});
