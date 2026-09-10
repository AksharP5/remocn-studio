import { describe, expect, it } from "bun:test";
import {
  ease,
  mixRect,
  revealAt,
  scaleBetween,
  valueAt,
} from "../../templates/remotion/src/lib/studio-motion-v1/motion";
import {
  imagePlan,
  metricPlan,
  phrasePlan,
} from "../../templates/remotion/src/lib/studio-motion-v1/plans";
import {
  checkTiming,
  durationFrames,
  groupWindow,
  progressAt,
  readingSeconds,
  reviewFrames,
  secondsAt,
  sequence,
} from "../../templates/remotion/src/lib/studio-motion-v1/timing";

describe("motion foundations", () => {
  it("preserves a gesture at the same wall-clock time at 24, 30 and 60 fps", () => {
    const [beat] = sequence([
      { enter: 0.6, exit: 0.3, hold: 1.4, id: "title" },
    ]).beats;
    for (const seconds of [0, 0.5, 1, 2, 2.5]) {
      const states = [24, 30, 60].map((fps) =>
        revealAt(secondsAt(seconds * fps, fps), beat)
      );
      expect(states[0]).toEqual(states[1]);
      expect(states[1]).toEqual(states[2]);
    }
  });

  it("settles every group member inside the same budget regardless of content length", () => {
    for (const count of [1, 2, 8, 80, 200]) {
      for (let index = 0; index < count; index += 1) {
        const window = groupWindow(2, 0.6, index, count);
        expect(window.start + window.duration).toBeLessThanOrEqual(
          2.600_000_01
        );
        expect(progressAt(2.6, window.start, window.duration)).toBeCloseTo(
          1,
          10
        );
      }
    }
  });

  it("keeps the reading intervals intact when transitions overlap", () => {
    const timeline = sequence([
      { enter: 0.6, exit: 0.4, hold: 1.5, id: "one" },
      { enter: 0.7, exit: 0, hold: 2, id: "two" },
    ]);
    expect(timeline.beats[1].start).toBeCloseTo(timeline.beats[0].exitStart);
    expect(timeline.beats[0].exitStart - timeline.beats[0].settled).toBeCloseTo(
      1.5
    );
    expect(timeline.beats[1].exitStart - timeline.beats[1].settled).toBeCloseTo(
      2
    );
    expect(timeline.duration).toBeCloseTo(4.8);
    expect(() =>
      sequence([
        { enter: 0.6, exit: 0.4, hold: 1.5, id: "one" },
        { enter: 0.7, exit: 0, hold: 2, id: "two", overlap: 0.5 },
      ])
    ).toThrow("reading window");
  });

  it("handles cuts and zero-duration entrances without division by zero", () => {
    const plan = sequence([
      { enter: 0, exit: 0, hold: 1, id: "a" },
      { enter: 0, exit: 0, hold: 1, id: "b" },
    ]);
    expect(revealAt(0, plan.beats[0]).opacity).toBe(1);
    expect(revealAt(1, plan.beats[0]).visible).toBe(false);
    expect(revealAt(1, plan.beats[1]).opacity).toBe(1);
  });

  it("has stable exact endpoints and bounded monotonic curves", () => {
    for (const curve of ["settle", "travel", "accelerate", "linear"] as const) {
      expect(ease(-1, curve)).toBe(0);
      expect(ease(2, curve)).toBe(1);
      let before = 0;
      for (let step = 0; step <= 100; step += 1) {
        const now = ease(step / 100, curve);
        expect(now).toBeGreaterThanOrEqual(before - 1e-12);
        expect(now).toBeLessThanOrEqual(1 + 1e-12);
        before = now;
      }
    }
  });

  it("recomputes deterministically when frames are sought backwards", () => {
    const [beat] = sequence([
      { enter: 0.6, exit: 0.4, hold: 1.4, id: "a" },
    ]).beats;
    const times = [2.2, -0.1, 0.25, 1.3, 0, 2.4, 0.25];
    const first = times.map((time) =>
      revealAt(time, beat, { count: 9, index: 4 })
    );
    expect(
      times.map((time) => revealAt(time, beat, { count: 9, index: 4 }))
    ).toEqual(first);
    expect(first[2]).toEqual(first[6]);
    expect(revealAt(1.5, beat)).toEqual(revealAt(1, beat));
  });

  it("detects a clipped result and an unexplained empty tail", () => {
    const plan = sequence([
      { enter: 0.6, exit: 0.4, hold: 1.4, id: "headline" },
    ]);
    expect(checkTiming(plan, 18, 30).map((issue) => issue.code)).toEqual([
      "truncated",
      "reading-window",
    ]);
    expect(checkTiming(plan, durationFrames(plan.duration, 30), 30)).toEqual(
      []
    );
    expect(checkTiming(plan, 120, 30)[0].code).toBe("empty-tail");
  });

  it("samples short transitions even when a regular sampling grid would miss them", () => {
    const plan = sequence([
      { enter: 0.13, exit: 0.07, hold: 1.11, id: "title" },
    ]);
    const frames = reviewFrames(plan, 30);
    expect(frames).toContain(3);
    expect(frames).toContain(4);
    expect(frames).toContain(5);
    expect(frames.at(-1)).toBe(durationFrames(plan.duration, 30) - 1);
  });

  it("plans longer reading time for longer text without accelerating a brisk style's reading", () => {
    const text =
      "A complete sentence with enough words to need a real reading window.";
    expect(readingSeconds(text)).toBeGreaterThan(readingSeconds("Ready."));
    expect(
      readingSeconds("新的想法让复杂的信息变得清晰可见。")
    ).toBeGreaterThan(0.8);
    expect(readingSeconds("   ")).toBe(0);
    const [a] = phrasePlan([text], { energy: "calm" }).beats;
    const [b] = phrasePlan([text], { energy: "brisk" }).beats;
    expect(a.exitStart - a.settled).toBeCloseTo(b.exitStart - b.settled);
  });

  it("counts a grapheme cluster once instead of treating its UTF-16 units as separate characters", () => {
    const options = {
      charactersPerSecond: 1,
      lead: 0,
      minimum: 0,
      wordsPerSecond: 100,
    };
    expect(readingSeconds("👨‍👩‍👧‍👦", options)).toBe(1);
    expect(readingSeconds("e\u0301", options)).toBe(1);
  });

  it("gives an image caption its own complete settled reading interval", () => {
    const plan = imagePlan(
      "A different perspective.",
      "The view opens up, and the caption stays long enough to read."
    );
    expect(plan.captionBeat.start).toBeGreaterThan(plan.imageBeat.settled);
    expect(
      plan.captionBeat.end - plan.captionBeat.settled
    ).toBeGreaterThanOrEqual(readingSeconds(plan.caption) - 1e-8);
  });

  it("hands one text position to the next phrase without double ownership", () => {
    const plan = phrasePlan([
      "One.",
      "Another phrase with a different length.",
      "Three.",
    ]);
    for (let index = 1; index < plan.beats.length; index += 1) {
      expect(plan.beats[index].start).toBeCloseTo(plan.beats[index - 1].end);
    }
  });

  it("shares one value for a metric and its graphic, including reversed and zero values", () => {
    expect(valueAt(-1, 0, 1, 0, 82)).toBe(0);
    expect(valueAt(1, 0, 1, 0, 82)).toBe(82);
    expect(valueAt(0.5, 0, 1, 0, 82)).toBe(41);
    expect(valueAt(0.5, 0, 1, 100, 0)).toBe(50);
    expect(metricPlan(0, "No waiting.", "Keep moving.").value).toBe(0);
  });

  it("preserves shared-object geometry at both ends of a handoff", () => {
    const from = { height: 8, width: 400, x: 50, y: 100 };
    const to = { height: 1920, width: 1080, x: 0, y: 0 };
    expect(mixRect(from, to, 0)).toEqual(from);
    expect(mixRect(from, to, 1)).toEqual(to);
    expect(scaleBetween(1, 4, 0.5)).toBeCloseTo(2);
  });

  it("rejects malformed timing instead of propagating NaN into CSS", () => {
    expect(() => secondsAt(1, 0)).toThrow();
    expect(() => durationFrames(Number.NaN, 30)).toThrow();
    expect(() => sequence([])).toThrow();
    expect(() =>
      sequence([{ enter: -1, exit: 0, hold: 1, id: "x" }])
    ).toThrow();
    expect(() =>
      sequence([
        { enter: 0, exit: 0, hold: 1, id: "x" },
        { enter: 0, exit: 0, hold: 1, id: "x" },
      ])
    ).toThrow();
    expect(() => groupWindow(0, 1, 0, 0)).toThrow();
    expect(() => groupWindow(0, 1, 2, 2)).toThrow();
    expect(() => groupWindow(0, 1, 0, 2, 1)).toThrow();
    expect(() => phrasePlan([" "])).toThrow();
  });
});
