import { describe, expect, it } from "bun:test";
import {
  documentsByStage,
  documentTabs,
  touches,
} from "@/lib/studio/documents";
import type { ProjectFile } from "@/shared/ipc";

const FOLDER = "/Users/me/project/src/videos/intro/docs";

function file(name: string, modifiedAt = 1): ProjectFile {
  return { modifiedAt, name, path: `${FOLDER}/${name}` };
}

describe("documentTabs", () => {
  it("stands the stage outputs in pipeline order, whatever the folder gave", () => {
    const tabs = documentTabs([
      file("review.md"),
      file("analysis.md"),
      file("motion.md"),
      file("brand.md"),
    ]);

    expect(tabs.map((tab) => tab.file.name)).toEqual([
      "analysis.md",
      "brand.md",
      "motion.md",
      "review.md",
    ]);
  });

  // A stage that has not run yet has no document; the strip shows what is on
  // disk rather than what the pipeline promises.
  it("names no tab for a stage that has written nothing", () => {
    const tabs = documentTabs([file("script.md")]);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.stage).toBe("script");
    expect(tabs[0]?.title).toBe("Script");
  });

  it("puts everything else after the stages, by name", () => {
    const tabs = documentTabs([
      file("zebra.md"),
      file("script.md"),
      file("Notes.md"),
    ]);

    expect(tabs.map((tab) => tab.file.name)).toEqual([
      "script.md",
      "Notes.md",
      "zebra.md",
    ]);
    expect(tabs[1]?.stage).toBeNull();
    expect(tabs[1]?.title).toBeNull();
  });

  it("has nothing to say about an empty folder", () => {
    expect(documentTabs([])).toEqual([]);
  });
});

describe("documentsByStage", () => {
  it("answers only for the stages whose document is on disk", () => {
    const byStage = documentsByStage(
      documentTabs([file("script.md"), file("notes.md")])
    );

    expect(byStage.get("script")).toBe(`${FOLDER}/script.md`);
    expect(byStage.has("analysis")).toBe(false);
    expect(byStage.size).toBe(1);
  });
});

describe("touches", () => {
  const path = `${FOLDER}/script.md`;

  it("finds the path wherever a provider happens to spell it", () => {
    expect(touches({ file_path: path }, path)).toBe(true);
    expect(touches({ input: { path } }, path)).toBe(true);
    expect(touches([{ edits: [path] }], path)).toBe(true);
  });

  it("says no to a call about another file", () => {
    expect(touches({ file_path: `${FOLDER}/brand.md` }, path)).toBe(false);
    expect(touches(null, path)).toBe(false);
    expect(touches(42, path)).toBe(false);
  });
});
