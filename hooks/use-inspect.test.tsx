import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Composer } from "@/hooks/use-composer";
import { useInspect } from "@/hooks/use-inspect";
import type { PreviewControl } from "@/hooks/use-preview";
import type {
  PreviewCommand,
  PreviewMessage,
  TuningTarget,
} from "@/lib/studio/preview";
import type { PromptElement } from "@/shared/ipc";

const ELEMENT: PromptElement = {
  column: 7,
  component: "Title",
  composition: "Main",
  file: "/Users/me/projects/my-video/src/videos/intro/index.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

const TUNING: TuningTarget = {
  componentName: "Title",
  fields: [
    {
      arrayItemType: null,
      description: null,
      group: "Parameters",
      label: "Size",
      max: null,
      maxLength: null,
      min: null,
      minLength: null,
      newItemDefault: null,
      options: [],
      path: "size",
      step: null,
      targetId: "title-1",
      type: "number",
      value: 0,
    },
    {
      arrayItemType: null,
      description: null,
      group: "Parameters",
      label: "Color",
      max: null,
      maxLength: null,
      min: null,
      minLength: null,
      newItemDefault: null,
      options: [],
      path: "color",
      step: null,
      targetId: "title-1",
      type: "color",
      value: "#000000",
    },
  ],
  targetId: "title-1",
};

const SELECTION = {
  element: ELEMENT,
  rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
  source: "remocn-preview",
  tuning: [TUNING],
  type: "selection",
} as PreviewMessage;

function harness(
  options: { isArmed?: boolean; select?: (element: unknown) => string } = {}
) {
  const sent: PreviewCommand[] = [];
  let listener: ((message: PreviewMessage) => void) | null = null;
  let raf: FrameRequestCallback | null = null;

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    raf = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    raf = null;
  });

  const preview = {
    composition: null,
    frame: 0,
    hint: null,
    isServing: true,
    pick: null,
    preview: { phase: "serving" },
    restart: () => undefined,
    send: (command: PreviewCommand) => {
      sent.push(command);
    },
    stage: { current: null },
    subscribe: (listen: (message: PreviewMessage) => void) => {
      listener = listen;
      return () => {
        listener = null;
      };
    },
  } as unknown as PreviewControl;

  const composer = {
    select: options.select ?? vi.fn(() => "selection-1"),
    selections: { items: [], markStale: vi.fn() },
  } as unknown as Composer;

  const rendered = renderHook(
    (props: { isArmed: boolean }) =>
      useInspect({
        composer,
        isArmed: props.isArmed,
        preview,
        toggle: () => undefined,
        unavailable: null,
      }),
    { initialProps: { isArmed: options.isArmed ?? true } }
  );

  return {
    ...rendered,
    commands: () => [...sent],
    deliver: (message: PreviewMessage) => {
      act(() => listener?.(message));
    },
    flush: () => {
      act(() => {
        const frame = raf;
        raf = null;
        frame?.(0);
      });
    },
    resets: () => sent.filter((command) => command.type === "tune.reset"),
    sets: () => sent.filter((command) => command.type === "tune.set"),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInspect tuning", () => {
  it("coalesces edits to one command per path per animation frame", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 10);
      result.current.changeTuning("size", 20);
      result.current.changeTuning("color", "#ffffff");
    });

    expect(sets()).toHaveLength(0);
    flush();

    const commands = sets();
    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({
      path: "size",
      targetId: "title-1",
      value: 20,
    });
    expect(commands[1]).toMatchObject({ path: "color", value: "#ffffff" });
  });

  it("keeps the draft locally until the frame flushes", () => {
    const { deliver, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 32);
    });

    const size = result.current.card?.tuning?.fields.find(
      (field) => field.path === "size"
    );
    expect(size?.value).toBe(32);
  });

  it("rolls the card back when the preview refuses a change", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 64);
    });
    flush();

    const [command] = sets();
    expect(command?.type).toBe("tune.set");
    if (command?.type !== "tune.set") {
      return;
    }

    deliver({
      error: "That value is not valid for this control.",
      ok: false,
      requestId: command.requestId,
      source: "remocn-preview",
      type: "tune.result",
    } as PreviewMessage);

    const size = result.current.card?.tuning?.fields.find(
      (field) => field.path === "size"
    );
    expect(size?.value).toBe(0);
    expect(result.current.tuningRefusal).toBe(
      "That value is not valid for this control."
    );
  });

  it("drops stashed edits when everything is reset", () => {
    const { deliver, flush, resets, result, sets } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 48);
      result.current.resetTuning();
    });
    flush();

    expect(sets()).toHaveLength(0);
    expect(resets()).toHaveLength(1);
    expect(resets()[0]).toMatchObject({ paths: [], targetId: "title-1" });
  });
});

