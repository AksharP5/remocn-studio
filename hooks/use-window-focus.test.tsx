import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useWindowFocus } from "@/hooks/use-window-focus";

const internals = () =>
  (
    window as unknown as {
      __TAURI_INTERNALS__: {
        runCallback: (id: number, payload: unknown) => void;
      };
    }
  ).__TAURI_INTERNALS__;

function events() {
  const listeners = new Map<string, number>();
  let unlistened = 0;
  mockWindows("main");
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:event|listen") {
      const { event, handler } = payload as { event: string; handler: number };
      listeners.set(event, handler);
      return listeners.size;
    }
    if (cmd === "plugin:event|unlisten") {
      unlistened += 1;
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return {
    fire(event: "tauri://blur" | "tauri://focus") {
      const id = listeners.get(event);
      if (id === undefined) {
        throw new Error(`nobody listens to ${event}`);
      }
      internals().runCallback(id, { event, id, payload: null });
    },
    listeners,
    unlistened: () => unlistened,
  };
}

describe("useWindowFocus", () => {
  let core: ReturnType<typeof events>;

  beforeEach(() => {
    core = events();
  });

  it("starts focused and flips on both edges", async () => {
    const { result } = renderHook(() => useWindowFocus());

    expect(result.current.current).toBe(true);
    await waitFor(() => expect(core.listeners.has("tauri://blur")).toBe(true));

    core.fire("tauri://blur");
    expect(result.current.current).toBe(false);

    core.fire("tauri://focus");
    expect(result.current.current).toBe(true);
  });

  it("unlistens on unmount", async () => {
    const view = renderHook(() => useWindowFocus());
    await waitFor(() => expect(core.listeners.size).toBe(2));

    view.unmount();

    await waitFor(() => expect(core.unlistened()).toBe(2));
  });
});
