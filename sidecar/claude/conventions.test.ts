import { describe, expect, it } from "bun:test";
import {
  ELEMENT_ROLES,
  MOTION_DICTIONARY,
  MOTION_ROLES,
} from "@/shared/motion";
import { PIPELINE_STAGE_IDS, stageTemplate } from "@/shared/pipeline";
import {
  BUNDLE_NAME,
  INTERACTIVITY_SKILL,
  LESSONS_SKILL,
  MOTION_SKILL,
  SHIPPED,
} from "@/sidecar/agent/knowledge";
import {
  conventionsFor,
  FREE_CONVENTIONS,
  pipelineBrief,
  STUDIO_CONVENTIONS,
} from "@/sidecar/claude/conventions";

const NAMED = `\`${LESSONS_SKILL}\``;
const MARKUP = `\`${INTERACTIVITY_SKILL}\``;
const MOTION = `\`${MOTION_SKILL}\``;

describe("conventionsFor on Free", () => {
  it("keeps the structure: the lane, Root.tsx, the audiomap, editability", () => {
    const text = conventionsFor(false, null, "free");
    const compact = text.replaceAll("\n", " ");

    expect(text).toBe(FREE_CONVENTIONS);
    expect(compact).toContain("working on exactly one of them");
    expect(text).toContain("never edit `Root.tsx`");
    expect(text).toContain("beat_cut");
    expect(text).toContain("Keep the result editable");
    expect(text).toContain("[Element #N]");
  });

  it("asks for every scene to be named and described by a scene object", () => {
    for (const plan of ["free", "pro"] as const) {
      const compact = conventionsFor(false, null, plan).replaceAll("\n", " ");

      expect(compact).toContain("carries a short human `name`");
      expect(compact).toContain('definition id "scene"');
      expect(compact).toContain("label exactly the sequence's name");
      expect(compact).toContain(
        "Set every other object's parentId to its scene's object"
      );
    }
  });

  it("drops every craft mandate and every Pro tool, whatever the bundle said", () => {
    for (const text of [
      conventionsFor(true, null, "free"),
      conventionsFor(false, null, "free"),
    ]) {
      expect(text).not.toContain(BUNDLE_NAME);
      expect(text).not.toContain(LESSONS_SKILL);
      expect(text).not.toContain(MOTION_SKILL);
      expect(text).not.toContain(INTERACTIVITY_SKILL);
      expect(text).not.toContain("mcp__remocn-pipeline__");
      expect(text).not.toContain("design_check");
      expect(text).not.toContain("Unless the project's brand");
      expect(text).not.toContain("InteractivitySchema");
      expect(text).not.toContain("runs inside a camera");
      expect(text).not.toContain("the movement dictionary");
      expect(text).not.toContain("seven-stage");
      expect(text).not.toContain("moodboard");
    }
  });

  it("is the whole of what a Pro turn reads, minus the craft and the pipeline", () => {
    expect(STUDIO_CONVENTIONS).toContain(
      FREE_CONVENTIONS.split("\n\n")[0] ?? ""
    );
    for (const paragraph of FREE_CONVENTIONS.split("\n\n")) {
      expect(STUDIO_CONVENTIONS).toContain(paragraph);
    }
    expect(STUDIO_CONVENTIONS.length).toBeGreaterThan(FREE_CONVENTIONS.length);
  });
});

