import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { PreviewControl, PreviewListener } from "@/hooks/use-preview";
import { useReconciledVideos } from "@/hooks/use-reconciled-videos";
import type { PreviewMessage } from "@/lib/studio/preview";

function message(compositions: readonly string[]): PreviewMessage {
  return {
    compositionId: compositions.at(0) ?? null,
    compositions,
    reason: compositions.length === 0 ? "none" : "first",
    source: "remocn-preview",
    total: compositions.length,
    type: "composition",
    unmeasured: false,
  };
}

function previewHarness() {
  let listener: PreviewListener = () => undefined;
  const preview = {
    subscribe: (next: PreviewListener) => {
      listener = next;
      return () => {
        listener = () => undefined;
      };
    },
  } as unknown as PreviewControl;

  return {
    deliver: (next: PreviewMessage) => listener(next),
    preview,
  };
}

describe("useReconciledVideos", () => {
  it("deduplicates a composition registry that was already reconciled", () => {
    const reconcile = mock();
    const host = previewHarness();

    renderHook(() => useReconciledVideos(host.preview, "project-1", reconcile));

    act(() => host.deliver(message(["intro", "outro"])));
    act(() => host.deliver(message(["outro", "intro"])));

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith("project-1", ["intro", "outro"]);
  });

  it("reconciles a stabilized empty composition registry immediately", () => {
    const reconcile = mock();
    const host = previewHarness();

    renderHook(() => useReconciledVideos(host.preview, "project-1", reconcile));

    act(() => host.deliver(message([])));

    expect(reconcile).toHaveBeenCalledWith("project-1", []);
  });
});
