import { describe, expect, it } from "vitest";
import { assetBase, assetName, assetValue, isImageName } from "./assets";

describe("an asset value, both ways", () => {
  // `staticFile("library/logo one.png")` is the base plus the name encoded
  // segment by segment; the pane is given the name back.
  it("reads the name out of what staticFile() produced", () => {
    expect(assetName("/static-abc/library/logo%20one.png", "/static-abc")).toBe(
      "library/logo one.png"
    );
    expect(assetName("https://example.com/a.png", "/static-abc")).toBe(
      "https://example.com/a.png"
    );
    expect(assetName("/other/a.png", "")).toBe("/other/a.png");
  });

  // Remotion resolves its own file token against the static base, for exactly
  // the fields it knows to be assets — so the name is what crosses back.
  it("writes a name as Remotion's own file token", () => {
    expect(assetValue("library/logo one.png")).toBe(
      "remotion-file:library/logo%20one.png"
    );
    expect(assetValue("")).toBe("");
    expect(assetValue("https://example.com/a.png")).toBe(
      "https://example.com/a.png"
    );
    expect(assetValue("/already/absolute.png")).toBe("/already/absolute.png");
  });

  it("is a round trip through the base it came from", () => {
    const token = assetValue("deep/name.png").replace("remotion-file:", "");

    expect(assetName(`/static-abc/${token}`, "/static-abc")).toBe(
      "deep/name.png"
    );
  });

  it("gives the app an absolute base to load pictures from", () => {
    expect(
      assetBase("/static-abc", "http://127.0.0.1:5173/?composition=x")
    ).toBe("http://127.0.0.1:5173/static-abc/");
    expect(assetBase("", "http://127.0.0.1:5173/")).toBeNull();
  });

  it("offers pictures, since the control that reads it draws one", () => {
    expect(["a.png", "b.JPEG", "c.svg", "d.webp"].every(isImageName)).toBe(
      true
    );
    expect(["clip.mp4", "song.mp3", "notes.md"].some(isImageName)).toBe(false);
  });
});
