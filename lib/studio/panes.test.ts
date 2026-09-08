import { describe, expect, it } from "bun:test";
import { panelIdsOf, showsPreview } from "@/lib/studio/panes";

describe("showsPreview", () => {
  it("hides the preview when there is nothing to preview", () => {
    expect(showsPreview(null, false, false)).toBe(false);
  });

  it("shows it once a project exists", () => {
    expect(showsPreview(null, true, false)).toBe(true);
  });

  it("shows it while the projects are still loading", () => {
    expect(showsPreview(null, false, true)).toBe(true);
  });

  it("keeps a chosen state whatever the projects say", () => {
    expect(showsPreview(false, true, false)).toBe(false);
    expect(showsPreview(true, false, false)).toBe(true);
  });
});

describe("panelIdsOf", () => {
  it("names the resizable panes that are on screen, in order", () => {
    expect(panelIdsOf(true)).toEqual(["chat", "preview"]);
    expect(panelIdsOf(false)).toEqual(["chat"]);
    expect(panelIdsOf(true, true)).toEqual(["chat", "preview", "props"]);
  });

  // The properties pane only exists beside a preview, so a hidden preview
  // cannot leave a third id in the layout the store is keyed by.
  it("never names the properties pane without a preview", () => {
    expect(panelIdsOf(false, true)).toEqual(["chat"]);
  });

  // The library reads these as a dependency, so a fresh array per render would
  // recompute the stored layout on every one.
  it("answers the same array for the same panes", () => {
    expect(panelIdsOf(true)).toBe(panelIdsOf(true));
    expect(panelIdsOf(true, true)).toBe(panelIdsOf(true, true));
  });
});
