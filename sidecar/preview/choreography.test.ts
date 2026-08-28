// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_SAMPLES,
  type VideoCheck,
  type VideoPlan,
  type VideoSample,
  type VideoScene,
  videoCheckError,
  videoFindings,
  videoPlan,
  videoStep,
} from "./choreography";
import type { DesignFinding } from "./design";

const FPS = 30;

function scene(name: string, from: number, to: number): VideoScene {
  return { from, name, to };
}

function check(
  scenes: readonly VideoScene[],
  camera: string | null = null
): VideoCheck {
  return { camera, scenes };
}

function sample(
  frame: number,
  shape: {
    camera?: string | null;
    fingerprint?: string;
    ids?: readonly string[];
  } = {}
): VideoSample {
  return {
    camera: shape.camera ?? null,
    fingerprint: shape.fingerprint ?? `frame-${frame}`,
    frame,
    ids: (shape.ids ?? []).map((designId) => ({ designId, visible: true })),
  };
}

function codes(findings: readonly DesignFinding[]): string[] {
  return findings.map(({ code }) => code);
}

function only(
  findings: readonly DesignFinding[],
  code: DesignFinding["code"]
): DesignFinding[] {
  return findings.filter((entry) => entry.code === code);
}

describe("videoCheckError", () => {
  it("refuses a map with a single scene, which has no rhythm and no boundary", () => {
    expect(videoCheckError(check([scene("one", 0, 90)]), 90)).toContain(
      "at least two scenes"
    );
  });

  it("refuses a scene that ends past the composition", () => {
    expect(
      videoCheckError(check([scene("a", 0, 60), scene("b", 60, 200)]), 120)
    ).toContain("past the composition");
  });

  it("refuses a scene map that is not ordered by from", () => {
    expect(
      videoCheckError(check([scene("a", 60, 120), scene("b", 0, 60)]), 120)
    ).toContain("ordered");
  });

  it("refuses an empty scene", () => {
    expect(
      videoCheckError(check([scene("a", 0, 60), scene("b", 60, 60)]), 120)
    ).toContain('"to" greater than "from"');
  });

  it("accepts the half a refused video splits into, because the sweep follows the scene map", () => {
    expect(
      videoCheckError(
        check([scene("a", 0, 1500), scene("b", 1500, 3000)]),
        8000
      )
    ).toBeNull();
  });

  it("names the budget instead of silently sampling less of a long video", () => {
    const scenes = [scene("a", 0, 4000), scene("b", 4000, 8000)];

    const error = videoCheckError(check(scenes), 8000);

    expect(error).toContain(String(MAX_VIDEO_SAMPLES));
    expect(error).toContain("in halves");
  });

  it("accepts a map that fits", () => {
    expect(
      videoCheckError(check([scene("a", 0, 60), scene("b", 60, 150)]), 150)
    ).toBeNull();
  });
});