describe("conventionsFor", () => {
  it("orders the lessons skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(NAMED);
  });

  it("names the bundle and every skill in it, so any runtime's catalog matches", () => {
    const text = conventionsFor(true);

    expect(text).toContain(`\`${BUNDLE_NAME}\``);
    for (const skill of SHIPPED) {
      expect(text).toContain(skill);
    }
  });

  it("orders a skill in words no single runtime owns", () => {
    const text = conventionsFor(true);

    expect(text).not.toContain(`${BUNDLE_NAME}:${LESSONS_SKILL}`);
    expect(text).not.toContain(`${BUNDLE_NAME}:${MOTION_SKILL}`);
    expect(text).not.toContain(`${BUNDLE_NAME}:${INTERACTIVITY_SKILL}`);
  });

  it("orders the interactivity skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(MARKUP);
  });

  it("orders the motion-design skill by the name the bundle ships it under", () => {
    expect(conventionsFor(true)).toContain(MOTION);
  });

  it("never orders a skill that is not loaded", () => {
    const alone = conventionsFor(false);

    expect(alone).toBe(STUDIO_CONVENTIONS);
    expect(alone).not.toContain(NAMED);
    expect(alone).not.toContain(LESSONS_SKILL);
    expect(alone).not.toContain(MARKUP);
    expect(alone).not.toContain(MOTION);
    expect(alone).not.toContain(MOTION_SKILL);
    expect(alone).not.toContain(BUNDLE_NAME);
  });

  it("keeps the app's own conventions either way", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text.replaceAll("\n", " ")).toContain(
        "working on exactly one of them"
      );
      expect(text).toContain("never edit `Root.tsx`");
      expect(text).toContain("[Element #N]");
      expect(text).toContain("mcp__remocn-design__design_check");
      expect(text).toContain("fix every mechanical finding");
    }
  });

  it("names the video the turn is about, and only when it knows it", () => {
    const named = conventionsFor(false, "opening-title");

    expect(named).toContain("`src/videos/opening-title/`");
    expect(conventionsFor(false)).not.toContain("Your video for this");
  });

  it("requires a parameter schema with or without the plugin", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      expect(text).toContain("Zod schema");
      expect(text).toContain("zColor()");
      expect(text).toContain("InteractivitySchema");
      expect(text).toContain("unless the person asks");
    }
  });

  // The interpolation editor only ever renders what a schema declares, so the
  // mandate is what makes the easing pane exist at all in agent-written code.
  it("makes the interactivity schema unconditional, not a thing to ask for", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("Every nested scene, element and transition");
      expect(compact).toContain("a file exports only the wrapped component");
    }
  });

  it("makes a tunable easing part of every animated component", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("exposes its easing");
      expect(compact).toContain("always, not only when asked");
      expect(compact).toContain("ending in `Easing`");
      expect(compact).toContain("always a four-number cubic-bezier array");
      expect(compact).toContain("Never an enum of easing names");
      expect(compact).toContain("Easing.bezier(...easing)");
      expect(compact).toContain("newItemDefault: 0");
      expect(compact).toContain("only where it is sampled");
      expect(compact).toContain("is not an easing");
    }
  });

  // The pane finds a spring by the shape of its paths, so the names in the
  // conventions and the names `springsIn` groups on are one decision.
  it("names the three numbers a spring is made of", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("`spring.damping`, `spring.stiffness` and");
      expect(compact).toContain("`spring.mass`");
      expect(compact).toContain("one group per spring");
      expect(compact).toContain("`entry.spring.damping`");
    }
  });

  it("sends a requested change to the component the block says owns it", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain(
        "grouped by the component that owns each one, with its file and line"
      );
      expect(compact).toContain("not the element the token names");
    }
  });

  it("asks for one named text element per run of text", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      const compact = text.replaceAll("\n", " ");

      expect(compact).toContain("whose direct child is the string");
      expect(compact).toContain("unique in the frame");
      expect(compact).toContain("text-content");
    }
  });
});

describe("the movement taxonomy", () => {
  it("reaches a turn whether or not the bundled skills loaded", () => {
    for (const text of [conventionsFor(true), conventionsFor(false)]) {
      for (const role of MOTION_ROLES) {
        expect(text).toContain(`\`${role}\``);
      }
    }
  });

  it("spells out the dictionary, so the words are the same on both sides", () => {
    const text = STUDIO_CONVENTIONS;

    for (const role of ELEMENT_ROLES) {
      for (const name of MOTION_DICTIONARY[role]) {
        expect(text).toContain(name);
      }
    }
  });

  it("says which props a movement role expects", () => {
    expect(STUDIO_CONVENTIONS).toContain("durationInFrames, delay, stagger");
    expect(STUDIO_CONVENTIONS).toContain("beat_cut");
    expect(STUDIO_CONVENTIONS).toContain("phrase_flow");
    expect(STUDIO_CONVENTIONS).toContain("intensity, repeat, delay");
  });

  it("sends an invented behaviour to the library with its role", () => {
    expect(STUDIO_CONVENTIONS).toContain("mcp__remocn-library__save_asset");
  });

  it("leaves the recipes to the skill that carries them", () => {
    expect(conventionsFor(true)).toContain("the movement dictionary");
    expect(conventionsFor(false)).not.toContain("the movement dictionary");
  });
});

