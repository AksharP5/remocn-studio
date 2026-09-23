import { describe, expect, it } from "bun:test";
import { snapBox, snapLinesOf, snapSides } from "./studio-geometry";

const frame = { left: 0, top: 0, right: 1000, bottom: 500 };

describe("snapLinesOf", () => {
  it("offers both edges and the centre of every box on each axis", () => {
    const lines = snapLinesOf([frame]);
    expect(lines.x.map((line) => line.at)).toEqual([0, 500, 1000]);
    expect(lines.y.map((line) => line.at)).toEqual([0, 250, 500]);
    expect(lines.x[0]).toEqual({ at: 0, from: 0, to: 500 });
  });
});

describe("snapSides", () => {
  it("snaps every side of a moved box", () => {
    expect(snapSides("move", false)).toEqual({
      x: ["start", "center", "end"],
      y: ["start", "center", "end"],
    });
  });

  it("snaps only the edges a resize handle moves", () => {
    expect(snapSides("e", false)).toEqual({ x: ["end"], y: [] });
    expect(snapSides("nw", false)).toEqual({ x: ["start"], y: ["start"] });
  });

  it("leaves rotation and proportional corners alone", () => {
    expect(snapSides("rotate", false)).toEqual({ x: [], y: [] });
    expect(snapSides("se", true)).toEqual({ x: [], y: [] });
  });
});

describe("snapBox", () => {
  const lines = snapLinesOf([frame]);
  const sides = snapSides("move", false);

  it("pulls a centre that is within reach onto the frame's centre", () => {
    const snapped = snapBox({ left: 396, top: 100, right: 596, bottom: 200 }, lines, sides, 6);
    expect(snapped.dx).toBe(4);
    expect(snapped.dy).toBe(0);
    expect(snapped.guides.x).toEqual({ at: 500, from: 0, to: 500 });
    expect(snapped.guides.y).toBeNull();
  });

  it("takes the nearest line when several are in reach", () => {
    const snapped = snapBox({ left: 3, top: 497, right: 103, bottom: 598 }, lines, sides, 6);
    expect(snapped.dx).toBe(-3);
    expect(snapped.dy).toBe(3);
  });

  it("leaves a box alone when nothing is within the threshold", () => {
    const snapped = snapBox({ left: 100, top: 100, right: 200, bottom: 200 }, lines, sides, 6);
    expect(snapped).toEqual({ dx: 0, dy: 0, guides: { x: null, y: null } });
  });

  it("spans a guide across the snapped box and the line's source", () => {
    const snapped = snapBox({ left: 998, top: 600, right: 1100, bottom: 700 }, lines, { x: ["start"], y: [] }, 6);
    expect(snapped.dx).toBe(2);
    expect(snapped.guides.x).toEqual({ at: 1000, from: 0, to: 700 });
  });
});
