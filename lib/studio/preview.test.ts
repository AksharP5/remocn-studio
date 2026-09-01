import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodePreviewCommand,
  decodePreviewMessage,
  inspectCommand,
  originOf,
  seekCommand,
  snapshotCommand,
  tuneResetCommand,
  tuneSetCommand,
} from "./preview";

const picked = {
  compositionId: "Main",
  compositions: ["Main", "Intro", "Outro"],
  reason: "main",
  source: "remocn-preview",
  total: 3,
  type: "composition",
  unmeasured: false,
};

const nothingRegistered = {
  compositionId: null,
  compositions: [],
  reason: "none",
  source: "remocn-preview",
  total: 0,
  type: "composition",
  unmeasured: false,
};

const selected = {
  element: {
    column: 7,
    component: "TitleCard",
    composition: "Main",
    file: "/Users/me/video/src/TitleCard.tsx",
    fps: 30,
    frame: 42,
    html: "<h1>Hello</h1>",
    line: 12,
    scene: { durationInFrames: 90, frame: 12, from: 30, name: "TitleCard" },
    stack: ["TitleCard (/Users/me/video/src/TitleCard.tsx:12:7)"],
  },
  rect: { height: 0.2, width: 0.5, x: 0.25, y: 0.4 },
  source: "remocn-preview",
  tuning: [],
  type: "selection",
};

const captured = {
  composition: "Main",
  frame: 42,
  rect: null,
  source: "remocn-preview",
  type: "capture",
};

describe("decodePreviewMessage", () => {
  it("accepts what the preview entry posts when it picked Main", () => {
    expect(Exit.isSuccess(decodePreviewMessage(picked))).toBe(true);
  });

  it("accepts what the preview entry posts when the project registers none", () => {
    expect(Exit.isSuccess(decodePreviewMessage(nothingRegistered))).toBe(true);
  });

  it("accepts a composition matched from the opened folder", () => {
    const decoded = decodePreviewMessage({
      ...picked,
      compositionId: "introducing-opus-5",
      reason: "folder",
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("accepts a first-composition fallback with unresolved metadata", () => {
    const decoded = decodePreviewMessage({
      ...picked,
      compositionId: "Intro",
      reason: "first",
      unmeasured: true,
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("ignores messages from anything but the preview", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...picked, source: "webpack" }))
    ).toBe(true);
  });

  it("ignores a pick the hint does not know how to explain", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...picked, reason: "whatever" }))
    ).toBe(true);
  });

  it("ignores a message missing a field the hint reads", () => {
    const { unmeasured, ...withoutUnmeasured } = picked;

    expect(Exit.isFailure(decodePreviewMessage(withoutUnmeasured))).toBe(true);
    expect(unmeasured).toBe(false);
  });

  it("ignores a message with no type at all", () => {
    const { type, ...untyped } = picked;

    expect(Exit.isFailure(decodePreviewMessage(untyped))).toBe(true);
    expect(type).toBe("composition");
  });

  it("accepts a selection with everything the entry resolved", () => {
    const decoded = decodePreviewMessage(selected);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.element.line
    ).toBe(12);
  });

  it("accepts a selection whose source could not be resolved", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      element: {
        ...selected.element,
        column: null,
        component: null,
        file: null,
        line: null,
        scene: null,
        stack: [],
      },
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
  });

  it("refuses a selection with no rectangle to draw a marker on", () => {
    const { rect, ...withoutRect } = selected;

    expect(Exit.isFailure(decodePreviewMessage(withoutRect))).toBe(true);
    expect(rect.x).toBe(0.25);
  });

  it("refuses a selection whose file is an empty string", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      element: { ...selected.element, file: "" },
    });

    expect(Exit.isFailure(decoded)).toBe(true);
  });

  it("accepts the answer the entry sends back when Inspect is armed", () => {
    const decoded = decodePreviewMessage({
      paused: true,
      source: "remocn-preview",
      status: "armed",
      type: "inspect",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "inspect" &&
        decoded.value.status
    ).toBe("armed");
  });

  it("accepts every reason the entry has for not arming", () => {
    for (const status of ["disarmed", "no-canvas", "no-grab"]) {
      expect(
        Exit.isSuccess(
          decodePreviewMessage({
            paused: false,
            source: "remocn-preview",
            status,
            type: "inspect",
          })
        )
      ).toBe(true);
    }
  });

  it("refuses an inspect answer with a status nobody wrote", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          paused: true,
          source: "remocn-preview",
          status: "probably-fine",
          type: "inspect",
        })
      )
    ).toBe(true);
  });

  it("accepts the answer the entry sends back when Snapshot is armed", () => {
    const decoded = decodePreviewMessage({
      paused: true,
      source: "remocn-preview",
      status: "armed",
      type: "snapshot",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "snapshot" &&
        decoded.value.status
    ).toBe("armed");
  });

  it("refuses a snapshot answer blaming grab, which it never uses", () => {
    expect(
      Exit.isFailure(
        decodePreviewMessage({
          paused: true,
          source: "remocn-preview",
          status: "no-grab",
          type: "snapshot",
        })
      )
    ).toBe(true);
  });

  it("accepts a whole-frame capture, which carries no rectangle", () => {
    const decoded = decodePreviewMessage(captured);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "capture" &&
        decoded.value.rect
    ).toBeNull();
  });

  it("accepts a capture of the part that was dragged", () => {
    const decoded = decodePreviewMessage({
      ...captured,
      rect: { height: 0.25, width: 0.5, x: 0.25, y: 0.5 },
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "capture" &&
        decoded.value.rect?.width
    ).toBe(0.5);
  });

  it("refuses a capture of a frame that is not a whole number", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...captured, frame: 4.5 }))
    ).toBe(true);
  });

  it("refuses a capture with no composition to render", () => {
    expect(
      Exit.isFailure(decodePreviewMessage({ ...captured, composition: "" }))
    ).toBe(true);
  });

  it("accepts the rebuild notice that clears the markers", () => {
    expect(
      Exit.isSuccess(
        decodePreviewMessage({ source: "remocn-preview", type: "rebuilt" })
      )
    ).toBe(true);
  });

  it("accepts the acknowledgement for an interactive change", () => {
    const decoded = decodePreviewMessage({
      error: null,
      ok: true,
      requestId: "tune-1",
      source: "remocn-preview",
      type: "tune.result",
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "tune.result" &&
        decoded.value.ok
    ).toBe(true);
  });
});

