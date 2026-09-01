import { describe, expect, it } from "vitest";
import {
  armInspect,
  componentAt,
  highlightTarget,
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

  function box(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>(
      "div[data-remocn-inspect][style*='border']"
    );
  }

  it("draws nothing for a target the selection never carried", () => {
    armed();
    highlightTarget("nobody");

    expect(box()?.style.display).toBe("none");
  });

  it("clears the box when the pane has nothing open", () => {
    armed();
    highlightTarget(null);

    expect(box()?.style.display).toBe("none");
  });

  // Disarming has to forget the chain, or a later selection would point at
  // nodes from a page that has since been rebuilt.
  it("survives being called with no session at all", () => {
    armInspect(false, STAGE);

    expect(() => highlightTarget("anything")).not.toThrow();
  });
});
