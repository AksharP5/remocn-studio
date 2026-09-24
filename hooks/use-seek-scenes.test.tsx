import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { useSeekScenes } from "./use-seek-scenes";

const SCENES = [
  { duration: 100, from: 0, id: "a", name: "Intro" },
  { duration: 200, from: 100, id: "b", name: "Outro" },
];

describe("useSeekScenes", () => {
  it("labels segments once the bar has been measured", () => {
    const { result } = renderHook(() =>
      useSeekScenes({
        frame: 0,
        scenes: SCENES,
        seekTo: mock(),
        totalFrames: 300,
      })
    );

    expect(result.current.segments.map((segment) => segment.labeled)).toEqual([
      false,
      false,
    ]);

    const bar = document.createElement("div");
    Object.defineProperty(bar, "clientWidth", { value: 600 });
    act(() => result.current.measure(bar));

    expect(result.current.segments.map((segment) => segment.labeled)).toEqual([
      true,
      true,
    ]);
  });

  it("seeks to the start of the scene whose name was clicked", () => {
    const seekTo = mock();
    const { result } = renderHook(() =>
      useSeekScenes({ frame: 0, scenes: SCENES, seekTo, totalFrames: 300 })
    );
    act(() =>
      result.current.onPick({
        currentTarget: { value: "100" },
      } as MouseEvent<HTMLButtonElement>)
    );

    expect(seekTo).toHaveBeenCalledWith(100);
  });

  it("marks the scene the playhead is in", () => {
    const { rerender, result } = renderHook(
      ({ frame }: { frame: number }) =>
        useSeekScenes({
          frame,
          scenes: SCENES,
          seekTo: mock(),
          totalFrames: 300,
        }),
      { initialProps: { frame: 0 } }
    );

    expect(result.current.current).toBe("a");

    rerender({ frame: 150 });

    expect(result.current.current).toBe("b");
  });
});
