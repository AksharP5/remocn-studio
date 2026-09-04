import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Composer } from "@/hooks/use-composer";
import type { PreviewControl } from "@/hooks/use-preview";
import { type ToolSettings, useTools } from "@/hooks/use-tools";

const PROJECT = "project-1";

function harness(options: { isDocs?: boolean } = {}) {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);

  const preview = {
    composition: null,
    frame: 0,
    hint: null,
    isServing: true,
    pick: null,
    playing: false,
    preview: { phase: "serving" },
    restart: () => undefined,
    send: () => undefined,
    stage: { current: null },
    subscribe: () => () => undefined,
  } as unknown as PreviewControl;

  const composer = {
    select: vi.fn(() => "selection-1"),
    selections: { items: [], markStale: vi.fn() },
  } as unknown as Composer;

  const settings = (isDocs: boolean): ToolSettings => ({
    composer,
    isDocs,
    isMissing: false,
    isShown: true,
    isWaiting: false,
    openedProjectId: PROJECT,
    preview,
    previewProjectId: PROJECT,
  });

  return renderHook(
    (props: { isDocs: boolean }) => useTools(settings(props.isDocs)),
    {
      initialProps: { isDocs: options.isDocs ?? false },
    }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useTools in Docs", () => {
  it("arms Inspect while the pane is showing the preview", () => {
    const { result } = harness();

    act(() => result.current.inspect.toggle());

    expect(result.current.inspect.isArmed).toBe(true);
  });

  // The mode's tools point at pixels that are no longer on screen, so moving
  // to Docs disarms whatever was armed, down the path a rebuild takes.
  it("disarms Inspect when the pane moves to the documents", () => {
    const { rerender, result } = harness();

    act(() => result.current.inspect.toggle());
    expect(result.current.inspect.isArmed).toBe(true);

    rerender({ isDocs: true });

    expect(result.current.inspect.isArmed).toBe(false);
    expect(result.current.inspect.canInspect).toBe(false);
    expect(result.current.inspect.unavailable).toBe(
      "The pane is showing the documents."
    );
  });

  it("refuses to arm Snapshot while the documents are on screen", () => {
    const { result } = harness({ isDocs: true });

    act(() => result.current.snapshot.toggle());

    expect(result.current.snapshot.isArmed).toBe(false);
    expect(result.current.snapshot.canSnapshot).toBe(false);
  });
});
