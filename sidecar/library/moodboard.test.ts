import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { LIBRARY_DIR_ENV } from "@/shared/ipc";
import type { MoodboardSpec } from "@/shared/moodboard";
import {
  findMoodboard,
  type MoodboardDraft,
  moodboardBrief,
  moodboardHtml,
  saveMoodboard,
} from "./moodboard";

let library = "";
let work = "";

beforeEach(() => {
  library = mkdtempSync(join(tmpdir(), "remocn-moodboard-lib-"));
  work = mkdtempSync(join(tmpdir(), "remocn-moodboard-work-"));
  process.env[LIBRARY_DIR_ENV] = library;
});

afterEach(() => {
  delete process.env[LIBRARY_DIR_ENV];
  rmSync(library, { force: true, recursive: true });
  rmSync(work, { force: true, recursive: true });
});

const PNG = Buffer.from("png-bytes");

const NOT_HEX = /not a hex color/;
const NO_IMAGES = /at least one image/;

function render(input: { output: string; url: string }) {
  return Effect.promise(async () => {
    await writeFile(input.output, PNG);
    return input.output;
  });
}

function fetcher(bytes = Buffer.from("jpeg-bytes")): typeof fetch {
  return (() =>
    Promise.resolve(
      new Response(bytes, { status: 200 })
    )) as unknown as typeof fetch;
}

function draft(shape: Partial<MoodboardDraft> = {}): MoodboardDraft {
  return {
    images: [
      {
        columns: null,
        file: null,
        note: "anchor",
        role: "photo",
        rows: null,
        source: {
          author: "Anna",
          authorUrl: "https://pexels.com/@anna",
          id: "42",
          provider: "pexels",
          url: "https://pexels.com/photo/42",
        },
        url: "https://images.pexels.com/photos/42/warm.jpeg",
      },
    ],
    keywords: ["warm", "calm"],
    palette: [{ hex: "#1A2B3C", name: "ink" }],
    project: "project-1",
    title: "Warm launch",
    typography: [{ body: "Inter", heading: "DM Sans", sample: "" }],
    ...shape,
  };
}

function save(input: MoodboardDraft) {
  return Effect.runPromise(saveMoodboard(input, render, fetcher()));
}

describe("saveMoodboard", () => {
  it("stores spec, images and the rendered preview as one asset", async () => {
    const record = await save(draft());

    expect(record.asset.slug).toBe("warm-launch");
    expect(record.asset.type).toBe("img");
    expect(record.asset.files).toContain("spec.json");
    expect(record.asset.files).toContain("images/image-1.jpeg");
    expect(record.asset.preview).not.toBeNull();
    expect(readFileSync(record.asset.preview as string)).toEqual(PNG);

    const stored = JSON.parse(
      readFileSync(join(record.asset.path, "spec.json"), "utf8")
    ) as MoodboardSpec;
    expect(stored.project).toBe("project-1");
    expect(stored.palette[0]?.hex).toBe("#1a2b3c");
    expect(stored.images[0]?.source?.author).toBe("Anna");
    expect(
      readFileSync(join(record.asset.path, "images/image-1.jpeg"), "utf8")
    ).toBe("jpeg-bytes");
    expect(existsSync(join(record.asset.path, "board.html"))).toBe(false);
  });

  it("copies a local file instead of downloading it", async () => {
    const still = join(work, "frame.png");
    writeFileSync(still, "still-bytes", "utf8");

    const record = await save(
      draft({
        images: [
          {
            columns: 2,
            file: still,
            note: "",
            role: "photo",
            rows: 2,
            source: null,
            url: null,
          },
        ],
      })
    );

    expect(record.asset.files).toContain("images/image-1.png");
    expect(
      readFileSync(join(record.asset.path, "images/image-1.png"), "utf8")
    ).toBe("still-bytes");
  });

  it("replaces the project's existing board rather than piling up copies", async () => {
    await save(draft());
    const second = await save(draft({ title: "Warm launch v2" }));

    const found = await Effect.runPromise(findMoodboard("project-1"));
    expect(found?.asset.slug).toBe(second.asset.slug);
    expect(found?.asset.name).toBe("Warm launch v2");
    expect(existsSync(join(library, "assets", "warm-launch"))).toBe(false);
  });

  it("refuses a swatch that is not a hex color", async () => {
    await expect(
      save(draft({ palette: [{ hex: "teal", name: "" }] }))
    ).rejects.toThrow(NOT_HEX);
  });

  it("refuses a board with no images", async () => {
    await expect(save(draft({ images: [] }))).rejects.toThrow(NO_IMAGES);
  });
});

describe("findMoodboard", () => {
  it("answers null for a project with no board", async () => {
    await save(draft());
    expect(await Effect.runPromise(findMoodboard("project-2"))).toBeNull();
  });
});

describe("moodboardBrief", () => {
  it("names the preview and forbids regeneration", async () => {
    const record = await save(draft());
    const brief = moodboardBrief(record);

    expect(brief).toContain(record.asset.preview as string);
    expect(brief).toContain("do not regenerate");
    expect(brief).toContain('"project": "project-1"');
  });
});

describe("moodboardHtml", () => {
  const spec: MoodboardSpec = {
    images: [
      {
        columns: 3,
        file: "images/image-1.jpg",
        id: "image-1",
        note: "anchor <light>",
        role: "photo",
        rows: 2,
        source: {
          author: "Anna",
          authorUrl: "",
          id: "42",
          provider: "pexels",
          url: "",
        },
      },
    ],
    keywords: ["warm"],
    palette: [{ hex: "#1a2b3c", id: "swatch-1", name: "ink" }],
    project: null,
    title: "Warm & bold",
    typography: [
      { body: "Inter", heading: "DM Sans", id: "type-1", sample: "" },
    ],
  };

  it("draws every block of the spec and escapes what the person wrote", () => {
    const html = moodboardHtml(spec);

    expect(html).toContain('src="images/image-1.jpg"');
    expect(html).toContain("grid-column: span 3");
    expect(html).toContain("anchor &lt;light&gt;");
    expect(html).toContain("Warm &amp; bold");
    expect(html).toContain("#1a2b3c");
    expect(html).toContain("fonts.googleapis.com/css2");
    expect(html).toContain("DM Sans");
    expect(html).toContain("Photography: Anna — Pexels");
  });

  it("skips the fonts link and credits when the spec has neither", () => {
    const html = moodboardHtml({
      ...spec,
      images: spec.images.map((image) => ({ ...image, source: null })),
      typography: [],
    });

    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("Photography:");
  });
});
