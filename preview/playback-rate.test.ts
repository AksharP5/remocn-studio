import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { PreviewCommand } from "./bridge";

let receive: ((command: PreviewCommand) => void) | null = null;

mock.module("./bridge", () => ({
  onCommand: (handle: (command: PreviewCommand) => void) => {
    receive = handle;
    return () => {
      receive = null;
    };
  },
  post: mock(),
}));

const { usePlaybackRate } = await import("./playback-rate");

describe("usePlaybackRate", () => {
  it("plays at 1x until the pane asks for another speed", () => {
    const { result } = renderHook(() => usePlaybackRate());

    expect(result.current).toBe(1);

    act(() => receive?.({ rate: 0.25, type: "transport.rate" }));

    expect(result.current).toBe(0.25);
  });

  it("ignores a speed the panel does not offer", () => {
    const { result } = renderHook(() => usePlaybackRate());
    act(() => receive?.({ rate: 3, type: "transport.rate" }));

    expect(result.current).toBe(1);
  });
});
