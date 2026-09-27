import { describe, expect, it } from "bun:test";
import {
  STRIP_COLUMNS,
  STRIP_RINGS,
  STRIP_ROWS,
  stripDots,
} from "@/lib/studio/thinking-strip";

describe("stripDots", () => {
  const dots = stripDots();

  it("lays out one matrix, not a repeated square", () => {
    expect(dots).toHaveLength(STRIP_COLUMNS * STRIP_ROWS);
    expect(new Set(dots.map((dot) => dot.id)).size).toBe(dots.length);
  });

  it("ripples out from the middle of the strip to both ends", () => {
    const middle = dots.find((dot) => dot.id === "2-7");
    const left = dots.find((dot) => dot.id === "0-0");
    const right = dots.find((dot) => dot.id === "4-14");

    expect(middle?.ring).toBe(0);
    expect(left?.ring).toBeCloseTo(STRIP_RINGS);
    expect(right?.ring).toBeCloseTo(STRIP_RINGS);
  });
});
