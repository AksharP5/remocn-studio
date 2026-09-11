import { describe, expect, it } from "bun:test";
import {
  type AttentionContext,
  type AttentionReading,
  attentionEvents,
} from "@/lib/studio/attention";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";

function reading(
  turns: Record<string, Partial<TurnState>> = {},
  extra: Partial<AttentionReading> = {}
): AttentionReading {
  return {
    exportPhase: "idle",
    sidecarPhase: "ready",
    turns: new Map(
      Object.entries(turns).map(([id, turn]) => [id, { ...IDLE_TURN, ...turn }])
    ),
    ...extra,
  };
}

function context(extra: Partial<AttentionContext> = {}): AttentionContext {
  return {
    exportVideoName: "Intro",
    isEnabled: true,
    isEventEnabled: () => true,
    isFocused: false,
    videoNameOf: (historyId) => (historyId === "s1" ? "Intro" : null),
    ...extra,
  };
}

const permission = (id: string) => ({
  askedAt: 1,
  id,
  input: {},
  name: "Bash",
  reason: "bash" as const,
});

describe("attentionEvents", () => {
  it("posts a turn that ended while the window is not focused", () => {
    const events = attentionEvents(
      reading({ s1: { isRunning: true } }),
      reading({ s1: { isRunning: false } }),
      context()
    );

    expect(events).toEqual([
      {
        body: "The turn finished.",
        historyId: "s1",
        kind: "turn-ended",
        title: "Intro",
      },
    ]);
  });

  it("posts nothing while the window is focused, whichever chat is open", () => {
    expect(
      attentionEvents(
        reading({ s1: { isRunning: true } }),
        reading({ s1: { isRunning: false } }),
        context({ isFocused: true })
      )
    ).toEqual([]);
  });

  it("posts nothing while notifications are off", () => {
    expect(
      attentionEvents(
        reading({ s1: { isRunning: true } }),
        reading({ s1: { isRunning: false } }),
        context({ isEnabled: false })
      )
    ).toEqual([]);
  });

  it("drops an event whose switch is off and keeps the others", () => {
    const events = attentionEvents(
      reading({ s1: { isRunning: true } }, { exportPhase: "running" }),
      reading({ s1: { isRunning: false } }, { exportPhase: "done" }),
      context({ isEventEnabled: (event) => event !== "export" })
    );

    expect(events.map((row) => row.kind)).toEqual(["turn-ended"]);
  });

  it("posts a card once, when it appears, and not on a re-render", () => {
    const waiting = reading({
      s1: { isRunning: true, permissions: [permission("p1")] },
    });

    const first = attentionEvents(
      reading({ s1: { isRunning: true } }),
      waiting,
      context()
    );
    expect(first.map((row) => row.kind)).toEqual(["waiting"]);
    expect(first[0]?.body).toBe("The agent is waiting for your answer.");

    expect(attentionEvents(waiting, waiting, context())).toEqual([]);
  });

  it("treats a source question as waiting too", () => {
    const events = attentionEvents(
      reading({ s1: { isRunning: true } }),
      reading({
        s1: {
          isRunning: true,
          sources: [
            { askedAt: 1, attempt: "a", id: "q1", name: "logo", source: "x" },
          ],
        },
      }),
      context()
    );

    expect(events.map((row) => row.kind)).toEqual(["waiting"]);
  });

  it("names the studio when the chat's video is unknown", () => {
    const events = attentionEvents(
      reading({ s9: { isRunning: true } }),
      reading({ s9: { isRunning: false } }),
      context()
    );

    expect(events[0]?.title).toBe("Remocn Studio");
  });

  it("posts an export that finished or failed, never the renderer's text", () => {
    const running = reading({}, { exportPhase: "running" });

    expect(
      attentionEvents(running, reading({}, { exportPhase: "done" }), context())
    ).toEqual([
      {
        body: "Export finished.",
        historyId: null,
        kind: "export-finished",
        title: "Intro",
      },
    ]);
    expect(
      attentionEvents(
        running,
        reading({}, { exportPhase: "failed" }),
        context()
      )[0]
    ).toMatchObject({ body: "Export failed.", kind: "export-failed" });
  });

  it("posts a sidecar that stayed down, once", () => {
    const down = reading({}, { sidecarPhase: "down" });

    expect(
      attentionEvents(
        reading({}, { sidecarPhase: "restarting" }),
        down,
        context()
      )
    ).toEqual([
      {
        body: "The studio's helper stopped.",
        historyId: null,
        kind: "sidecar-down",
        title: "Remocn Studio",
      },
    ]);
    expect(attentionEvents(down, down, context())).toEqual([]);
  });
});