// The literal `video/` these templates used to carry meant a project's second
// video overwrote the first one's script. The brief is the only place the
// agent learns where to write, so the slug has to reach it.
describe("the pipeline brief's document paths", () => {
  it("names the video's own docs folder, per video", () => {
    const brief = pipelineBrief(
      [{ stage: "script", status: "active" }],
      "opening-title"
    );

    expect(brief).toContain("src/videos/opening-title/docs/script.md");
    expect(brief).not.toContain("video/script.md");
  });

  it("substitutes every stage, not only the one that names an output", () => {
    for (const stage of PIPELINE_STAGE_IDS) {
      const brief =
        pipelineBrief([{ stage, status: "active" }], "opening-title") ?? "";

      expect(brief).not.toContain("{docs}");
      expect(brief).not.toContain("{video}");
    }
  });

  it("sends the brand stage's identity assets into the video's folder", () => {
    const brief = pipelineBrief(
      [{ stage: "brand", status: "active" }],
      "opening-title"
    );

    expect(brief).toContain("src/videos/opening-title/assets/");
  });

  // A row we could not read costs the slug and nothing else: the brief still
  // says what the stage is for.
  it("still reads as a folder when the turn could not name its video", () => {
    const brief = pipelineBrief([{ stage: "script", status: "active" }]);

    expect(brief).toContain("src/videos/");
    expect(brief).toContain("/docs/script.md");
    expect(brief).not.toContain("{docs}");
  });
});

describe("the choreography stage", () => {
  const brief = pipelineBrief([{ stage: "choreography", status: "active" }]);

  it("stands between building and reviewing, because it is a property of the whole", () => {
    expect([...PIPELINE_STAGE_IDS]).toEqual([
      "analysis",
      "brand",
      "script",
      "motion",
      "build",
      "choreography",
      "review",
    ]);
  });

  it("says the pipeline has seven stages and names the new one", () => {
    expect(STUDIO_CONVENTIONS).toContain("seven-stage");
    expect(STUDIO_CONVENTIONS).toContain(
      "analysis, brand, script, motion, build, choreography, review"
    );
  });

  it("hands the agent the whole checklist, in order", () => {
    const checklist = stageTemplate("choreography").checklist ?? [];

    expect(checklist).toHaveLength(5);
    for (const item of checklist) {
      expect(brief).toContain(`- ${item}`);
    }
  });

  it("sends the agent to measure the whole video rather than read the code", () => {
    expect(brief).toContain("mcp__remocn-design__design_check");
    expect(brief).toContain("scene map");
  });

  it("puts the checklist only on the stage that has one", () => {
    for (const stage of PIPELINE_STAGE_IDS) {
      const text = pipelineBrief([{ stage, status: "active" }]) ?? "";
      const hasChecklist = text.includes("Work this stage's checklist");

      expect(hasChecklist).toBe(stageTemplate(stage).checklist !== undefined);
    }
  });
});

describe("draft-first production instructions", () => {
  it("delivers reuse, a complete draft and local correction in the active briefs", () => {
    const motion = pipelineBrief(
      [{ stage: "motion", status: "active" }],
      "intro"
    );
    const build =
      pipelineBrief([{ stage: "build", status: "active" }], "intro") ?? "";

    expect(motion).toContain("mcp__remocn-library__list_assets");
    expect(motion).toContain("shot-to-component map");
    expect(motion).toContain(
      "Stop searching when each shot has a suitable implementation"
    );
    const draft = build.indexOf("Complete draft.");
    const inspect = build.indexOf("Inspect the draft.");
    const correct = build.indexOf("Local corrections.");
    expect(draft).toBeGreaterThanOrEqual(0);
    expect(inspect).toBeGreaterThan(draft);
    expect(correct).toBeGreaterThan(inspect);
    expect(build).toContain("src/videos/intro/assets/keyframes/");
    expect(build).toContain("src/videos/intro/assets/proof/");
    expect(build).toContain("dependent neighbors");
  });

  it("keeps iteration sampled while preserving the full review gate", () => {
    for (const stage of ["build", "choreography"] as const) {
      expect(pipelineBrief([{ stage, status: "active" }])).toContain(
        "mode=sampled"
      );
    }
    const review = pipelineBrief([{ stage: "review", status: "active" }]);
    expect(review).toContain("mode=full");
    expect(review).toContain("reviewReportId");
    expect(review).toContain(
      "changed sources or settings require a new full check"
    );
  });

  it("preserves draft-first order with or without bundled skills", () => {
    for (const hasSkills of [true, false]) {
      const text = conventionsFor(hasSkills).replaceAll("\n", " ");
      expect(text).toContain("reuse components, assemble the complete draft");
      expect(text).toContain(
        "For a pointed edit, reuse the existing component map"
      );
      expect(text).not.toContain("Before expanding a new film");
    }
  });
});

it("gives managed videos precedence over legacy Interactive authoring rules", () => {
  for (const plan of ["free", "pro"] as const) {
    const text = conventionsFor(true, "intro", plan);
    expect(text).toContain("studio-objects-v5/README.md");
    expect(text).toContain("useStudioObject(stableId)");
    expect(text).toContain("takes precedence over the legacy Interactive");
  }
});
