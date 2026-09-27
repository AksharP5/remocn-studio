import { describe, expect, it } from "bun:test";
import {
  prismAt,
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
    expect(new Set(dots.map((dot) => dot.color)).size).toBe(STRIP_COLUMNS);
  });

  it("ripples out from the middle of the strip to both ends", () => {
    const middle = dots.find((dot) => dot.id === "2-7");
    const left = dots.find((dot) => dot.id === "0-0");
    const right = dots.find((dot) => dot.id === "4-14");

    expect(middle?.ring).toBe(0);
    expect(left?.ring).toBeCloseTo(STRIP_RINGS);
    expect(right?.ring).toBeCloseTo(STRIP_RINGS);
  });

  it("runs the prism once across the width", () => {
    expect(dots.find((dot) => dot.id === "0-0")?.color).toBe(prismAt(0));
    expect(dots.find((dot) => dot.id === "0-14")?.color).toBe(prismAt(1));
  });
});

describe("prismAt", () => {
  it("answers the prism's stops and clamps outside them", () => {
    expect(prismAt(0)).toBe("rgb(18 194 233)");
    expect(prismAt(0.45)).toBe("rgb(196 113 237)");
    expect(prismAt(1)).toBe("rgb(246 79 89)");
    expect(prismAt(-1)).toBe(prismAt(0));
    expect(prismAt(2)).toBe(prismAt(1));
  });
});
