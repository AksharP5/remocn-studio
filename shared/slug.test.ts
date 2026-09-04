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

  it("lifts the accent and keeps the letter", () => {
    expect(slugFor("Éclair")).toBe("eclair");
    expect(slugFor("Café Ürün")).toBe("cafe-urun");
    expect(slugFor("Ñandú")).toBe("nandu");
    expect(slugFor("Été")).toBe("ete");
  });

  it("spells the letters that do not decompose", () => {
    expect(slugFor("Straße")).toBe("strasse");
    expect(slugFor("Łódź")).toBe("lodz");
    expect(slugFor("Ærø")).toBe("aero");
    expect(slugFor("Đông")).toBe("dong");
  });

  it("still spells the cyrillic letters that decompose too", () => {
    expect(slugFor("Ёжик и йога")).toBe("ezhik-i-ioga");
    expect(slugFor("Київ")).toBe("kiyiv");
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
