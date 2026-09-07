import { afterEach, describe, expect, it, mock } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDeepLinks } from "@/hooks/use-deep-links";
import { DEEP_LINK_EVENT } from "@/shared/ipc";

const LINK = "remocn-studio://open-template?template=welcome-early-member";

const internals = () =>
  (
    window as unknown as {
      __TAURI_INTERNALS__: {
        runCallback: (id: number, payload: unknown) => void;
      };
    }
  ).__TAURI_INTERNALS__;

// The core's queue, as the webview sees it: `take_deep_links` empties it, and
// the event only says there is something to take.
function fakeCore(queue: string[]) {
  const listeners = new Map<string, number>();
  let takes = 0;

  mockIPC((cmd, payload) => {
    if (cmd === "take_deep_links") {
      takes += 1;
      return queue.splice(0, queue.length);
    }
    if (cmd === "plugin:event|listen") {
      const { event, handler } = payload as { event: string; handler: number };
      listeners.set(event, handler);
      return 1;
    }
  });

  return {
    push(url: string) {
      queue.push(url);
      const id = listeners.get(DEEP_LINK_EVENT);
      if (id !== undefined) {
        internals().runCallback(id, {
          event: DEEP_LINK_EVENT,
          id,
          payload: null,
        });
      }
    },
    takes: () => takes,
  };
}

describe("useDeepLinks", () => {
  afterEach(() => {
    clearMocks();
  });

  it("reads the links that were waiting when the page came up", async () => {
    fakeCore([LINK]);
    const onLink = mock();

    renderHook(() => useDeepLinks(onLink));

    await waitFor(() => expect(onLink).toHaveBeenCalledWith(LINK));
  });

  it("reads the queue again when the core says a link arrived", async () => {
    const core = fakeCore([]);
    const onLink = mock();

    renderHook(() => useDeepLinks(onLink));
    await waitFor(() => expect(core.takes()).toBe(1));

    act(() => core.push(LINK));

    await waitFor(() => expect(onLink).toHaveBeenCalledWith(LINK));
    expect(onLink).toHaveBeenCalledTimes(1);
  });

  it("hands each link to the newest handler", async () => {
    const core = fakeCore([]);
    const first = mock();
    const second = mock();

    const { rerender } = renderHook(({ onLink }) => useDeepLinks(onLink), {
      initialProps: { onLink: first },
    });
    await waitFor(() => expect(core.takes()).toBe(1));
    rerender({ onLink: second });

    act(() => core.push(LINK));

    await waitFor(() => expect(second).toHaveBeenCalledWith(LINK));
    expect(first).not.toHaveBeenCalled();
  });

  it("is quiet outside a Tauri webview", async () => {
    const onLink = mock();

    renderHook(() => useDeepLinks(onLink));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onLink).not.toHaveBeenCalled();
  });
});
