import { describe, expect, it } from "vitest";
import { freeSlug, slugFor } from "./slug";

describe("slugFor", () => {
  it("kebabs a latin name", () => {
    expect(slugFor("Opening Title")).toBe("opening-title");
  });

  it("transliterates cyrillic rather than dropping it", () => {
    expect(slugFor("Интро")).toBe("intro");
    expect(slugFor("Щенок")).toBe("schenok");
  });

  it("keeps digits and collapses punctuation", () => {
    expect(slugFor("Интро v2 — финал!")).toBe("intro-v2-final");
  });

  it("answers empty when nothing survives", () => {
    expect(slugFor("!!!")).toBe("");
    expect(slugFor("🙂")).toBe("");
  });
});

describe("freeSlug", () => {
  it("keeps a free slug", () => {
    expect(freeSlug("intro", ["outro"])).toBe("intro");
  });

  it("suffixes past every taken one", () => {
    expect(freeSlug("intro", ["intro", "intro-2"])).toBe("intro-3");
  });

  it("falls back when the name yields nothing", () => {
    expect(freeSlug("", [])).toBe("video");
    expect(freeSlug("", ["video"])).toBe("video-2");
  });
});
