import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVideos } from "@/hooks/use-videos";
import type { Video } from "@/shared/ipc";

describe("useVideos", () => {
  it("is not ready in the render before the active project's first request starts", async () => {
    let finish: (videos: readonly Video[]) => void = () => undefined;
    const response = new Promise<readonly Video[]>((resolve) => {
      finish = resolve;
    });

    mockIPC((cmd) => {
      if (cmd === "sidecar_request") {
        return response;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    const rendered = renderHook(({ projectId }) => useVideos(projectId), {
      initialProps: { projectId: null as string | null },
    });

    expect(rendered.result.current.isVideosReady).toBe(true);

    rendered.rerender({ projectId: "project-1" });
    expect(rendered.result.current.isVideosReady).toBe(false);

    act(() => finish([]));

    await waitFor(() => {
      expect(rendered.result.current.isVideosReady).toBe(true);
    });
  });
});