describe("decodePreviewCommand", () => {
  it("accepts arming and disarming inspect", () => {
    expect(Exit.isSuccess(decodePreviewCommand(inspectCommand(true)))).toBe(
      true
    );
    expect(Exit.isSuccess(decodePreviewCommand(inspectCommand(false)))).toBe(
      true
    );
  });

  it("accepts arming and disarming snapshot", () => {
    expect(Exit.isSuccess(decodePreviewCommand(snapshotCommand(true)))).toBe(
      true
    );
    expect(Exit.isSuccess(decodePreviewCommand(snapshotCommand(false)))).toBe(
      true
    );
  });

  it("keeps arming inspect and arming snapshot apart", () => {
    const decoded = decodePreviewCommand(snapshotCommand(true));

    expect(Exit.isSuccess(decoded) && decoded.value.type).toBe("snapshot");
  });

  // Hover is never suppressed now, so nothing sends a freeze and the command
  // is gone: with the pane beside the frame rather than over it, the highlight
  // is what shows the next thing to pick.
  it("no longer knows how to freeze the frame", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand({
          frozen: true,
          source: "remocn-studio",
          type: "freeze",
        })
      )
    ).toBe(true);
  });

  it("accepts a seek back to the frame a selection was made on", () => {
    const decoded = decodePreviewCommand(seekCommand(42));

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "seek" &&
        decoded.value.frame
    ).toBe(42);
  });

  it("accepts a typed live tuning update", () => {
    expect(
      Exit.isSuccess(
        decodePreviewCommand(
          tuneSetCommand("tune-1", "target-1", "style.scale", 1.2)
        )
      )
    ).toBe(true);
  });

  it("accepts resetting either one field or an entire target", () => {
    expect(
      Exit.isSuccess(
        decodePreviewCommand(
          tuneResetCommand("tune-1", "target-1", ["style.scale"])
        )
      )
    ).toBe(true);
    expect(
      Exit.isSuccess(
        decodePreviewCommand(tuneResetCommand("tune-2", "target-1", []))
      )
    ).toBe(true);
  });

  it("refuses a fractional frame", () => {
    expect(Exit.isFailure(decodePreviewCommand(seekCommand(4.5)))).toBe(true);
  });

  it("refuses a command that does not come from the app", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand({ ...inspectCommand(true), source: "elsewhere" })
      )
    ).toBe(true);
  });

  it("refuses a command the entry does not know how to obey", () => {
    expect(
      Exit.isFailure(
        decodePreviewCommand({ source: "remocn-studio", type: "explode" })
      )
    ).toBe(true);
  });
});

describe("originOf", () => {
  it("reads the origin a preview serves from", () => {
    expect(originOf("http://127.0.0.1:52341")).toBe("http://127.0.0.1:52341");
  });

  it("drops the path, so only the origin is ever compared", () => {
    expect(originOf("http://127.0.0.1:52341/index.html")).toBe(
      "http://127.0.0.1:52341"
    );
  });

  it("has no origin for something that is not a url", () => {
    expect(originOf("not a url")).toBeNull();
  });
});

describe("the selection's Interactive chain", () => {
  const target = {
    componentName: "<Interactive.Div>",
    fields: [
      {
        arrayItemType: null,
        description: null,
        group: "Layer",
        label: "Opacity",
        max: 1,
        maxLength: null,
        min: 0,
        minLength: null,
        newItemDefault: null,
        options: [],
        path: "style.opacity",
        step: 0.01,
        targetId: "div-1",
        type: "number",
        value: 1,
      },
    ],
    targetId: "div-1",
  };

  it("decodes the chain the page posts, innermost first", () => {
    const decoded = decodePreviewMessage({
      ...selected,
      tuning: [target, { ...target, componentName: "Title", targetId: "t-1" }],
    });

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning.map((each) => each.targetId)
    ).toEqual(["div-1", "t-1"]);
  });

  // Every field says which target owns it, or an edit could not be routed.
  it("refuses a field with no target of its own", () => {
    const { targetId, ...orphan } = target.fields[0] as Record<string, unknown>;

    expect(
      Exit.isFailure(
        decodePreviewMessage({
          ...selected,
          tuning: [{ ...target, fields: [orphan] }],
        })
      )
    ).toBe(true);
    expect(targetId).toBe("div-1");
  });

  it("reads a page that sent no chain at all as an empty one", () => {
    const { tuning, ...withoutTuning } = selected;
    const decoded = decodePreviewMessage(withoutTuning);

    expect(
      Exit.isSuccess(decoded) &&
        decoded.value.type === "selection" &&
        decoded.value.tuning
    ).toEqual([]);
    expect(tuning).toEqual([]);
  });
});
