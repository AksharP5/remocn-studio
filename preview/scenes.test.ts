import { describe, expect, it } from "bun:test";
import { type RegisteredSequence, sameScenes, scenesOf } from "./scenes";

function sequence(
  id: string,
  from: number,
  duration: number,
  extra: Partial<RegisteredSequence> = {}
): RegisteredSequence {
  return {
    displayName: id,
    duration,
    from,
    id,
    parent: null,
    showInTimeline: true,
    type: "sequence",
    ...extra,
  };
}

function names(sequences: RegisteredSequence[], duration = 300) {
  return scenesOf(sequences, duration).map(
    (scene) => `${scene.name}@${scene.from}+${scene.duration}`
  );
}

describe("scenesOf", () => {
  it("takes the top-level sequences a Series lays out, in playback order", () => {
    expect(
      names([
        sequence("Outro", 200, 100),
        sequence("Intro", 0, 90),
        sequence("Features", 90, 110),
      ])
    ).toEqual(["Intro@0+90", "Features@90+110", "Outro@200+100"]);
  });

  it("leaves audio, video and hidden sequences out", () => {
    expect(
      names([
        sequence("Intro", 0, 150),
        sequence("Track", 0, 300, { type: "audio" }),
        sequence("Clip", 0, 300, { type: "video" }),
        sequence("Premount", 0, 300, { showInTimeline: false }),
        sequence("Outro", 150, 150),
      ])
    ).toEqual(["Intro@0+150", "Outro@150+150"]);
  });

  it("looks inside one sequence that wraps the whole video", () => {
    expect(
      names([
        sequence("Film", 0, 300),
        sequence("Intro", 0, 100, { parent: "Film" }),
        sequence("Outro", 100, 200, { parent: "Film" }),
      ])
    ).toEqual(["Intro@0+100", "Outro@100+200"]);
  });

  it("descends through wrappers nested inside each other", () => {
    expect(
      names([
        sequence("Film", 0, 300),
        sequence("Act", 0, 300, { parent: "Film" }),
        sequence("Intro", 20, 100, { parent: "Act" }),
        sequence("Outro", 120, 180, { parent: "Act" }),
      ])
    ).toEqual(["Intro@20+100", "Outro@120+180"]);
  });

  it("counts a scene's start from a wrapper that starts before the video", () => {
    expect(
      names([
        sequence("Film", -10, 320),
        sequence("Intro", 10, 100, { parent: "Film" }),
        sequence("Outro", 110, 200, { parent: "Film" }),
      ])
    ).toEqual(["Intro@0+100", "Outro@100+200"]);
  });

  it("does not look inside a sequence that covers only part of the video", () => {
    expect(
      names([
        sequence("Intro", 0, 100),
        sequence("Inner", 0, 50, { parent: "Intro" }),
      ])
    ).toEqual([]);
  });

  it("names an unnamed scene after its component, else by position", () => {
    function PricingScene() {
      return null;
    }
    function CustomerStories() {
      return null;
    }
    expect(
      names([
        sequence("", 0, 100, {
          displayName: "<Series.Sequence>",
          singleChildComponent: PricingScene,
        }),
        sequence("", 100, 100, {
          displayName: "",
          singleChildComponent: CustomerStories,
        }),
        sequence("", 200, 100, { displayName: "<TransitionSeries.Sequence>" }),
      ])
    ).toEqual(["Pricing@0+100", "Customer Stories@100+100", "Scene 3@200+100"]);
  });

  it("keeps a name the video gave, even one in angle brackets inside", () => {
    expect(
      names([
        sequence("Intro <cold open>", 0, 150),
        sequence("Outro", 150, 150),
      ])
    ).toEqual(["Intro <cold open>@0+150", "Outro@150+150"]);
  });

  it("shows no scenes for a video of one scene", () => {
    expect(names([sequence("Only", 0, 300)])).toEqual([]);
  });
});

describe("sameScenes", () => {
  it("compares names and frames, not ids", () => {
    const one = scenesOf([sequence("A", 0, 100), sequence("B", 100, 200)], 300);
    const two = scenesOf(
      [
        sequence("A", 0, 100, { id: "x" }),
        sequence("B", 100, 200, { id: "y" }),
      ],
      300
    );

    expect(sameScenes(one, two)).toBe(true);
    expect(sameScenes(one, one.slice(1))).toBe(false);
  });
});
