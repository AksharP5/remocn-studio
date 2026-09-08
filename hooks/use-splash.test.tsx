import { describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useSplash } from "@/hooks/use-splash";

const clock = { now: 0 };

mock.module("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

mock.module("@/hooks/use-now", () => ({
  useNow: () => clock.now,
}));

describe("useSplash", () => {
  it("waits for a quiet beat after the shell first settles", () => {
    clock.now = 0;
    const rendered = renderHook(({ isSettled }) => useSplash(isSettled), {
      initialProps: { isSettled: false },
    });

    clock.now = 1500;
    rendered.rerender({ isSettled: true });
    expect(rendered.result.current.phase).toBe("holding");

    clock.now = 1649;
    rendered.rerender({ isSettled: true });
    expect(rendered.result.current.phase).toBe("holding");

    clock.now = 1650;
    rendered.rerender({ isSettled: true });
    expect(rendered.result.current.phase).toBe("leaving");
  });
});
