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

  it("finds a Series' scenes beside a soundtrack and an overlay", () => {
    function IsInsideSeriesContainer() {
      return null;
    }
    const cuts: [string, number, number][] = [
      ["Name", 0, 165],
      ["Paste", 165, 105],
      ["September", 270, 75],
      ["Bauhaus", 345, 135],
      ["Grid", 480, 135],
      ["Accents", 615, 60],
      ["Type", 675, 135],
      ["Signature", 810, 90],
    ];
    const registered = [
      sequence("series", 0, 900, {
        displayName: "<Series>",
        singleChildComponent: IsInsideSeriesContainer,
      }),
      ...cuts.map(([name, from, duration]) =>
        sequence(name, from, duration, {
          isInsideSeries: true,
          parent: "series",
        })
      ),
      sequence("Stripe", 20, 60, { parent: "Type" }),
      sequence("Score", 0, 846),
      sequence("score-audio", 0, 846, { parent: "Score", type: "audio" }),
      sequence("Score ending", 840, 60),
      sequence("Sound: whoosh-1", 158, 12),
      sequence("Sound: tick-4", 600, 30),
      sequence("Sound: tick-5", 780, 8),
      sequence("tick-audio", 0, 8, { parent: "Sound: tick-5", type: "audio" }),
      sequence("Dot to baseline", 660, 45),
    ];

    expect(names(registered, 900)).toEqual([
      "Name@0+165",
      "Paste@165+105",
      "September@270+75",
      "Bauhaus@345+135",
      "Grid@480+135",
      "Accents@615+60",
      "Type@675+135",
      "Signature@810+90",
    ]);
  });

  it("prefers the Series over another sequence spanning the video", () => {
    expect(
      names([
        sequence("Light", 0, 300),
        sequence("Leak 1", 10, 20, { parent: "Light" }),
        sequence("Leak 2", 100, 20, { parent: "Light" }),
        sequence("Leak 3", 200, 20, { parent: "Light" }),
        sequence("series", 0, 300, { displayName: "<Series>" }),
        sequence("Intro", 0, 150, { isInsideSeries: true, parent: "series" }),
        sequence("Outro", 150, 150, { isInsideSeries: true, parent: "series" }),
      ])
    ).toEqual(["Intro@0+150", "Outro@150+150"]);
  });

  it("keeps the scenes beside a background that holds none", () => {
    expect(
      names([
        sequence("Background", 0, 300),
        sequence("Grain", 0, 300, { parent: "Background" }),
        sequence("Intro", 0, 120),
        sequence("Outro", 120, 180),
      ])
    ).toEqual(["Intro@0+120", "Outro@120+180"]);
  });

  it("drops sequences that sit within the scenes around them", () => {
    expect(
      names([
        sequence("Intro", 0, 120),
        sequence("Sound: pop", 30, 10),
        sequence("Sound: whoosh", 110, 20),
        sequence("Outro", 120, 180),
      ])
    ).toEqual(["Intro@0+120", "Outro@120+180"]);
  });

  it("shows a scene once when two sequences cover the same frames", () => {
    expect(
      names([
        sequence("", 0, 120, { displayName: "<Sequence>" }),
        sequence("Intro", 0, 120),
        sequence("Outro", 120, 180),
        sequence("Outro again", 120, 180),
      ])
    ).toEqual(["Intro@0+120", "Outro@120+180"]);
  });

  it("keeps two scenes that overlap for a transition", () => {
    expect(
      names([sequence("Intro", 0, 170), sequence("Outro", 150, 150)])
    ).toEqual(["Intro@0+170", "Outro@150+150"]);
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
