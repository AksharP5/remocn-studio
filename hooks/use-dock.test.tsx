import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDock } from "@/hooks/use-dock";
import type { DockExportReading } from "@/lib/studio/dock";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";

interface Painted {
  badges: (number | undefined)[];
  bars: { progress?: number; status: string }[];
}

function core(): Painted {
  const painted: Painted = { badges: [], bars: [] };
  mockWindows("main");
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:window|set_progress_bar") {
      painted.bars.push((payload as { value: Painted["bars"][number] }).value);
      return null;
    }
    if (cmd === "plugin:window|set_badge_count") {
      painted.badges.push((payload as { value?: number }).value);
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return painted;
}

const NONE = new Map<string, TurnState>();

function running(rendered: number, encoded = 0): DockExportReading {
  return {
    event: {
      encoded,
      percent: 0,
      rendered,
      stage: "encoding",
      total: 100,
      type: "progress",
    },
    phase: "running",
  };
}

const dock = (exporting: DockExportReading, turns = NONE) =>
  renderHook(
    (props: { exporting: DockExportReading; turns: Map<string, TurnState> }) =>
      useDock(props.exporting, props.turns),
    { initialProps: { exporting, turns } }
  );

describe("useDock", () => {
  let painted: Painted;

  beforeEach(() => {
    painted = core();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("paints the run and hides it when the file is written", async () => {
    const view = dock(running(50));

    await waitFor(() =>
      expect(painted.bars.at(-1)).toEqual({ progress: 25, status: "normal" })
    );

    view.rerender({ exporting: { event: null, phase: "done" }, turns: NONE });

    await waitFor(() =>
      expect(painted.bars.at(-1)).toEqual({ status: "none" })
    );
  });

  it("holds the error state for a moment, then clears it", async () => {
    jest.useFakeTimers();
    const view = dock({ event: null, phase: "failed" });

    await act(async () => {
      await Promise.resolve();
    });
    expect(painted.bars.at(-1)).toEqual({ status: "error" });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(painted.bars.at(-1)).toEqual({ status: "none" });

    view.unmount();
  });

  it("interrupts the hold when a new run starts", async () => {
    jest.useFakeTimers();
    const view = dock({ event: null, phase: "failed" });
    await act(async () => {
      await Promise.resolve();
    });

    view.rerender({ exporting: running(0), turns: NONE });
    await act(async () => {
      await Promise.resolve();
    });
    const before = painted.bars.length;

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(painted.bars.length).toBe(before);
    expect(painted.bars.at(-1)).toEqual({ progress: 0, status: "normal" });
  });

  it("writes the badge only when the count changes, and clears it", async () => {
    const card = {
      askedAt: 1,
      id: "p",
      input: {},
      name: "Bash",
      reason: "bash" as const,
    };
    const waiting = new Map([["s1", { ...IDLE_TURN, permissions: [card] }]]);
    const view = dock({ event: null, phase: "idle" }, waiting);

    await waitFor(() => expect(painted.badges).toEqual([1]));

    view.rerender({
      exporting: { event: null, phase: "idle" },
      turns: waiting,
    });
    view.rerender({
      exporting: { event: null, phase: "idle" },
      turns: new Map(waiting),
    });
    expect(painted.badges).toEqual([1]);

    view.rerender({ exporting: { event: null, phase: "idle" }, turns: NONE });

    await waitFor(() => expect(painted.badges).toEqual([1, undefined]));
  });
});
