import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toastManager } from "@/components/ui/toast";
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
  instanceId: '[data-design-id="title"]',
  instances: 1,
  name: "Headline",
  ordinal: 1,
  targetId: "title-1",
  where: {
    column: 5,
    file: "/Users/me/projects/my-video/src/videos/intro/Title.tsx",
    line: 24,
  },
};

const SELECTION = {
  element: ELEMENT,
  fonts: [],
  rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
  repeat: false,
  source: "remocn-preview",
  text: null,
  tuning: [TUNING],
  type: "selection",
  window: { from: 30, until: 60 },
} as PreviewMessage;

const TIMED: TuningTarget = {
  ...TUNING,
  fields: [
    { ...TUNING.fields[0], group: "Entry", label: "Easing", path: "easing" },
    { ...TUNING.fields[1], group: "Fill", label: "Color", path: "color" },
  ],
};

const TIMED_SELECTION = {
  ...SELECTION,
  tuning: [TIMED],
} as PreviewMessage;

const REPLAY_DELAY = "20 millis";
const READ_INTERVAL = "20 millis";
const PAST_DELAY = 80;

const UNDO_WINDOW = "40 millis";
const PAST_WINDOW = 140;

function pause(ms: number) {
  return act(
    () =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
  );
}

interface Toasted {
  actionProps?: { onClick?: () => void };
  title?: string;
}

function harness(
  options: {
    isArmed?: boolean;
    items?: readonly unknown[];
    playing?: boolean;
    select?: (element: unknown) => string;
  } = {}
) {
  const sent: PreviewCommand[] = [];
  const toasted = vi.spyOn(toastManager, "add");
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
    playing: options.playing ?? false,
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
    selections: { items: options.items ?? [], markStale: vi.fn() },
  } as unknown as Composer;

  const rendered = renderHook(
    (props: { isArmed: boolean }) =>
      useInspect({
        composer,
        isArmed: props.isArmed,
        preview,
        readInterval: READ_INTERVAL,
        replayDelay: REPLAY_DELAY,
        toggle: () => undefined,
        unavailable: null,
        undoWindow: UNDO_WINDOW,
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
    reads: () => sent.filter((command) => command.type === "tuning.read"),
    replays: () => sent.filter((command) => command.type === "replay"),
    resets: () => sent.filter((command) => command.type === "tune.reset"),
    sets: () => sent.filter((command) => command.type === "tune.set"),
    toasts: () =>
      toasted.mock.calls.map(([given]) => given as unknown as Toasted),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    expect(result.current.tuningRefusal).toEqual({
      message: "That value is not valid for this control.",
      path: "size",
      targetId: "title-1",
    });
  });

  it("a refusal names its row and survives an ok on another row", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 64);
    });
    flush();
    deliver(
      refused(sets().at(-1), "That value is not valid for this control.")
    );

    act(() => {
      result.current.changeTuning("color", "#ffffff");
    });
    flush();
    deliver(accepted(sets().at(-1)));

    expect(result.current.tuningRefusal).toMatchObject({
      path: "size",
      targetId: "title-1",
    });

    act(() => {
      result.current.changeTuning("size", 12);
    });
    flush();
    deliver(accepted(sets().at(-1)));

    expect(result.current.tuningRefusal).toBeNull();
  });

  it("keeps a refusal when an ok arrives for a request it never tracked", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 64);
    });
    flush();
    deliver(
      refused(sets().at(-1), "That value is not valid for this control.")
    );

    deliver(accepted(undefined));

    expect(result.current.tuningRefusal).toMatchObject({
      path: "size",
      targetId: "title-1",
    });
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
    expect(resets()[0]).toMatchObject({
      paths: ["size"],
      targetId: "title-1",
    });
  });

  it("resets nothing at all when nothing moved", () => {
    const { deliver, resets, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.resetTuning();
    });

    expect(resets()).toHaveLength(0);
  });

  it("a rebuild resets what was live before closing", () => {
    const { deliver, flush, resets, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver({ source: "remocn-preview", type: "rebuilt" } as PreviewMessage);

    expect(resets()).toEqual([
      expect.objectContaining({ paths: ["size"], targetId: "title-1" }),
    ]);
    expect(result.current.card).toBeNull();
  });
});

