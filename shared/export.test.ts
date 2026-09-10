import { describe, expect, it } from "bun:test";
import {
  changeSettings,
  DEFAULT_EXPORT_SETTINGS,
  EXPORT_FORMATS,
  type ExportSettings,
  FORMAT_SPECS,
  fileNameOf,
  outputSize,
  presetSettings,
  qualityFor,
  ratioLabel,
  ratioWarning,
  reviewExport,
  scaleFor,
  stemFrom,
  stemOf,
  typedName,
  withExtension,
} from "./export";

const LANDSCAPE = { height: 1080, width: 1920 };
const PORTRAIT = { height: 1920, width: 1080 };
const SQUARE = { height: 1080, width: 1080 };

describe("scaleFor", () => {
  it("leaves the source alone", () => {
    expect(scaleFor("source", LANDSCAPE)).toBe(1);
  });

  it("measures the short side, whichever it is", () => {
    expect(scaleFor("720", LANDSCAPE)).toBeCloseTo(720 / 1080, 10);
    expect(scaleFor("1080", PORTRAIT)).toBe(1);
    expect(scaleFor("1080", LANDSCAPE)).toBe(1);
  });

  it("keeps a composition with no size at 1", () => {
    expect(scaleFor("1080", { height: 0, width: 0 })).toBe(1);
  });
});

describe("outputSize", () => {
  it("scales the long side with the short one", () => {
    expect(
      outputSize({ format: "mp4", scale: 720 / 1080, size: LANDSCAPE })
    ).toEqual({ height: 720, width: 1280 });
  });

  it("keeps 9:16 vertical at the 1080 preset", () => {
    const scale = scaleFor("1080", PORTRAIT);

    expect(outputSize({ format: "mp4", scale, size: PORTRAIT })).toEqual({
      height: 1920,
      width: 1080,
    });
  });

  it("trims an odd side for H.264 and leaves it for the others", () => {
    const odd = { height: 1081, width: 1921 };

    expect(outputSize({ format: "mp4", scale: 1, size: odd })).toEqual({
      height: 1080,
      width: 1920,
    });
    expect(outputSize({ format: "webm", scale: 1, size: odd })).toEqual({
      height: 1081,
      width: 1921,
    });
  });

  it("answers nothing for a scale that is not a positive number", () => {
    expect(outputSize({ format: "mp4", scale: 0, size: LANDSCAPE })).toEqual({
      height: 0,
      width: 0,
    });
    expect(
      outputSize({ format: "mp4", scale: Number.NaN, size: LANDSCAPE })
    ).toEqual({ height: 0, width: 0 });
  });
});

describe("qualityFor", () => {
  it("passes nothing on for the project's own settings", () => {
    for (const format of EXPORT_FORMATS) {
      expect(qualityFor(format, "project")).toEqual({
        crf: null,
        proResProfile: null,
      });
    }
  });

  it("gives each codec its own CRF scale", () => {
    expect(qualityFor("mp4", "standard").crf).toBe(18);
    expect(qualityFor("webm", "standard").crf).toBe(28);
    expect(qualityFor("mp4", "high").crf).toBeLessThan(
      qualityFor("mp4", "draft").crf ?? 0
    );
  });

  it("gives ProRes a profile instead of a CRF", () => {
    expect(qualityFor("mov", "draft")).toEqual({
      crf: null,
      proResProfile: "proxy",
    });
    expect(qualityFor("mov", "high").proResProfile).toBe("hq");
  });

  it("has no quality to pick for a GIF", () => {
    expect(qualityFor("gif", "high")).toEqual({
      crf: null,
      proResProfile: null,
    });
  });
});

describe("presets", () => {
  it("fills H.264, 1080 short side and High", () => {
    expect(presetSettings("youtube")).toEqual({
      format: "mp4",
      preset: "youtube",
      quality: "high",
      resolution: "1080",
    });
  });

  it("falls to Custom when a field moves", () => {
    const picked = presetSettings("shorts");

    expect(changeSettings(picked, { format: "gif" }).preset).toBe("custom");
    expect(changeSettings(picked, { quality: "draft" }).preset).toBe("custom");
  });

  it("stays on the preset when the patch changes nothing", () => {
    const picked = presetSettings("instagram");

    expect(changeSettings(picked, { format: "mp4" })).toBe(picked);
  });
});

describe("ratioWarning", () => {
  it("says nothing for Custom", () => {
    expect(ratioWarning("custom", PORTRAIT)).toBeNull();
  });

  it("says nothing when the shape already matches", () => {
    expect(ratioWarning("youtube", LANDSCAPE)).toBeNull();
    expect(ratioWarning("shorts", PORTRAIT)).toBeNull();
    expect(ratioWarning("instagram", SQUARE)).toBeNull();
    expect(ratioWarning("instagram", { height: 1350, width: 1080 })).toBeNull();
  });

  it("tolerates a pixel of rounding", () => {
    expect(ratioWarning("youtube", { height: 1081, width: 1920 })).toBeNull();
  });

  it("names both shapes when they differ", () => {
    const said = ratioWarning("youtube", PORTRAIT);

    expect(said).toContain("16:9");
    expect(said).toContain("9:16");
  });
});

describe("ratioLabel", () => {
  it("reduces to the familiar pair", () => {
    expect(ratioLabel(LANDSCAPE)).toBe("16:9");
    expect(ratioLabel(PORTRAIT)).toBe("9:16");
    expect(ratioLabel(SQUARE)).toBe("1:1");
  });

  it("gives up on a pair nobody would read", () => {
    expect(ratioLabel({ height: 1080, width: 1999 })).toBe("1.85:1");
  });
});

