import { afterEach, describe, expect, it } from "bun:test";
import { renderHook } from "@testing-library/react";
import { type AttentionSettings, useAttention } from "@/hooks/use-attention";
import type { AttentionReading } from "@/lib/studio/attention";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

function shim(throwing = false) {
  const posted: string[] = [];
  stubGlobal(
    "Notification",
    class {
      static permission = "granted";
      constructor(title: string, options?: { body?: string }) {
        if (throwing) {
          throw new Error("no notification center");
        }
        posted.push(`${title}: ${options?.body ?? ""}`);
      }
    }
  );
  return posted;
}

function reading(turns: Record<string, Partial<TurnState>>): AttentionReading {
  return {
    exportPhase: "idle",
    sidecarPhase: "ready",
    turns: new Map(
      Object.entries(turns).map(([id, turn]) => [id, { ...IDLE_TURN, ...turn }])
    ),
  };
}

function attention(
  first: AttentionReading,
  extra: Partial<AttentionSettings> = {}
) {
  const focus = { current: false };
  const view = renderHook(
    (props: { reading: AttentionReading }) =>
      useAttention({
        exportVideoName: null,
        isEnabled: true,
        isEventEnabled: () => true,
        isFocused: focus,
        reading: props.reading,
        videoNameOf: () => "Intro",
        ...extra,
      }),
    { initialProps: { reading: first } }
  );
  return { focus, ...view };
}

afterEach(() => {
  unstubAllGlobals();
});

describe("useAttention", () => {
  it("posts once when a turn ends while the window is away", () => {
    const posted = shim();
    const view = attention(reading({ s1: { isRunning: true } }));

    view.rerender({ reading: reading({ s1: { isRunning: false } }) });
    view.rerender({ reading: reading({ s1: { isRunning: false } }) });

    expect(posted).toEqual(["Intro: The turn finished."]);
  });

  it("posts nothing while the window is focused", () => {
    const posted = shim();
    const view = attention(reading({ s1: { isRunning: true } }));
    view.focus.current = true;

    view.rerender({ reading: reading({ s1: { isRunning: false } }) });

    expect(posted).toEqual([]);
  });

  it("posts nothing while notifications are off", () => {
    const posted = shim();
    const view = attention(reading({ s1: { isRunning: true } }), {
      isEnabled: false,
    });

    view.rerender({ reading: reading({ s1: { isRunning: false } }) });

    expect(posted).toEqual([]);
  });

  it("drops a post that fails without throwing into the caller", () => {
    shim(true);
    const view = attention(reading({ s1: { isRunning: true } }));

    expect(() =>
      view.rerender({ reading: reading({ s1: { isRunning: false } }) })
    ).not.toThrow();
  });
});
