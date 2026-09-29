import { describe, expect, it } from "bun:test";
import {
  CHAT_MIN_WIDTH,
  PREVIEW_ROOM,
  panelIdsOf,
  previewRoom,
  showsPreview,
} from "@/lib/studio/panes";

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
  });

  // The library reads these as a dependency, so a fresh array per render would
  // recompute the stored layout on every one.
  it("answers the same array for the same panes", () => {
    expect(panelIdsOf(true)).toBe(panelIdsOf(true));
    expect(panelIdsOf(false)).toBe(panelIdsOf(false));
  });
});

describe("previewRoom", () => {
  it("widens a squeezed preview to its room when the chat can give it", () => {
    expect(previewRoom(500, 1422)).toBe(PREVIEW_ROOM);
  });

  // The default window with the sidebar open: the chat stops at its minimum
  // and the preview takes what is left rather than the whole room.
  it("takes no more than the chat can give above its minimum", () => {
    expect(previewRoom(502, 1142)).toBe(1142 - CHAT_MIN_WIDTH);
  });

  it("leaves a preview that already has its room", () => {
    expect(previewRoom(PREVIEW_ROOM, 1422)).toBeNull();
    expect(previewRoom(1000, 1422)).toBeNull();
  });

  it("never narrows the preview when the chat is already at its minimum", () => {
    expect(previewRoom(400, 700)).toBeNull();
  });

  // The library rounds each pane to a thousandth of a percent, so a preview
  // it has just placed at the room can read a fraction short of it.
  it("ignores a difference smaller than a pixel", () => {
    expect(previewRoom(PREVIEW_ROOM - 0.5, 1422)).toBeNull();
  });

  it("does nothing before the group has a width", () => {
    expect(previewRoom(0, 0)).toBeNull();
  });
});
