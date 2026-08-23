import { Exit } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeMoodboardSpec,
  fontFamilies,
  googleFontsHref,
  isHexColor,
  type MoodboardSpec,
} from "./moodboard";

function spec(shape: Partial<MoodboardSpec> = {}): MoodboardSpec {
  return {
    images: [],
    keywords: [],
    palette: [],
    project: null,
    title: "Warm launch",
    typography: [],
    ...shape,
  };
}

describe("MoodboardSpec", () => {
  it("decodes a minimal spec with defaults for everything optional", () => {
    const decoded = decodeMoodboardSpec({
      images: [{ file: "images/image-1.jpg", id: "image-1" }],
      title: "Warm launch",
    });

    expect(Exit.isSuccess(decoded)).toBe(true);
    if (Exit.isSuccess(decoded)) {
      expect(decoded.value.images[0]).toEqual({
        columns: 2,
        file: "images/image-1.jpg",
        id: "image-1",
        note: "",
        role: "photo",
        rows: 2,
        source: null,
      });
      expect(decoded.value.keywords).toEqual([]);
      expect(decoded.value.palette).toEqual([]);
      expect(decoded.value.project).toBeNull();
      expect(decoded.value.typography).toEqual([]);
    }
  });

  it("refuses a spec without a title", () => {
    expect(Exit.isSuccess(decodeMoodboardSpec({ images: [] }))).toBe(false);
  });
});

describe("isHexColor", () => {
  it("accepts #rrggbb in either case and nothing else", () => {
    expect(isHexColor("#1a2b3c")).toBe(true);
    expect(isHexColor("#1A2B3C")).toBe(true);
    expect(isHexColor("1a2b3c")).toBe(false);
    expect(isHexColor("#1a2b")).toBe(false);
    expect(isHexColor("#1a2b3c4d")).toBe(false);
  });
});

describe("googleFontsHref", () => {
  it("is null with no typography", () => {
    expect(googleFontsHref(spec())).toBeNull();
  });

  it("names each family once, spaces as plus signs", () => {
    const href = googleFontsHref(
      spec({
        typography: [
          { body: "Inter", heading: "DM Sans", id: "type-1", sample: "" },
          { body: "Inter", heading: "Fraunces", id: "type-2", sample: "" },
        ],
      })
    );

    expect(href).toContain("family=DM+Sans:wght@400;700");
    expect(href).toContain("family=Fraunces:wght@400;700");
    expect(href?.match(/family=Inter/g)).toHaveLength(1);
    expect(href).toContain("display=swap");
  });
});

describe("fontFamilies", () => {
  it("keeps heading before body and drops duplicates", () => {
    expect(
      fontFamilies(
        spec({
          typography: [
            { body: "Inter", heading: "Inter", id: "type-1", sample: "" },
          ],
        })
      )
    ).toEqual(["Inter"]);
  });
});