// Remotion's markup primitives nest inside the component that renders them, so
// pointing at a word lands on the primitive while the component's own
// parameters sit one level out. The pane opens on what was pointed at and the
// ancestor is reached by switching — merging the two was the wrong answer.
const CHAINED_SELECTION: PreviewMessage = {
  element: ELEMENT,
  rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
  source: "remocn-preview",
  tuning: [
    {
      componentName: "<Interactive.Div>",
      fields: [
        { ...TUNING.fields[0], path: "style.opacity", targetId: "div-1" },
      ],
      targetId: "div-1",
    },
    {
      componentName: "Title",
      fields: [{ ...TUNING.fields[0], path: "easing", targetId: "title-1" }],
      targetId: "title-1",
    },
  ],
  type: "selection",
} as never;

describe("useInspect across the Interactive chain", () => {
  const CHAINED = CHAINED_SELECTION;

  it("opens on what was pointed at, not on its ancestors", () => {
    const { deliver, result } = harness();
    deliver(CHAINED);

    expect(result.current.card?.tuning?.targetId).toBe("div-1");
    expect(result.current.card?.targets).toHaveLength(2);
    expect(
      result.current.card?.tuning?.fields.map((field) => field.path)
    ).toEqual(["style.opacity"]);
  });

  it("reaches the component's own parameters by switching", () => {
    const { deliver, result } = harness();
    deliver(CHAINED);

    act(() => {
      result.current.openTarget(1);
    });

    expect(result.current.card?.tuning?.componentName).toBe("Title");
    expect(
      result.current.card?.tuning?.fields.map((field) => field.path)
    ).toEqual(["easing"]);
  });

  it("sends each change to the component that owns the field", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(CHAINED);

    act(() => {
      result.current.changeTuning("style.opacity", 0.5);
    });
    act(() => {
      result.current.openTarget(1);
    });
    act(() => {
      result.current.changeTuning("easing", 3);
    });
    flush();

    expect(sets()).toMatchObject([
      { path: "style.opacity", targetId: "div-1" },
      { path: "easing", targetId: "title-1" },
    ]);
  });

  // Switching is not committing: an edit made before the switch is still an
  // edit, so Reset all and the Add count both have to span the whole chain.
  it("resets every target, not only the one on screen", () => {
    const { deliver, resets, result } = harness();
    deliver(CHAINED);

    act(() => {
      result.current.resetTuning();
    });

    expect(
      resets()
        .map((command) => command.targetId)
        .toSorted((first, second) => first.localeCompare(second))
    ).toEqual(["div-1", "title-1"]);
  });
});

describe("useInspect highlights the open link of the chain", () => {
  function highlights(sent: PreviewCommand[]) {
    return sent
      .filter((command) => command.type === "highlight")
      .map((command) => (command as { targetId: string | null }).targetId);
  }

  it("points at what the pane opened on, then at what it switched to", () => {
    const harnessed = harness();
    const { deliver, result } = harnessed;
    deliver(CHAINED_SELECTION);

    act(() => {
      result.current.openTarget(1);
    });

    const sent = highlights(harnessed.commands());
    expect(sent.at(-2)).toBe("div-1");
    expect(sent.at(-1)).toBe("title-1");
  });

  // Editing a value must not repaint the box: it is keyed on the id alone.
  it("does not point again when only a value moved", () => {
    const harnessed = harness();
    const { deliver, result } = harnessed;
    deliver(CHAINED_SELECTION);

    const before = highlights(harnessed.commands()).length;
    act(() => {
      result.current.changeTuning("style.opacity", 0.5);
    });

    expect(highlights(harnessed.commands())).toHaveLength(before);
  });

  it("stops pointing once the card is gone", () => {
    const harnessed = harness();
    const { deliver, result } = harnessed;
    deliver(CHAINED_SELECTION);

    act(() => {
      result.current.cancelComment();
    });

    expect(highlights(harnessed.commands()).at(-1)).toBeNull();
  });
});

