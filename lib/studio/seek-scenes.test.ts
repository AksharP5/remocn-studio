import { describe, expect, it } from "bun:test";
import { segmentsOf } from "./seek-scenes";

const scene = (id: string, from: number, duration: number) => ({
  duration,
  from,
  id,
  name: id,
});

describe("segmentsOf", () => {
  it("places each scene as a share of the video", () => {
    const segments = segmentsOf(
      [scene("Intro", 0, 75), scene("Outro", 75, 225)],
      300,
      600
    );

    expect(segments.map(({ left, width }) => [left, width])).toEqual([
      [0, 25],
      [25, 75],
    ]);
  });

  it("labels only the segments wide enough for a name", () => {
    const segments = segmentsOf(
      [scene("Flash", 0, 10), scene("Main", 10, 290)],
      300,
      600
    );

    expect(segments.map((segment) => segment.labeled)).toEqual([false, true]);
  });

  it("clamps a scene that runs past the end of the video", () => {
    const [, last] = segmentsOf(
      [scene("Intro", 0, 100), scene("Outro", 100, 400)],
      300,
      600
    );

    expect(last?.width).toBeCloseTo(66.667, 2);
  });

  it("ends a segment where the next scene starts, so names never overlap", () => {
    const segments = segmentsOf(
      [scene("Outro", 150, 150), scene("Intro", 0, 170)],
      300,
      600
    );

    expect(
      segments.map(({ left, name, width }) => [name, left, width])
    ).toEqual([
      ["Intro", 0, 50],
      ["Outro", 50, 50],
    ]);
  });

  it("draws nothing for fewer than two scenes or an empty video", () => {
    expect(segmentsOf([scene("Only", 0, 300)], 300, 600)).toEqual([]);
    expect(segmentsOf([scene("A", 0, 1), scene("B", 1, 1)], 0, 600)).toEqual(
      []
    );
  });
});
