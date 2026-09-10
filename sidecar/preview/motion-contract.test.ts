import { describe, expect, it } from "bun:test";
import {
  cardsPlan,
  detailsPlan,
} from "../../templates/remotion/src/lib/studio-motion-v2/combination-plans";
import { phrasePlan } from "../../templates/remotion/src/lib/studio-motion-v2/plans";
import {
  after,
  type Beat,
  readingSeconds,
  staggeredGroup,
  type Timeline,
} from "../../templates/remotion/src/lib/studio-motion-v2/timing";
import { MotionContractReview } from "./motion-contract";
import type { AuditSample } from "./readiness-analysis";

function marker(plan: Timeline, localFrame = 0, window = plan.duration) {
  return {
    json: JSON.stringify({
      cues: plan.beats,
      duration: plan.duration,
      id: "test",
      version: 2,
      window,
    }),
    localFrame,
  };
}
function sample(frame: number, ids: readonly string[]): AuditSample {
  return {
    audit: {
      details: {
        contrast: [],
        darkFraction: 0,
        limitations: [],
        motionTargets: ids.map((id) => ({
          bbox: { height: 30, width: 100, x: 20, y: 20 },
          id,
          opacity: 1,
        })),
        pixelHash: "0",
        resources: [],
        texts: [],
      },
      findings: [],
      fingerprint: String(frame),
      motion: [],
    },
    frame,
    output: `${frame}.png`,
  };
}
const old: Beat = {
  end: 196 / 30,
  exitStart: 178 / 30,
  id: "first",
  settled: 153 / 30,
  slot: "statement",
  start: 114 / 30,
};
const next: Beat = {
  end: 265 / 30,
  exitStart: 260 / 30,
  id: "second",
  settled: 229 / 30,
  slot: "statement",
  start: 190 / 30,
};

describe("runtime motion contracts", () => {
  it("discovers the Wandry overlap between ordinary sample frames", () => {
    const review = new MotionContractReview(30, 900);
    const frames = review.discover(0, [
      marker({ beats: [old, next], duration: 30 }),
    ]);
    expect(frames).toContain(191);
    expect(frames).toContain(195);
    const collision = review
      .findings([])
      .find((row) => row.code === "motion_contract_collision");
    expect(collision?.from).toBe(190);
    expect(collision?.to).toBe(196);
  });

  it("derives a phrase successor from the last exiting word as copy changes", () => {
    for (const count of [1, 6, 20]) {
      const { group, members } = staggeredGroup({
        count,
        enter: 10 / 30,
        enterStagger: 2 / 30,
        exit: 8 / 30,
        exitStagger: 2 / 30,
        hold: 1.2,
        id: "words",
        slot: "phrase",
      });
      expect(after(group)).toBeCloseTo(members.at(-1)?.end ?? 0);
      expect(group.exitStart - group.settled).toBeCloseTo(1.2);
      expect(members.every((member) => member.end <= after(group) + 1e-7)).toBe(
        true
      );
    }
  });

  it("finds an actually removed caption even when the written plan is valid", () => {
    const caption = {
      end: 667 / 30,
      exitStart: 659 / 30,
      id: "caption",
      settled: 617 / 30,
      start: 610 / 30,
    };
    const review = new MotionContractReview(30, 900);
    review.discover(0, [marker({ beats: [caption], duration: 30 })]);
    const findings = review.findings([
      sample(658, ["caption"]),
      sample(659, []),
      sample(660, []),
    ]);
    expect(
      findings
        .filter((row) => row.code === "motion_contract_target")
        .map((row) => row.from)
    ).toEqual([659, 660]);
    expect(findings[0].evidence).toEqual(["659.png"]);
  });

  it("checks both parent lifetime and enclosing Sequence duration", () => {
    const review = new MotionContractReview(30, 300);
    const parent = { end: 3, exitStart: 3, id: "card", settled: 1, start: 0 };
    const child = {
      end: 3.3,
      exitStart: 3,
      id: "caption",
      parent: "card",
      settled: 1.2,
      start: 1,
    };
    review.discover(0, [marker({ beats: [parent, child], duration: 4 }, 0, 3)]);
    expect(review.findings([]).map((row) => row.code)).toEqual([
      "motion_contract_truncated",
      "motion_contract_parent",
    ]);
  });

  it("normalizes nested local time and reports unsampled boundaries explicitly", () => {
    const review = new MotionContractReview(30, 900);
    const plan = phrasePlan(["A short message"]);
    const frames = review.discover(245, [marker(plan)]);
    expect(frames).toContain(245);
    expect(frames).toContain(246);
    expect(review.discover(250, [marker(plan, 5)])).toEqual([]);
    const summary = review.summary([245, 246]);
    expect(summary.contracts).toBe(1);
    expect(summary.unvisited).not.toContain(245);
    expect(summary.unvisited.length).toBeGreaterThan(0);
  });

  it("rejects malformed or frame-dependent manifests without trusting them", () => {
    const review = new MotionContractReview(30, 300);
    const plan = phrasePlan(["Ready"]);
    review.discover(0, [
      marker(plan),
      { json: '{"version": 2}', localFrame: 0 },
    ]);
    review.discover(1, [marker({ ...plan, duration: plan.duration + 1 }, 1)]);
    expect(review.summary([]).invalid).toHaveLength(2);
    expect(
      review.findings([]).every((row) => row.code === "motion_contract_invalid")
    ).toBe(true);
  });

  it("does not treat one registered scene as coverage of the whole film", () => {
    const review = new MotionContractReview(30, 120);
    const plan = {
      beats: [{ end: 1, exitStart: 1, id: "still", settled: 0, start: 0 }],
      duration: 1,
    };
    review.discover(0, [marker(plan)]);
    review.discover(60, [marker(plan)]);
    expect(review.summary([]).uncovered).toEqual([
      { from: 30, to: 60 },
      { from: 90, to: 120 },
    ]);
    review.discover(30, [marker(plan)]);
    review.discover(90, [marker(plan)]);
    expect(review.summary([]).uncovered).toEqual([]);
  });

  it("permits overlap when the author has not declared an exclusive position", () => {
    const review = new MotionContractReview(30, 900);
    const { slot: _first, ...a } = old;
    const { slot: _second, ...b } = next;
    review.discover(0, [marker({ beats: [a, b], duration: 30 })]);
    expect(review.findings([])).toEqual([]);
  });

  it("distinguishes a reading estimate from a measured failure", () => {
    const review = new MotionContractReview(30, 300);
    review.discover(0, [
      marker({
        beats: [
          {
            end: 3,
            exitStart: 2 + 17 / 30,
            id: "tags",
            readFor: 2,
            settled: 2,
            start: 1,
          },
        ],
        duration: 10,
      }),
    ]);
    expect(review.findings([])[0].conclusion).toBe("heuristic");
    expect(review.findings([])[0].severity).toBe("warning");
  });
});