// Reaching the next element used to mean closing the pane first: the card
// froze the page against hover flicker and took the click with it.
describe("useInspect picking again with the pane open", () => {
  const OTHER: PreviewMessage = {
    element: ELEMENT,
    rect: { height: 0.1, width: 0.2, x: 0.5, y: 0.5 },
    source: "remocn-preview",
    tuning: [{ ...TUNING, componentName: "Caption", targetId: "caption-1" }],
    type: "selection",
  } as never;

  it("replaces the open card with the element just picked", () => {
    const { deliver, result } = harness();
    deliver(SELECTION);
    deliver(OTHER);

    expect(result.current.card?.tuning?.componentName).toBe("Caption");
  });

  // The drafts live in the preview keyed by target, so a card dropped without
  // reverting leaves the frame showing values nothing lists any more.
  it("reverts what was pending on the element it left", () => {
    const { deliver, flush, resets, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver(OTHER);

    expect(resets().at(-1)).toMatchObject({ paths: [], targetId: "title-1" });
  });

  it("leaves a second click on the same element alone", () => {
    const { deliver, flush, resets, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver(SELECTION);

    expect(resets()).toHaveLength(0);
    const size = result.current.card?.tuning?.fields.find(
      (field) => field.path === "size"
    );
    expect(size?.value).toBe(24);
  });
});

// Turning the mode off means "stop picking", not "throw away what I picked":
// the values are live in the frame and on their way to the composer.
describe("useInspect when the mode is turned off", () => {
  it("keeps the pane on the last component it was opened for", () => {
    const { deliver, result, rerender } = harness({ isArmed: true });
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    rerender({ isArmed: false });

    expect(result.current.isArmed).toBe(false);
    expect(result.current.card?.tuning?.componentName).toBe("Title");
    const size = result.current.card?.tuning?.fields.find(
      (field) => field.path === "size"
    );
    expect(size?.value).toBe(24);
  });

  it("reverts nothing on the way out — Cancel and Add are the ways out", () => {
    const { deliver, resets, rerender } = harness({ isArmed: true });
    deliver(SELECTION);
    rerender({ isArmed: false });

    expect(resets()).toHaveLength(0);
  });
});

// The pane stays on what was just added: the values are what the message asks
// for, and the next thought about the same element should not need a re-pick.
describe("useInspect after Add", () => {
  it("keeps the pane open on the element it just sent", () => {
    const { deliver, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
      result.current.submitComment("bigger");
    });

    expect(result.current.card?.tuning?.componentName).toBe("Title");
  });

  // Otherwise the second message would ask for the first one's change again.
  it("rebases the baseline, so a second Add carries only what is new", () => {
    const selected: unknown[] = [];
    const { deliver, result } = harness({
      select: (element: unknown) => {
        selected.push(element);
        return `selection-${selected.length}`;
      },
    });
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
      result.current.submitComment("bigger");
    });
    act(() => {
      result.current.submitComment("and again");
    });

    expect(
      (selected[0] as { tuningChanges?: unknown[] }).tuningChanges
    ).toHaveLength(1);
    expect(
      (selected[1] as { tuningChanges?: unknown[] }).tuningChanges
    ).toBeUndefined();
  });

  // An added card's values are the request; leaving it must not undo them.
  it("does not revert what it added when the pick moves on", () => {
    const { deliver, resets, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
      result.current.submitComment("bigger");
    });
    deliver({
      ...(SELECTION as Record<string, unknown>),
      tuning: [{ ...TUNING, componentName: "Caption", targetId: "caption-1" }],
    } as never);

    expect(resets()).toHaveLength(0);
  });
});