describe("fileNameOf", () => {
  it("names the preset in the file", () => {
    expect(
      fileNameOf({ composition: "Intro", format: "mp4", preset: "youtube" })
    ).toBe("Intro-youtube.mp4");
  });

  it("leaves a custom export named after the video", () => {
    expect(
      fileNameOf({ composition: "Intro", format: "webm", preset: "custom" })
    ).toBe("Intro.webm");
  });

  it("keeps a composition nobody could put in a path safe", () => {
    expect(
      fileNameOf({ composition: "a/b c", format: "gif", preset: "custom" })
    ).toBe("a-b-c.gif");
  });
});

describe("naming the file", () => {
  it("carries the preset into the stem, and nothing else does", () => {
    expect(stemOf({ composition: "Intro", preset: "youtube" })).toBe(
      "Intro-youtube"
    );
    expect(stemOf({ composition: "Intro", preset: "custom" })).toBe("Intro");
  });

  it("will not let a typed name walk out of the folder on screen", () => {
    expect(typedName("../../etc/passwd")).toBe("..-..-etc-passwd");
    expect(typedName("a/b")).toBe("a-b");
    expect(typedName("a\\b")).toBe("a-b");
  });

  it("keeps what somebody typed, spaces and all", () => {
    expect(typedName("Opening title")).toBe("Opening title");
  });

  it("takes the format's own ending off a chosen name and leaves the rest", () => {
    expect(stemFrom("Intro.mp4", "mp4")).toBe("Intro");
    expect(stemFrom("Intro.mov", "mp4")).toBe("Intro");
    expect(stemFrom("Intro.mp4", "webm")).toBe("Intro.mp4");
    expect(stemFrom("Intro", "mp4")).toBe("Intro");
  });
});

describe("withExtension", () => {
  it("leaves a name the renderer already accepts", () => {
    expect(withExtension("/tmp/Main.mp4", "mp4")).toEqual({
      changed: false,
      path: "/tmp/Main.mp4",
    });
    expect(withExtension("/tmp/Main.MP4", "mp4").changed).toBe(false);
  });

  it("keeps the other endings the renderer takes for that codec", () => {
    expect(withExtension("/tmp/Main.mkv", "mp4").changed).toBe(false);
    expect(withExtension("/tmp/Main.mov", "mp4").changed).toBe(false);
  });

  it("appends rather than replacing what somebody typed", () => {
    expect(withExtension("/tmp/Main.txt", "mp4")).toEqual({
      changed: true,
      path: "/tmp/Main.txt.mp4",
    });
    expect(withExtension("/tmp/Main", "webm").path).toBe("/tmp/Main.webm");
  });

  it("does not read a dot in the folder as an ending", () => {
    expect(withExtension("/tmp/my.videos/Main", "gif").path).toBe(
      "/tmp/my.videos/Main.gif"
    );
  });

  it("refuses an mp4 ending for a WebM", () => {
    expect(withExtension("/tmp/Main.mp4", "webm")).toEqual({
      changed: true,
      path: "/tmp/Main.mp4.webm",
    });
  });
});

describe("reviewExport", () => {
  const settings = (patch: Partial<ExportSettings>): ExportSettings => ({
    ...DEFAULT_EXPORT_SETTINGS,
    ...patch,
  });

  it("reports the real output size", () => {
    const review = reviewExport(settings({ resolution: "720" }), LANDSCAPE);

    expect(review.output).toEqual({ height: 720, width: 1280 });
    expect(review.problems).toEqual([]);
  });

  it("exports a 9:16 video at 1080 as 1080×1920", () => {
    const review = reviewExport({ ...presetSettings("shorts") }, PORTRAIT);

    expect(review.output).toEqual({ height: 1920, width: 1080 });
    expect(review.problems).toEqual([]);
    expect(review.warnings).toEqual([]);
  });

  it("warns about an upscale rather than refusing it", () => {
    const review = reviewExport(settings({ resolution: "2160" }), LANDSCAPE);

    expect(review.problems).toEqual([]);
    expect(review.warnings.some((line) => line.includes("upscale"))).toBe(true);
    expect(review.output).toEqual({ height: 2160, width: 3840 });
  });

  it("refuses a scale past what the renderer takes", () => {
    const review = reviewExport(settings({ resolution: "2160" }), {
      height: 100,
      width: 100,
    });

    expect(review.problems.length).toBe(1);
  });

  it("says a preset does not match the shape without changing it", () => {
    const review = reviewExport(presetSettings("youtube"), PORTRAIT);

    expect(review.problems).toEqual([]);
    expect(review.output).toEqual({ height: 1920, width: 1080 });
    expect(review.warnings.some((line) => line.includes("16:9"))).toBe(true);
  });

  it("says a GIF has no audio", () => {
    const review = reviewExport(settings({ format: "gif" }), LANDSCAPE);

    expect(review.warnings).toContain("A GIF carries no audio.");
  });

  it("has nothing to say about a composition with no size", () => {
    const review = reviewExport(DEFAULT_EXPORT_SETTINGS, {
      height: 0,
      width: 0,
    });

    expect(review.problems.length).toBe(1);
  });
});

describe("FORMAT_SPECS", () => {
  it("has an entry per format, with its own extension", () => {
    const extensions = EXPORT_FORMATS.map(
      (format) => FORMAT_SPECS[format].extension
    );

    expect(new Set(extensions).size).toBe(EXPORT_FORMATS.length);
  });

  it("marks H.264 as the one format with even dimensions", () => {
    expect(
      EXPORT_FORMATS.filter((format) => FORMAT_SPECS[format].even)
    ).toEqual(["mp4"]);
  });
});
