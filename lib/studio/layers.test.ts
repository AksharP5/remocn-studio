import { describe, expect, it } from "bun:test";
import type { StudioObject } from "@/shared/studio-document";
import { layersOf, nextPresent, visibleRows, withAncestors } from "./layers";

function object(
  id: string,
  parentId: string | null = null,
  definition = "box"
): StudioObject {
  return { definition, id, label: id.toUpperCase(), parentId, values: {} };
}

function shape(rows: ReturnType<typeof layersOf>) {
  return rows.map((row) => ({
    depth: row.depth,
    id: row.id,
    label: row.label,
  }));
}

describe("layersOf", () => {
  it("puts parents before their children, in document order", () => {
    const rows = layersOf([
      object("price", "card"),
      object("hero"),
      object("card"),
      object("title", "hero"),
    ]);

    expect(shape(rows)).toEqual([
      { depth: 0, id: "hero", label: "HERO" },
      { depth: 1, id: "title", label: "TITLE" },
      { depth: 0, id: "card", label: "CARD" },
      { depth: 1, id: "price", label: "PRICE" },
    ]);
  });

  it("lists an object whose parent is not in the document at the root", () => {
    expect(shape(layersOf([object("logo", "gone")]))).toEqual([
      { depth: 0, id: "logo", label: "LOGO" },
    ]);
  });

  it("lists nothing for a video without objects", () => {
    expect(layersOf([])).toEqual([]);
  });
});

describe("groups", () => {
  const rows = layersOf([
    object("opening", null, "scene"),
    object("title", "opening"),
    object("phone", null, "scene"),
    object("device", "phone"),
    object("clock", "device"),
    object("stage"),
  ]);

  it("marks scenes and groups, and carries each row's ancestors", () => {
    expect(
      rows.map((row) => [row.id, row.isScene, row.hasChildren, row.ancestors])
    ).toEqual([
      ["opening", true, true, []],
      ["title", false, false, ["opening"]],
      ["phone", true, true, []],
      ["device", false, true, ["phone"]],
      ["clock", false, false, ["phone", "device"]],
      ["stage", false, false, []],
    ]);
  });

  it("hides everything under a closed group", () => {
    const shown = visibleRows(rows, (row) => row.id !== "phone");

    expect(shown.map((row) => row.id)).toEqual([
      "opening",
      "title",
      "phone",
      "stage",
    ]);
  });

  it("widens a set of objects to the groups above them", () => {
    expect([...withAncestors(rows, ["clock", "gone"])].sort()).toEqual([
      "clock",
      "device",
      "phone",
    ]);
  });
});

describe("nextPresent", () => {
  const rows = layersOf([
    object("hero"),
    object("title", "hero"),
    object("card"),
    object("price", "card"),
  ]);
  const present = new Set(["title", "card", "price"]);

  it("starts at the first mounted object", () => {
    expect(nextPresent(rows, present, null, 1)).toBe("title");
    expect(nextPresent(rows, present, null, -1)).toBe("price");
  });

  it("steps through mounted objects in list order and wraps", () => {
    expect(nextPresent(rows, present, "title", 1)).toBe("card");
    expect(nextPresent(rows, present, "price", 1)).toBe("title");
    expect(nextPresent(rows, present, "title", -1)).toBe("price");
  });

  it("starts over from a selection that is not mounted", () => {
    expect(nextPresent(rows, present, "hero", 1)).toBe("title");
  });

  it("selects nothing when nothing is mounted", () => {
    expect(nextPresent(rows, new Set(), null, 1)).toBeNull();
  });
});
