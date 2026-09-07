import { beforeEach, describe, expect, it } from "bun:test";
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
