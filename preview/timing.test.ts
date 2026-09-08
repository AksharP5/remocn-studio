import { describe, expect, it } from "bun:test";
import type { Fiber } from "./fiber";
import { windowOf } from "./timing";

function fiber(overrides: Partial<Fiber>): Fiber {
  return {
    child: null,
    memoizedProps: null,
    return: null,
    sibling: null,
    stateNode: null,
    type: null,
    ...overrides,
  };
}

function scope(
  value: Record<string, unknown>,
  parent: Fiber | null = null
): Fiber {
  return fiber({ memoizedProps: { children: null, value }, return: parent });
}

function mounted(chain: Fiber): HTMLElement {
  const node = document.createElement("div");

  Object.defineProperty(node, "__reactFiber$abc123", {
    configurable: true,
    enumerable: true,
    value: chain,
  });

  return node;
}

describe("windowOf", () => {
  it("adds the sequence's own offset to everything it is nested in", () => {
    const outer = scope({
      cumulatedFrom: 0,
      durationInFrames: 200,
      relativeFrom: 120,
    });
    const inner = scope(
      { cumulatedFrom: 120, durationInFrames: 60, relativeFrom: 18 },
      outer
    );

    expect(windowOf(mounted(fiber({ return: inner })))).toEqual({
      from: 138,
      until: 198,
    });
  });

  it("takes the innermost sequence, not the scene around it", () => {
    const outer = scope({
      cumulatedFrom: 0,
      durationInFrames: 300,
      relativeFrom: 0,
    });
    const inner = scope(
      { cumulatedFrom: 0, durationInFrames: 45, relativeFrom: 30 },
      outer
    );

    expect(windowOf(mounted(inner))).toEqual({ from: 30, until: 75 });
  });

  it("defers to the sequence around it when the inner one is malformed", () => {
    const outer = scope({
      cumulatedFrom: 90,
      durationInFrames: 30,
      relativeFrom: 10,
    });
    const broken = fiber({
      memoizedProps: { value: { relativeFrom: "soon" } },
      return: outer,
    });

    expect(windowOf(mounted(broken))).toEqual({ from: 100, until: 130 });
  });

  it("falls back to a minute of frames when the duration is not finite", () => {
    const infinite = scope({
      cumulatedFrom: 12,
      durationInFrames: Number.POSITIVE_INFINITY,
      relativeFrom: 0,
    });

    expect(windowOf(mounted(infinite))).toEqual({ from: 12, until: 72 });
  });

  it("falls back the same way for a sequence clamped to nothing", () => {
    const empty = scope({
      cumulatedFrom: 0,
      durationInFrames: 0,
      relativeFrom: 5,
    });

    expect(windowOf(mounted(empty))).toEqual({ from: 5, until: 65 });
  });

  it("answers nothing when no sequence is around the node", () => {
    const plain = fiber({ memoizedProps: { className: "title" } });

    expect(windowOf(mounted(plain))).toBeNull();
  });

  it("answers nothing for a node React never rendered", () => {
    expect(windowOf(document.createElement("div"))).toBeNull();
  });

  it("ignores a provider carrying something that is not a sequence", () => {
    const other = scope({ theme: "dark" });

    expect(windowOf(mounted(other))).toBeNull();
  });
});