function refused(command: PreviewCommand | undefined, error: string) {
  return {
    error,
    ok: false,
    requestId: requestIdOf(command),
    source: "remocn-preview",
    type: "tune.result",
  } as PreviewMessage;
}

function accepted(command: PreviewCommand | undefined) {
  return {
    error: null,
    ok: true,
    requestId: requestIdOf(command),
    source: "remocn-preview",
    type: "tune.result",
  } as PreviewMessage;
}

function requestIdOf(command: PreviewCommand | undefined): string {
  return command !== undefined && "requestId" in command
    ? command.requestId
    : "missing";
}

// Remotion's markup primitives nest inside the component that renders them, so
// pointing at a word lands on the primitive while the component's own
// parameters sit one level out. The pane opens on what was pointed at and the
// ancestor is reached by switching — merging the two was the wrong answer.
const CHAINED_SELECTION: PreviewMessage = {
  element: ELEMENT,
  rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
  repeat: false,
  source: "remocn-preview",
  tuning: [
    {
      ...TUNING,
      componentName: "<Interactive.Div>",
      fields: [
        { ...TUNING.fields[0], path: "style.opacity", targetId: "div-1" },
      ],
      instanceId: '[data-design-id="line-1"] > :nth-child(1)',
      targetId: "div-1",
    },
    {
      ...TUNING,
      componentName: "Title",
      fields: [{ ...TUNING.fields[0], path: "easing", targetId: "title-1" }],
      instanceId: '[data-design-id="line-1"]',
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
  it("resets every changed path in the chain", () => {
    const { deliver, flush, resets, result } = harness();
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

    act(() => {
      result.current.resetTuning();
    });

    expect(
      resets()
        .map((command) => ({
          paths: [...command.paths],
          targetId: command.targetId,
        }))
        .toSorted((first, second) =>
          first.targetId.localeCompare(second.targetId)
        )
    ).toEqual([
      { paths: ["style.opacity"], targetId: "div-1" },
      { paths: ["easing"], targetId: "title-1" },
    ]);
  });

  it("switches through the ref, so an edit in the same tick lands on it", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(CHAINED);

    act(() => {
      result.current.openTarget(1);
      result.current.changeTuning("easing", 3);
    });
    flush();

    expect(sets()).toMatchObject([{ path: "easing", targetId: "title-1" }]);
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
    expect(sent.at(-2)).toBe('[data-design-id="line-1"] > :nth-child(1)');
    expect(sent.at(-1)).toBe('[data-design-id="line-1"]');
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
    repeat: false,
    source: "remocn-preview",
    tuning: [
      {
        ...TUNING,
        componentName: "Caption",
        instanceId: '[data-design-id="caption"]',
        targetId: "caption-1",
      },
    ],
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
  it("reverts only the paths this card changed, and offers Undo", () => {
    const { deliver, flush, resets, result, toasts } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver(OTHER);

    expect(resets()).toEqual([
      expect.objectContaining({ paths: ["size"], targetId: "title-1" }),
    ]);
    expect(toasts().at(-1)?.title).toBe("Reverted 1 change on Headline");
  });

  it("Undo restores the reverted card and re-sends its values", () => {
    const { deliver, flush, result, sets, toasts } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver(OTHER);
    const sentBefore = sets().length;

    act(() => {
      toasts().at(-1)?.actionProps?.onClick?.();
    });

    expect(sets()).toHaveLength(sentBefore + 1);
    expect(result.current.card?.tuning?.componentName).toBe("Title");
    expect(
      result.current.card?.tuning?.fields.find((field) => field.path === "size")
        ?.value
    ).toBe(24);
    expect(sets().at(-1)).toMatchObject({
      path: "size",
      targetId: "title-1",
      value: 24,
    });
  });

  it("reverts what was pending on the card Undo leaves behind", () => {
    const { deliver, flush, resets, result, toasts } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver(OTHER);

    act(() => {
      result.current.changeTuning("color", "#ffffff");
    });
    flush();

    act(() => {
      toasts().at(-1)?.actionProps?.onClick?.();
    });

    expect(
      resets().map((command) => ({
        paths: [...command.paths],
        targetId: command.targetId,
      }))
    ).toContainEqual({ paths: ["color"], targetId: "caption-1" });
    expect(result.current.card?.tuning?.componentName).toBe("Title");
  });

  it("forgets the revert once the undo window has closed", async () => {
    const { deliver, flush, result, sets, toasts } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver(OTHER);
    const sentBefore = sets().length;

    await pause(PAST_WINDOW);
    act(() => {
      toasts().at(-1)?.actionProps?.onClick?.();
    });

    expect(sets()).toHaveLength(sentBefore);
    expect(result.current.card?.tuning?.componentName).toBe("Caption");
  });

  it("leaves a second click on the same instance alone", () => {
    const { deliver, flush, resets, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.changeTuning("size", 24);
    });
    flush();
    deliver({
      ...(SELECTION as Record<string, unknown>),
      repeat: true,
    } as never);

    expect(resets()).toHaveLength(0);
    const size = result.current.card?.tuning?.fields.find(
      (field) => field.path === "size"
    );
    expect(size?.value).toBe(24);
  });

  it("reopens the element the pane was cancelled on", () => {
    const { deliver, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.cancelComment();
    });
    deliver({
      ...(SELECTION as Record<string, unknown>),
      repeat: true,
    } as never);

    expect(result.current.card?.tuning?.componentName).toBe("Title");
  });

  it("opens a sibling instance rendered from the same call site", () => {
    const { deliver, result } = harness();
    deliver(SELECTION);

    deliver({
      ...(SELECTION as Record<string, unknown>),
      tuning: [
        {
          ...TUNING,
          instanceId: '[data-design-id="title"] > :nth-child(2)',
          instances: 4,
          name: "Second line",
          ordinal: 2,
        },
      ],
    } as never);

    expect(result.current.card?.tuning?.name).toBe("Second line");
    expect(result.current.card?.tuning?.ordinal).toBe(2);
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

  it("keeps markers when the mode is turned off", () => {
    const { deliver, rerender, result } = harness({
      isArmed: true,
      items: [
        {
          element: ELEMENT,
          id: "selection-1",
          rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
          stale: false,
          tuning: null,
        },
      ],
    });
    deliver(SELECTION);

    act(() => {
      result.current.submitComment("bigger");
    });
    expect(result.current.markers).toHaveLength(1);

    rerender({ isArmed: false });
    expect(result.current.markers).toHaveLength(1);
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

const RIG_FIELDS = [
  {
    ...TUNING.fields[0],
    label: "Zoom",
    path: "zoom",
    targetId: "rig-1",
    value: 1,
  },
  {
    ...TUNING.fields[0],
    label: "Easing",
    path: "easing",
    targetId: "rig-1",
    value: 0,
  },
];

function chainOn(line: string, zoom: number): PreviewMessage {
  return {
    element: ELEMENT,
    rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
    repeat: false,
    source: "remocn-preview",
    tuning: [
      {
        ...TUNING,
        componentName: "<Interactive.Div>",
        fields: [
          {
            ...TUNING.fields[0],
            path: "style.opacity",
            targetId: `${line}-1`,
            value: 1,
          },
        ],
        instanceId: `[data-design-id="${line}"]`,
        name: null,
        targetId: `${line}-1`,
      },
      {
        ...TUNING,
        componentName: "CameraRig",
        fields: RIG_FIELDS.map((field) =>
          field.path === "zoom" ? { ...field, value: zoom } : field
        ),
        instanceId: '[data-design-id="rig"]',
        name: null,
        targetId: "rig-1",
      },
    ],
    type: "selection",
  } as never;
}

describe("useInspect with a shared ancestor in both chains", () => {
  function addZoomOnFirstLine() {
    const harnessed = harness();
    const { deliver, flush, result } = harnessed;
    deliver(chainOn("line-a", 1));

    act(() => {
      result.current.openTarget(1);
    });
    act(() => {
      result.current.changeTuning("zoom", 2);
    });
    flush();
    act(() => {
      result.current.submitComment("closer");
    });

    deliver(chainOn("line-b", 2));
    act(() => {
      result.current.openTarget(1);
    });
    act(() => {
      result.current.changeTuning("easing", 5);
    });
    flush();

    return harnessed;
  }

  it("keeps a change Added from another card on a shared ancestor when this card is cancelled", () => {
    const { resets, result, sets } = addZoomOnFirstLine();

    act(() => {
      result.current.cancelComment();
    });

    expect(sets()).toMatchObject([
      { path: "zoom", targetId: "rig-1", value: 2 },
      { path: "easing", targetId: "rig-1", value: 5 },
    ]);
    expect(resets().every((command) => command.paths.length > 0)).toBe(true);
    expect(
      resets().flatMap((command) =>
        command.targetId === "rig-1" ? [...command.paths] : []
      )
    ).toEqual(["easing"]);
  });

  it("keeps it when the card is picked away from rather than cancelled", () => {
    const { deliver, resets } = addZoomOnFirstLine();

    deliver(chainOn("line-c", 2));

    expect(resets().every((command) => command.paths.length > 0)).toBe(true);
    expect(
      resets().flatMap((command) =>
        command.targetId === "rig-1" ? [...command.paths] : []
      )
    ).toEqual(["easing"]);
  });
});

describe("useInspect removing a chip from the composer", () => {
  const STORED = {
    element: ELEMENT,
    id: "selection-1",
    rect: { height: 0.2, width: 0.4, x: 0.1, y: 0.1 },
    stale: false,
    tuning: {
      fonts: ["Geist"],
      open: 1,
      originals: {
        "div-1": { "style.opacity": 1 },
        "title-1": { easing: 2, size: 0 },
      },
      targets: [
        {
          ...TUNING,
          componentName: "<Interactive.Div>",
          fields: [
            {
              ...TUNING.fields[0],
              path: "style.opacity",
              targetId: "div-1",
              value: 0.5,
            },
          ],
          instanceId: '[data-design-id="line-1"] > :nth-child(1)',
          targetId: "div-1",
        },
        {
          ...TUNING,
          componentName: "Title",
          fields: [
            { ...TUNING.fields[0], path: "easing", targetId: "title-1" },
            { ...TUNING.fields[0], path: "size", targetId: "title-1" },
          ],
          instanceId: '[data-design-id="line-1"]',
          targetId: "title-1",
        },
      ],
      text: "Ship it",
      window: { from: 408, until: 424 },
    },
  };

  it("removing a chip resets every link the message carried", () => {
    const { resets, result } = harness({ items: [STORED] });

    act(() => {
      result.current.resetSelection(0);
    });

    expect(
      resets()
        .map((command) => ({
          paths: [...command.paths],
          targetId: command.targetId,
        }))
        .toSorted((first, second) =>
          first.targetId.localeCompare(second.targetId)
        )
    ).toEqual([
      { paths: ["style.opacity"], targetId: "div-1" },
      { paths: ["easing"], targetId: "title-1" },
    ]);
  });

  it("reopens the whole chain on the link the message was written from", () => {
    const { result } = harness({ items: [STORED] });

    act(() => {
      result.current.openSelection(0);
    });

    expect(result.current.card?.targets).toHaveLength(2);
    expect(result.current.card?.tuning?.componentName).toBe("Title");
  });

  it("reopens with the window, the words and the faces it was stored with", () => {
    const { result } = harness({ items: [STORED] });

    act(() => {
      result.current.openSelection(0);
    });

    expect(result.current.card?.window).toEqual({ from: 408, until: 424 });
    expect(result.current.card?.text).toEqual({
      draft: "Ship it",
      from: "Ship it",
    });
    expect(result.current.card?.fonts).toEqual(["Geist"]);
  });
});

describe("time in the pane", () => {
  it("replays the picked element's own window on demand", () => {
    const { deliver, replays, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.replay();
    });

    expect(replays()).toEqual([
      { from: 30, source: "remocn-studio", type: "replay", until: 60 },
    ]);
  });

  it("says nothing when the element has no timed window", () => {
    const { deliver, replays, result } = harness();
    deliver({ ...SELECTION, window: null } as PreviewMessage);

    act(() => {
      result.current.replay();
    });

    expect(replays()).toHaveLength(0);
  });

  it("moves the frame from the strip", () => {
    const { commands, deliver, result } = harness();
    deliver(SELECTION);

    act(() => {
      result.current.seekTo(37);
    });

    expect(commands()).toContainEqual({
      frame: 37,
      source: "remocn-studio",
      type: "seek",
    });
  });

  it("replays once after a burst of easing edits", async () => {
    const { deliver, flush, replays, result } = harness();
    deliver(TIMED_SELECTION);

    act(() => {
      result.current.changeTuning("easing", [0.2, 0, 0.1, 1]);
    });
    flush();
    act(() => {
      result.current.changeTuning("easing", [0.3, 0, 0.1, 1]);
    });
    flush();

    await pause(PAST_DELAY);

    expect(replays()).toHaveLength(1);
  });

  it("does not replay after an edit that changes no timing", async () => {
    const { deliver, flush, replays, result } = harness();
    deliver(TIMED_SELECTION);

    act(() => {
      result.current.changeTuning("color", "#ffffff");
    });
    flush();

    await pause(PAST_DELAY);

    expect(replays()).toHaveLength(0);
  });

  it("does not replay over a preview that is already playing", async () => {
    const { deliver, flush, replays, result } = harness({ playing: true });
    deliver(TIMED_SELECTION);

    act(() => {
      result.current.changeTuning("easing", [0.2, 0, 0.1, 1]);
    });
    flush();

    await pause(PAST_DELAY);

    expect(replays()).toHaveLength(0);
  });

  it("asks the runtime what it holds once the frame has moved", () => {
    const { deliver, reads } = harness();
    deliver(SELECTION);

    deliver({
      frame: 500,
      playing: false,
      source: "remocn-preview",
      type: "playhead",
    } as PreviewMessage);

    expect(reads()).toEqual([
      {
        source: "remocn-studio",
        targetIds: ["title-1"],
        type: "tuning.read",
      },
    ]);
  });

  it("asks nothing while the frame is still the one that was picked", () => {
    const { deliver, reads } = harness();
    deliver(SELECTION);

    deliver({
      frame: ELEMENT.frame,
      playing: false,
      source: "remocn-preview",
      type: "playhead",
    } as PreviewMessage);

    expect(reads()).toHaveLength(0);
  });

  it("marks a field the runtime moves on its own and leaves a still one alone", () => {
    const { deliver, result } = harness();
    deliver(SELECTION);

    deliver({
      source: "remocn-preview",
      type: "tuning.values",
      values: [
        { path: "size", targetId: "title-1", value: 24 },
        { path: "color", targetId: "title-1", value: "#000000" },
      ],
    } as PreviewMessage);

    expect([...(result.current.card?.animated ?? [])]).toEqual([
      "title-1 size",
    ]);
  });

  it("keeps the mark on a field that is edited after it was seen moving", () => {
    const { deliver, flush, result } = harness();
    deliver(SELECTION);

    deliver({
      source: "remocn-preview",
      type: "tuning.values",
      values: [{ path: "size", targetId: "title-1", value: 24 }],
    } as PreviewMessage);

    act(() => {
      result.current.changeTuning("size", 64);
    });
    flush();

    deliver({
      source: "remocn-preview",
      type: "tuning.values",
      values: [{ path: "size", targetId: "title-1", value: 30 }],
    } as PreviewMessage);

    expect([...(result.current.card?.animated ?? [])]).toEqual([
      "title-1 size",
    ]);
    expect(result.current.tuningRefusal).toBeNull();
  });

  it("tells the agent which from values were sampled from a frame", () => {
    const select = vi.fn(() => "selection-1");
    const { deliver, flush, result } = harness({ select });
    deliver(SELECTION);

    deliver({
      source: "remocn-preview",
      type: "tuning.values",
      values: [{ path: "size", targetId: "title-1", value: 24 }],
    } as PreviewMessage);

    act(() => {
      result.current.changeTuning("size", 64);
    });
    flush();

    act(() => {
      result.current.submitComment("slower");
    });

    const [element] = select.mock.calls[0] as unknown as [
      { tuningChanges: { path: string; sampled?: boolean }[] },
    ];

    expect(element.tuningChanges).toEqual([
      expect.objectContaining({ path: "size", sampled: true }),
    ]);
  });
});

describe("the words a Remotion too old to declare them still carries", () => {
  const TEXTUAL: TuningTarget = {
    ...TUNING,
    fields: [
      ...TUNING.fields,
      {
        ...(TUNING.fields[0] as TuningTarget["fields"][number]),
        label: "Text",
        path: "children",
        type: "text-content",
        value: "Ship it",
      },
    ],
  };

  const WORDS = { ...SELECTION, text: "Ship it" } as PreviewMessage;
  const LIVE_WORDS = {
    ...SELECTION,
    text: "Ship it",
    tuning: [TEXTUAL],
  } as PreviewMessage;

  it("offers them when nothing in the runtime holds them", () => {
    const { deliver, result } = harness();
    deliver(WORDS);

    expect(result.current.card?.text).toEqual({
      draft: "Ship it",
      from: "Ship it",
    });
  });

  it("leaves them to the live field when the runtime has one", () => {
    const { deliver, result } = harness();
    deliver(LIVE_WORDS);

    expect(result.current.card?.text).toBeNull();
  });

  it("changes nothing in the preview when they are edited", () => {
    const { deliver, flush, result, sets } = harness();
    deliver(WORDS);

    act(() => {
      result.current.changeText("Ship it today");
    });
    flush();

    expect(sets()).toHaveLength(0);
    expect(result.current.card?.text?.draft).toBe("Ship it today");
  });

  it("asks the agent for them by the path the runtime would use", () => {
    const select = vi.fn(() => "selection-1");
    const { deliver, result } = harness({ select });
    deliver(WORDS);

    act(() => {
      result.current.changeText("Ship it today");
      result.current.submitComment("shorter");
    });

    const [element] = select.mock.calls[0] as unknown as [
      { tuningChanges: { owner?: { name: string }; path: string }[] },
    ];

    expect(element.tuningChanges).toEqual([
      expect.objectContaining({
        from: "Ship it",
        owner: expect.objectContaining({ name: "Headline" }),
        path: "children",
        to: "Ship it today",
      }),
    ]);
  });

  it("says nothing about words nobody touched", () => {
    const select = vi.fn(() => "selection-1");
    const { deliver, result } = harness({ select });
    deliver(WORDS);

    act(() => {
      result.current.submitComment("slower");
    });

    const [element] = select.mock.calls[0] as unknown as [
      { tuningChanges?: unknown[] },
    ];

    expect(element.tuningChanges).toBeUndefined();
  });

  it("rebases them on Add, so a second message does not ask twice", () => {
    const selected: unknown[] = [];
    const { deliver, result } = harness({
      select: (element: unknown) => {
        selected.push(element);
        return `selection-${selected.length}`;
      },
    });
    deliver(WORDS);

    act(() => {
      result.current.changeText("Ship it today");
      result.current.submitComment("shorter");
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

  it("puts them back when the whole selection is reset", () => {
    const { deliver, result } = harness();
    deliver(WORDS);

    act(() => {
      result.current.changeText("Ship it today");
    });
    act(() => {
      result.current.resetTuning();
    });

    expect(result.current.card?.text?.draft).toBe("Ship it");
  });
});
