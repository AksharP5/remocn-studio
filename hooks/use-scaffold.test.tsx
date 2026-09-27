import { describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { MouseEvent } from "react";
import { useScaffold } from "@/hooks/use-scaffold";

const PROJECT = "project-1";

function clickFor(value: string) {
  return { currentTarget: { value } } as MouseEvent<HTMLButtonElement>;
}

function hangingScaffold() {
  const state = { cancels: 0, requests: 0 };
  mockIPC((cmd) => {
    if (cmd === "sidecar_request") {
      state.requests += 1;
      return new Promise(() => undefined);
    }
    if (cmd === "sidecar_cancel") {
      state.cancels += 1;
      return null;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
  return state;
}

describe("useScaffold", () => {
  it("records when the running step started, for the elapsed time", () => {
    hangingScaffold();
    const { result } = renderHook(() => useScaffold(mock()));

    const before = Date.now();
    act(() => {
      result.current.startScaffold(PROJECT);
    });

    const scaffold = result.current.scaffolds.get(PROJECT);
    expect(scaffold?.isRunning).toBe(true);
    expect(scaffold?.startedAt).toBeGreaterThanOrEqual(before);
  });

  it("cancels a running scaffold and says so rather than failing", async () => {
    const host = hangingScaffold();
    const { result } = renderHook(() => useScaffold(mock()));

    act(() => {
      result.current.startScaffold(PROJECT);
    });
    await waitFor(() => expect(host.requests).toBe(1));

    act(() => {
      result.current.onCancelScaffold(clickFor(PROJECT));
    });

    await waitFor(() => {
      expect(result.current.scaffolds.get(PROJECT)?.isRunning).toBe(false);
    });
    const scaffold = result.current.scaffolds.get(PROJECT);
    expect(scaffold?.cancelled).toBe(true);
    expect(scaffold?.error).toBeNull();
    await waitFor(() => expect(host.cancels).toBe(1));
  });
});
