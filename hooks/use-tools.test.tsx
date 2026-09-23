import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { Composer } from "@/hooks/use-composer";
import type { PreviewControl } from "@/hooks/use-preview";
import { PRO_ONLY, type ToolSettings, useTools } from "@/hooks/use-tools";
import { PRO_FEATURES } from "@/shared/entitlement";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";

const PROJECT = "project-1";

function harness(
  options: { isDocs?: boolean; isLocked?: boolean; lockedReason?: string } = {}
) {
  const onArm = mock();
  stubGlobal("requestAnimationFrame", () => 1);
  stubGlobal("cancelAnimationFrame", () => undefined);

  const preview = {
    attachSurface: () => () => undefined,
    composition: null,
    focus: () => undefined,
    frame: 0,
    hint: null,
    isServing: true,
    pick: null,
    playing: false,
    preview: { phase: "serving" },
    restart: () => undefined,
    send: () => undefined,
    subscribe: () => () => undefined,
  } as unknown as PreviewControl;

  const composer = {
    select: mock(() => "selection-1"),
    selections: { items: [], markStale: mock() },
  } as unknown as Composer;

  const settings = (isDocs: boolean): ToolSettings => ({
    composer,
    isDocs,
    isLocked: options.isLocked ?? false,
    isMissing: false,
    isShown: true,
    isWaiting: false,
    lockedReason: options.lockedReason,
    onArm,
    openedProjectId: PROJECT,
    preview,
    previewProjectId: PROJECT,
  });

  return {
    ...renderHook(
      (props: { isDocs: boolean }) => useTools(settings(props.isDocs)),
      {
        initialProps: { isDocs: options.isDocs ?? false },
      }
    ),
    onArm,
  };
}

afterEach(() => {
  unstubAllGlobals();
  mock.restore();
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

// The two buttons are the webview's half of the Pro list; the sidecar's
// half is pinned in `sidecar/agent/plan.test.ts`.
describe("useTools on Free", () => {
  it("gates exactly the two features the plan list says it does", () => {
    expect(PRO_FEATURES).toContain("inspect");
    expect(PRO_FEATURES).toContain("snapshot");
  });

  it("disables both buttons with the Pro reason and arms nothing", () => {
    const { result } = harness({ isLocked: true });

    expect(result.current.inspect.canInspect).toBe(false);
    expect(result.current.snapshot.canSnapshot).toBe(false);
    expect(result.current.inspect.unavailable).toBe(PRO_ONLY);
    expect(result.current.snapshot.unavailable).toBe(PRO_ONLY);

    act(() => result.current.inspect.toggle());
    expect(result.current.inspect.isArmed).toBe(false);
    act(() => result.current.snapshot.toggle());
    expect(result.current.snapshot.isArmed).toBe(false);
  });

  it("words the reason for whoever is reading it", () => {
    const { result } = harness({ isLocked: true, lockedReason: "Upgrade." });

    expect(result.current.inspect.unavailable).toBe("Upgrade.");
  });

  // A click on a locked button is the way back to the trial card, which is
  // what `onArm` opens on Free.
  it("opens the trial card on a click instead", () => {
    const { onArm, result } = harness({ isLocked: true });

    act(() => result.current.inspect.toggle());
    act(() => result.current.snapshot.toggle());

    expect(onArm).toHaveBeenCalledTimes(2);
  });
});
