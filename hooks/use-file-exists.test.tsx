import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useFileExists } from "@/hooks/use-file-exists";

describe("useFileExists", () => {
  it("answers for the path it was asked about and nothing when there is none", async () => {
    const asked: unknown[] = [];
    mockIPC((command, payload) => {
      expect(command).toBe("path_exists");
      const { path } = payload as { path: string };
      asked.push(path);
      return path === "/out/Intro.mp4";
    });
    const view = renderHook(({ path }) => useFileExists(path), {
      initialProps: { path: null as string | null },
    });
    expect(view.result.current).toBe(false);
    expect(asked).toEqual([]);
    view.rerender({ path: "/out/Intro.mp4" });
    await waitFor(() => expect(view.result.current).toBe(true));
    view.rerender({ path: "/out/Outro.mp4" });
    expect(view.result.current).toBe(false);
    await waitFor(() =>
      expect(asked).toEqual(["/out/Intro.mp4", "/out/Outro.mp4"])
    );
    expect(view.result.current).toBe(false);
  });

  it("reads a failed check as no file", async () => {
    mockIPC(() => {
      throw new Error("no answer");
    });
    const view = renderHook(() => useFileExists("/out/Intro.mp4"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.result.current).toBe(false);
  });
});
