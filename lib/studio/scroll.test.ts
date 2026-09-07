import { describe, expect, it } from "bun:test";
import { wheelDelta, wheelScroll } from "@/lib/studio/scroll";

describe("wheelScroll", () => {
  const strip = { clientWidth: 200, scrollLeft: 50, scrollWidth: 600 };

  it("travels sideways by the wheel's delta", () => {
    expect(wheelScroll(strip, 30)).toBe(80);
    expect(wheelScroll(strip, -20)).toBe(30);
  });

  it("stops at each end rather than running past it", () => {
    expect(wheelScroll(strip, 9999)).toBe(400);
    expect(wheelScroll(strip, -9999)).toBe(0);
  });

  // A strip that cannot move hands the gesture back, or a row two chips wide
  // would swallow the wheel of the pane scrolling underneath it.
  it("declines when there is nothing to scroll", () => {
    expect(
      wheelScroll({ clientWidth: 200, scrollLeft: 0, scrollWidth: 200 }, 30)
    ).toBeNull();
    expect(wheelScroll(strip, 0)).toBeNull();
  });

  it("declines when it is already against the end being pushed towards", () => {
    expect(
      wheelScroll({ clientWidth: 200, scrollLeft: 400, scrollWidth: 600 }, 30)
    ).toBeNull();
    expect(
      wheelScroll({ clientWidth: 200, scrollLeft: 0, scrollWidth: 600 }, -30)
    ).toBeNull();
  });
});

describe("wheelDelta", () => {
  function wheel(init: Partial<WheelEvent>): WheelEvent {
    return { deltaMode: 0, deltaX: 0, deltaY: 0, ...init } as WheelEvent;
  }

  // A plain mouse only ever reports Y, and that is the whole point of this.
  it("takes the axis the gesture is actually on", () => {
    expect(wheelDelta(wheel({ deltaY: 40 }))).toBe(40);
    expect(wheelDelta(wheel({ deltaX: -25, deltaY: 4 }))).toBe(-25);
  });

  it("converts the units a wheel may report instead of pixels", () => {
    expect(wheelDelta(wheel({ deltaMode: 1, deltaY: 3 }))).toBe(48);
    expect(wheelDelta(wheel({ deltaMode: 2, deltaY: 2 }))).toBe(200);
  });
});
