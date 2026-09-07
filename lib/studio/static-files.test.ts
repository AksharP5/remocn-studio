import { describe, expect, it } from "bun:test";
import { assetName, assetOptions, assetUrl } from "@/lib/studio/static-files";

const BASE = "http://127.0.0.1:5173/static-abc123/";

describe("a static file's two shapes", () => {
  it("is a name in the pane and an absolute URL in the control", () => {
    expect(assetUrl("library/logo one.png", BASE)).toBe(
      `${BASE}library/logo%20one.png`
    );
    expect(assetName(`${BASE}library/logo%20one.png`, BASE)).toBe(
      "library/logo one.png"
    );
  });

  // A composition may point at a picture that is not the project's at all.
  it("leaves a remote URL alone in both directions", () => {
    expect(assetUrl("https://example.com/a.png", BASE)).toBe(
      "https://example.com/a.png"
    );
    expect(assetName("https://example.com/a.png", BASE)).toBe(
      "https://example.com/a.png"
    );
  });

  // A page built before the base was carried, or a host that never answered.
  it("shows the name it has when there is no base to build on", () => {
    expect(assetUrl("bg.png", null)).toBe("bg.png");
    expect(assetName("bg.png", null)).toBe("bg.png");
  });

  it("labels an option by its name, not by its URL", () => {
    expect(assetOptions(["a.png", "deep/b.png"], BASE)).toEqual([
      { label: "a.png", value: `${BASE}a.png` },
      { label: "deep/b.png", value: `${BASE}deep/b.png` },
    ]);
  });
});
