import { expect, it, spyOn } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";

it("keeps the native icon aligned with System theme changes", async () => {
  const runtime = globalThis as typeof globalThis & { isTauri?: boolean };
  const originalTauri = runtime.isTauri;
  const originalTheme = localStorage.getItem("theme");
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  let dark = false;
  Object.defineProperty(query, "matches", { get: () => dark });
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = spyOn(window, "matchMedia").mockReturnValue(query);
  const subscribe = spyOn(query, "addListener").mockImplementation(
    (listener) => {
      if (listener) {
        listeners.add(listener);
      }
    }
  );
  const unsubscribe = spyOn(query, "removeListener").mockImplementation(
    (listener) => {
      if (listener) {
        listeners.delete(listener);
      }
    }
  );
  runtime.isTauri = true;
  localStorage.setItem("theme", "system");
  const seen: unknown[] = [];
  mockIPC((command, payload) => {
    expect(command).toBe("set_app_icon");
    seen.push(payload);
  });

  const view = render(<ThemeProvider>Studio</ThemeProvider>);
  try {
    await waitFor(() => expect(seen.at(-1)).toEqual({ theme: "light" }));
    act(() => {
      dark = true;
      const event = { matches: dark } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    });
    await waitFor(() => expect(seen.at(-1)).toEqual({ theme: "dark" }));
    expect(localStorage.getItem("theme")).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  } finally {
    view.unmount();
    media.mockRestore();
    subscribe.mockRestore();
    unsubscribe.mockRestore();
    runtime.isTauri = originalTauri;
    if (originalTheme === null) {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", originalTheme);
    }
  }
});
