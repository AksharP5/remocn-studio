import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook } from "@testing-library/react";
import { usePanes } from "@/hooks/use-panes";

function panes(hasProjects = true) {
  return renderHook(() => usePanes(null, hasProjects, false));
}

describe("usePanes", () => {
  beforeEach(() => {
    mockIPC(() => null);
  });

  it("shows the preview once there is a project to preview", () => {
    expect(panes().result.current.isPreviewShown).toBe(true);
    expect(panes(false).result.current.isPreviewShown).toBe(false);
  });

  // The panel reports a collapse, not a change of mind, so this is a set and
  // not a toggle: a report arriving while the preview is already away must not
  // put it back up.
  it("hides the preview, and saying it twice keeps it hidden", () => {
    const view = panes();

    act(() => view.result.current.hidePreview());
    expect(view.result.current.isPreviewShown).toBe(false);

    act(() => view.result.current.hidePreview());
    expect(view.result.current.isPreviewShown).toBe(false);
  });

  it("leaves the toggle able to bring it back", () => {
    const view = panes();

    act(() => view.result.current.hidePreview());
    act(() => view.result.current.togglePreview());

    expect(view.result.current.isPreviewShown).toBe(true);
  });
});

function resize(width: number) {
  act(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  });
}

describe("usePanes on a narrowing window", () => {
  beforeEach(() => {
    mockIPC(() => null);
  });

  afterEach(() => {
    resize(1440);
  });

  it("folds the sidebar, then the chat, and brings both back", () => {
    const view = panes();

    resize(1200);
    expect(view.result.current.isProjectsShown).toBe(false);
    expect(view.result.current.isChatShown).toBe(true);

    resize(700);
    expect(view.result.current.isChatShown).toBe(false);
    expect(view.result.current.isPreviewShown).toBe(true);

    resize(1440);
    expect(view.result.current.isProjectsShown).toBe(true);
    expect(view.result.current.isChatShown).toBe(true);
  });

  it("peeks the folded sidebar instead of docking it", () => {
    const view = panes();
    resize(1200);

    act(() => view.result.current.toggleProjects());
    expect(view.result.current.isProjectsPeeking).toBe(true);
    expect(view.result.current.isProjectsShown).toBe(false);

    act(() => view.result.current.toggleProjects());
    expect(view.result.current.isProjectsPeeking).toBe(false);
  });

  it("closes a peek over a sidebar hidden by hand instead of docking it", () => {
    const view = panes();

    act(() => view.result.current.toggleProjects());
    act(() => view.result.current.peekProjects(true));
    expect(view.result.current.isProjectsPeeking).toBe(true);

    act(() => view.result.current.toggleProjects());
    expect(view.result.current.isProjectsPeeking).toBe(false);
    expect(view.result.current.isProjectsShown).toBe(false);
  });

  it("keeps a sidebar hidden by hand hidden when the window widens", () => {
    const view = panes();

    act(() => view.result.current.toggleProjects());
    resize(1200);
    resize(1440);

    expect(view.result.current.isProjectsShown).toBe(false);
  });

  it("opens the folded chat over the preview and forgets it once docked", () => {
    const view = panes();
    resize(700);

    act(() => view.result.current.toggleChat());
    expect(view.result.current.isChatPeeking).toBe(true);

    resize(1000);
    expect(view.result.current.isChatShown).toBe(true);
    expect(view.result.current.isChatPeeking).toBe(false);

    resize(700);
    expect(view.result.current.isChatPeeking).toBe(false);
  });
});