describe("videoPlan", () => {
  it("sweeps the timeline at the step and always ends on the last frame", () => {
    const plan = videoPlan(
      check([scene("a", 0, 60), scene("b", 60, 120)]),
      120
    );

    expect(videoStep(120)).toBe(3);
    expect(plan.timeline.at(0)).toBe(0);
    expect(plan.timeline.at(-1)).toBe(119);
    expect(plan.timeline.at(1)).toBe(3);
  });

  it("sweeps the scenes it was given, not the whole composition", () => {
    const plan = videoPlan(
      check([scene("a", 600, 660), scene("b", 660, 720)]),
      3000
    );

    expect(plan.timeline.at(0)).toBe(600);
    expect(plan.timeline.at(-1)).toBe(719);
  });

  it("reads a hard cut three frames each side", () => {
    const plan = videoPlan(
      check([scene("a", 0, 60), scene("b", 60, 120)]),
      120
    );

    expect(plan.boundaries).toEqual([
      { after: 1, before: 0, left: 57, right: 63 },
    ]);
  });

  it("reads a transition outside its own overlap, so a crossfade cannot pass for continuity", () => {
    const plan = videoPlan(
      check([scene("a", 0, 120), scene("b", 100, 220)]),
      220
    );

    expect(plan.boundaries).toEqual([
      { after: 1, before: 0, left: 97, right: 123 },
    ]);
  });

  it("never reads one boundary twice, even from a map the validator would refuse", () => {
    const plans = [
      videoPlan(check([scene("a", 0, 2), scene("b", 2, 4)]), 4),
      videoPlan(check([scene("a", 0, 100), scene("b", 10, 30)]), 100),
      videoPlan(check([scene("a", 0, 10), scene("b", 1, 3)]), 10),
    ];

    for (const plan of plans) {
      for (const boundary of plan.boundaries) {
        expect(boundary.left).toBeLessThan(boundary.right);
      }
    }
  });

  it("samples every frame the checks read, once", () => {
    const plan = videoPlan(
      check([scene("a", 0, 60), scene("b", 60, 120)]),
      120
    );

    for (const frame of [...plan.interiors, 57, 63]) {
      expect(plan.frames).toContain(frame);
    }
    expect(new Set(plan.frames).size).toBe(plan.frames.length);
  });
});

