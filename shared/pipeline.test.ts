import { describe, expect, it } from "vitest";
import {
  DOCS_TOKEN,
  docsFolderOf,
  PIPELINE_STAGE_IDS,
  resolveStage,
  STAGE_TEMPLATES,
  stageDocuments,
  stageTemplate,
  VIDEO_TOKEN,
  videoFolderOf,
  withVideoFolder,
} from "@/shared/pipeline";

describe("the documents folder", () => {
  it("lives inside the video, so deleting the folder takes them with it", () => {
    expect(videoFolderOf("opening-title")).toBe("src/videos/opening-title");
    expect(docsFolderOf("opening-title")).toBe("src/videos/opening-title/docs");
  });

  // The literal `video/` the templates used to carry is what let a project's
  // second video overwrite the first one's script.
  it("is per video, so two videos in one project cannot collide", () => {
    expect(docsFolderOf("intro")).not.toBe(docsFolderOf("outro"));
  });

  it("says which video it means even when the turn could not name one", () => {
    expect(docsFolderOf(null)).toContain("src/videos/");
    expect(docsFolderOf(null)).toContain("docs");
  });
});

describe("the stage templates", () => {
  it("name no document by a literal path — the slug is the only source", () => {
    for (const template of STAGE_TEMPLATES) {
      const text = [
        template.ask,
        template.discover,
        template.doneWhen,
        template.goal,
        ...template.outputs,
        ...(template.checklist ?? []),
      ].join("\n");

      expect(text).not.toContain("video/analysis.md");
      expect(text).not.toContain("video/script.md");
      expect(text).not.toContain("video/motion.md");
      expect(text).not.toContain("video/brand.md");
    }
  });

  it("substitutes both folders everywhere a stage speaks", () => {
    const brand = resolveStage(stageTemplate("brand"), "opening-title");

    expect(brand.outputs).toEqual([
      "src/videos/opening-title/docs/brand.md",
      "src/videos/opening-title/assets/",
    ]);
    expect(brand.discover).toContain("src/videos/opening-title/assets/");
    expect(brand.doneWhen).toContain("src/videos/opening-title/docs/brand.md");
    expect(brand.discover).not.toContain(DOCS_TOKEN);
    expect(brand.discover).not.toContain(VIDEO_TOKEN);
  });

  it("substitutes a checklist, which only one stage has", () => {
    const choreography = resolveStage(stageTemplate("choreography"), "intro");

    for (const item of choreography.checklist ?? []) {
      expect(item).not.toContain(DOCS_TOKEN);
    }
    expect(choreography.checklist).toHaveLength(5);
  });

  it("leaves text with no token alone", () => {
    expect(withVideoFolder("Read src/ and check the build.", "intro")).toBe(
      "Read src/ and check the build."
    );
  });
});

describe("stageDocuments", () => {
  const documents = stageDocuments();

  it("is derived from the outputs, so a viewer cannot name a file nothing writes", () => {
    for (const document of documents) {
      const template = stageTemplate(document.stage);

      expect(template.outputs).toContain(`${DOCS_TOKEN}/${document.name}`);
      expect(document.title).toBe(template.title);
    }
  });

  it("stands in pipeline order, which is the order of the tabs", () => {
    const order = documents.map((document) => document.stage);

    expect(order).toEqual([...order].sort(byPipeline));
    expect(documents.map((document) => document.name)).toEqual([
      "analysis.md",
      "brand.md",
      "script.md",
      "motion.md",
      "choreography.md",
      "review.md",
    ]);
  });

  // `src/` and `{video}/assets/` are outputs too, and neither is a document.
  it("takes only the markdown a stage writes into the docs folder", () => {
    for (const document of documents) {
      expect(document.name.endsWith(".md")).toBe(true);
      expect(document.name).not.toContain("/");
    }
  });
});

function byPipeline(one: string, other: string): number {
  return (
    PIPELINE_STAGE_IDS.indexOf(one as never) -
    PIPELINE_STAGE_IDS.indexOf(other as never)
  );
}
