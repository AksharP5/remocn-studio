import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDock } from "@/hooks/use-dock";
import type { DockExportReading } from "@/lib/studio/dock";
import { IDLE_TURN, type TurnState } from "@/lib/studio/turns";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

interface Painted {
  badges: (number | undefined)[];
  bars: { progress?: number; status: string }[];
  titles: string[];
}

function core(): Painted {
  const painted: Painted = { badges: [], bars: [], titles: [] };
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
    if (cmd === "plugin:window|set_title") {
      painted.titles.push((payload as { value: string }).value);
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
    unstubAllGlobals();
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

  it("composes Linux native status with one title writer and clears each part independently", async () => {
    stubGlobal("navigator", { userAgent: "X11; Linux x86_64" });
    const card = {
      askedAt: 1,
      id: "p",
      input: {},
      name: "Bash",
      reason: "bash" as const,
    };
    const waiting = new Map([
      ["s1", { ...IDLE_TURN, permissions: [card, { ...card, id: "q" }] }],
    ]);
    const view = dock(running(50), waiting);
    await waitFor(() =>
      expect(painted.titles.at(-1)).toBe(
        "Remocn Studio · 2 waiting · Export 25%"
      )
    );

    view.rerender({ exporting: running(50), turns: NONE });
    await waitFor(() =>
      expect(painted.titles.at(-1)).toBe("Remocn Studio · Export 25%")
    );
    view.rerender({
      exporting: { event: null, phase: "done" },
      turns: waiting,
    });
    await waitFor(() =>
      expect(painted.titles.at(-1)).toBe("Remocn Studio · 2 waiting")
    );
    view.rerender({ exporting: { event: null, phase: "idle" }, turns: NONE });
    await waitFor(() => expect(painted.titles.at(-1)).toBe("Remocn Studio"));
    expect(painted.badges).toEqual([]);
    expect(painted.bars).toEqual([]);
  });

  it("interrupts Linux failure status when a new export begins", async () => {
    stubGlobal("navigator", { userAgent: "X11; Linux x86_64" });
    jest.useFakeTimers();
    const view = dock({ event: null, phase: "failed" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(painted.titles.at(-1)).toBe("Remocn Studio · Export failed");

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    view.rerender({ exporting: running(50), turns: NONE });
    await act(async () => {
      await Promise.resolve();
    });
    const before = painted.titles.length;
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(painted.titles).toHaveLength(before);
    expect(painted.titles.at(-1)).toBe("Remocn Studio · Export 25%");
  });

  it("clears Linux failure after three seconds even when the waiting count changes", async () => {
    stubGlobal("navigator", { userAgent: "X11; Linux x86_64" });
    jest.useFakeTimers();
    const failed: DockExportReading = { event: null, phase: "failed" };
    const view = dock(failed);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });
    const waiting = new Map([
      [
        "s1",
        {
          ...IDLE_TURN,
          permissions: [
            {
              askedAt: 1,
              id: "p",
              input: {},
              name: "Bash",
              reason: "bash" as const,
            },
          ],
        },
      ],
    ]);
    view.rerender({ exporting: failed, turns: waiting });
    await act(async () => {
      await Promise.resolve();
    });
    expect(painted.titles.at(-1)).toBe(
      "Remocn Studio · 1 waiting · Export failed"
    );

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(painted.titles.at(-1)).toBe("Remocn Studio · 1 waiting");
  });
});
