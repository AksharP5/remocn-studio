import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useAppIcon } from "@/hooks/use-app-icon";

const runtime = globalThis as typeof globalThis & { isTauri?: boolean };
let original: boolean | undefined;

beforeEach(() => {
  original = runtime.isTauri;
  runtime.isTauri = true;
});

afterEach(() => {
  runtime.isTauri = original;
});

describe("useAppIcon", () => {
  it("waits for a resolved theme and follows light and dark changes", async () => {
    const seen: unknown[] = [];
    mockIPC((command, payload) => {
      expect(command).toBe("set_app_icon");
      seen.push(payload);
    });
    const view = renderHook(({ theme }) => useAppIcon(theme), {
      initialProps: { theme: undefined as string | undefined },
    });
    expect(seen).toEqual([]);
    view.rerender({ theme: "system" });
    expect(seen).toEqual([]);
    view.rerender({ theme: "light" });
    await waitFor(() => expect(seen).toEqual([{ theme: "light" }]));
    view.rerender({ theme: "dark" });
    await waitFor(() =>
      expect(seen).toEqual([{ theme: "light" }, { theme: "dark" }])
    );
    view.rerender({ theme: "dark" });
    expect(seen).toHaveLength(2);
  });

  it("serializes rapid changes so an older native update cannot win", async () => {
    const first = Promise.withResolvers<void>();
    const seen: unknown[] = [];
    mockIPC((_command, payload) => {
      seen.push(payload);
      return seen.length === 1 ? first.promise : undefined;
    });
    const view = renderHook(({ theme }) => useAppIcon(theme), {
      initialProps: { theme: "light" },
    });
    await waitFor(() => expect(seen).toHaveLength(1));
    view.rerender({ theme: "dark" });
    expect(seen).toEqual([{ theme: "light" }]);
    first.resolve();
    await waitFor(() =>
      expect(seen).toEqual([{ theme: "light" }, { theme: "dark" }])
    );
  });

  it("recovers from native errors on the next theme change", async () => {
    const warning = spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const seen: unknown[] = [];
      mockIPC((_command, payload) => {
        seen.push(payload);
        if (seen.length === 1) {
          throw new Error("AppKit unavailable");
        }
      });
      const view = renderHook(({ theme }) => useAppIcon(theme), {
        initialProps: { theme: "light" },
      });
      await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
      view.rerender({ theme: "dark" });
      await waitFor(() =>
        expect(seen).toEqual([{ theme: "light" }, { theme: "dark" }])
      );
    } finally {
      warning.mockRestore();
    }
  });

  it("does not invoke native APIs in a browser preview", async () => {
    runtime.isTauri = false;
    const seen: string[] = [];
    mockIPC((command) => {
      seen.push(command);
    });
    renderHook(() => useAppIcon("light"));
    await Promise.resolve();
    expect(seen).toEqual([]);
  });
});