describe("rhythm", () => {
  const varied = [scene("a", 0, 30), scene("b", 30, 120), scene("c", 120, 270)];

  function findingsFor(scenes: readonly VideoScene[]) {
    const video = check(scenes);
    const duration = scenes.at(-1)?.to ?? 0;
    const plan = videoPlan(video, duration);
    return videoFindings({
      fps: FPS,
      plan,
      samples: plan.frames.map((frame) => sample(frame)),
      video,
    });
  }

  it("calls out durations that are nearly uniform", () => {
    const found = only(
      findingsFor([
        scene("a", 0, 90),
        scene("b", 90, 185),
        scene("c", 185, 285),
      ]),
      "video_uniform_rhythm"
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
  });

  it("says nothing when the durations already carry accents and rests", () => {
    expect(codes(findingsFor(varied))).not.toContain("video_uniform_rhythm");
  });

  it("needs three scenes before it judges a rhythm at all", () => {
    expect(
      codes(findingsFor([scene("a", 0, 90), scene("b", 90, 180)]))
    ).not.toContain("video_uniform_rhythm");
  });

  it("notes a video where no scene is short enough to be an accent", () => {
    const scenes: VideoScene[] = [];
    for (const [index, length] of [60, 70, 80, 90, 100, 110].entries()) {
      const from = scenes.at(-1)?.to ?? 0;
      scenes.push(scene(`s${index}`, from, from + length));
    }

    const found = only(findingsFor(scenes), "video_no_accent");

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("info");
  });
});

describe("frozen runs", () => {
  function plan(timeline: readonly number[]): VideoPlan {
    return { boundaries: [], frames: timeline, interiors: [], timeline };
  }

  function findingsFor(timeline: readonly number[], prints: readonly string[]) {
    const built = plan(timeline);
    return only(
      videoFindings({
        fps: FPS,
        plan: built,
        samples: timeline.map((frame, index) =>
          sample(frame, { fingerprint: prints[index] as string })
        ),
        video: check([scene("a", 0, 60), scene("b", 60, 120)], "#camera"),
      }),
      "video_frozen_run"
    );
  }

  const sweep = (count: number) =>
    Array.from({ length: count }, (_, index) => index * 15);

  it("warns about a stretch where nothing changed for three seconds", () => {
    const timeline = sweep(9);
    const prints = ["a", "a", "a", "a", "a", "a", "a", "b", "c"];

    const found = findingsFor(timeline, prints);

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
    expect(found[0]?.frames).toEqual([0, 90]);
  });

  it("only notes a shorter hold", () => {
    const found = findingsFor(sweep(9), [
      "a",
      "a",
      "a",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);

    expect(found[0]?.severity).toBe("info");
    expect(found[0]?.frames).toEqual([0, 45]);
  });

  it("forgives the final hold, which is a card and not a defect", () => {
    expect(
      findingsFor(sweep(9), ["a", "b", "c", "d", "e", "e", "e", "e", "e"])
    ).toHaveLength(0);
  });

  it("does not forgive a video that never moves at all", () => {
    const found = findingsFor(
      sweep(9),
      Array.from({ length: 9 }, () => "a")
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.frames).toEqual([0, 120]);
  });

  it("says nothing about a frame that keeps changing", () => {
    expect(
      findingsFor(sweep(9), ["a", "b", "c", "d", "e", "f", "g", "h", "i"])
    ).toHaveLength(0);
  });
});

describe("continuity", () => {
  const video = check([
    scene("a", 0, 60),
    scene("b", 60, 120),
    scene("c", 120, 180),
  ]);
  const plan = videoPlan(video, 180);

  function findingsFor(ids: (frame: number) => readonly string[]) {
    return videoFindings({
      fps: FPS,
      plan,
      samples: plan.frames.map((frame) => sample(frame, { ids: ids(frame) })),
      video,
    });
  }

  it('calls out boundaries that are "everything out, then everything in"', () => {
    const found = only(
      findingsFor((frame) => [`scene-${Math.floor(frame / 60)}`]),
      "video_boundary_dead"
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
    expect(found[0]?.message).toContain("2 of 2");
  });

  it("accepts a background that persists through every cut", () => {
    expect(
      codes(
        findingsFor((frame) => ["backdrop", `scene-${Math.floor(frame / 60)}`])
      )
    ).not.toContain("video_boundary_dead");
  });

  it("accepts half the boundaries carrying something", () => {
    expect(
      codes(
        findingsFor((frame) =>
          frame < 100 ? ["bridge"] : [`scene-${Math.floor(frame / 60)}`]
        )
      )
    ).not.toContain("video_boundary_dead");
  });

  it("ignores an element that is mounted but not visible", () => {
    const found = only(
      videoFindings({
        fps: FPS,
        plan,
        samples: plan.frames.map((frame) => ({
          camera: null,
          fingerprint: `frame-${frame}`,
          frame,
          ids: [
            { designId: "ghost", visible: false },
            { designId: `scene-${Math.floor(frame / 60)}`, visible: true },
          ],
        })),
        video,
      }),
      "video_boundary_dead"
    );

    expect(found).toHaveLength(1);
  });

  it("says it could not judge rather than passing a video with no tagged element", () => {
    const found = findingsFor(() => []);

    expect(codes(found)).toContain("video_untagged");
    expect(codes(found)).not.toContain("video_boundary_dead");
  });
});

describe("camera", () => {
  const scenes = [scene("a", 0, 60), scene("b", 60, 120)];

  function findingsFor(
    camera: string | null,
    print: (frame: number) => string | null
  ) {
    const video = check(scenes, camera);
    const plan = videoPlan(video, 120);
    return only(
      videoFindings({
        fps: FPS,
        plan,
        samples: plan.frames.map((frame) =>
          sample(frame, { camera: print(frame), ids: ["backdrop"] })
        ),
        video,
      }),
      "video_static_camera"
    );
  }

  it("says a video declared no camera rather than assuming it was a decision", () => {
    const found = findingsFor(null, () => null);

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("info");
  });

  it("refuses to pass a camera selector that matched nothing", () => {
    const found = findingsFor("#camera", () => null);

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("warning");
  });

  it("notes a declared camera that never moves", () => {
    const found = findingsFor("#camera", () => "held");

    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("info");
  });

  it("says nothing about a camera that moves somewhere", () => {
    expect(findingsFor("#camera", (frame) => `at-${frame}`)).toHaveLength(0);
  });
});