describe("supplied combinations", () => {
  it("keeps user card ids distinct from generated caption and grid cues", () => {
    const plan = cardsPlan(
      ["grid", "one", "one-caption"].map((id) => ({
        id,
        label: id,
        src: `${id}.jpg`,
        title: id,
      }))
    );
    const review = new MotionContractReview(30, Math.ceil(plan.duration * 30));
    review.discover(0, [marker(plan)]);
    expect(review.summary([]).invalid).toEqual([]);
    expect(review.findings([])).toEqual([]);
  });
  it("allocates time for all four details after the last item settles", () => {
    const texts = [
      "Brand identity",
      "Guidelines",
      "Packaging",
      "Illustrations",
    ];
    const plan = detailsPlan("Branding", texts);
    expect(
      Math.max(...plan.details.map((item) => item.beat.settled))
    ).toBeCloseTo(plan.group.settled);
    expect(plan.group.exitStart - plan.group.settled).toBeCloseTo(
      readingSeconds(texts.join(". "))
    );
    expect(
      detailsPlan("Branding", [...texts, "A longer supporting statement"])
        .duration
    ).toBeGreaterThan(plan.duration);
  });

  it("keeps card owners alive while every caption exits before the grid handoff", () => {
    const plan = cardsPlan(
      ["kurio", "lightek", "skydiving"].map((id) => ({
        id,
        label: id,
        src: `${id}.png`,
        title: `${id} work`,
      }))
    );
    expect(plan.cards.at(-1)?.caption.end).toBe(plan.grid.start);
    expect(plan.grid.settled).toBeGreaterThan(plan.gridMoveEnd);
    expect(plan.grid.exitStart - plan.grid.settled).toBeCloseTo(
      readingSeconds("kurio. lightek. skydiving")
    );
    for (const item of plan.cards) {
      expect(item.beat.end).toBe(plan.duration);
    }
    const review = new MotionContractReview(30, Math.ceil(plan.duration * 30));
    review.discover(0, [marker(plan)]);
    expect(review.findings([])).toEqual([]);
  });
});
