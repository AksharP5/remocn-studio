// The sidebar is a fixed-width column outside the resizable group, so the
// layout holds the chat and the preview. Each combination is its own id list,
// which is what keeps the stored width of a one-pane window from being read as
// a two-pane one.
const WITH_PREVIEW = ["chat", "preview"];
const CHAT_ALONE = ["chat"];

export function showsPreview(
  chosen: boolean | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): boolean {
  return chosen ?? (isLoadingProjects || hasProjects);
}

export function panelIdsOf(isPreviewShown: boolean): string[] {
  return isPreviewShown ? WITH_PREVIEW : CHAT_ALONE;
}

export const CHAT_MIN_WIDTH = 380;
export const PREVIEW_MIN_WIDTH = 360;
export const INSPECTOR_WIDTH = 340;

// The inspector lives inside the preview, so a preview at its own minimum was
// a sliver of canvas beside it. The room is the open inspector plus a canvas,
// rulers included, wide enough for the toolbar and the pane's actions to share
// their row and for the playback dock to keep its controls.
const CANVAS_ROOM = 500;
export const PREVIEW_ROOM = INSPECTOR_WIDTH + CANVAS_ROOM;

/**
 * The width to widen the preview to so the chat yields first: its room, or as
 * much of it as the chat can give without going below its own minimum. `null`
 * when the preview already has that — it is never narrowed from here.
 */
export function previewRoom(
  previewWidth: number,
  groupWidth: number
): number | null {
  const room = Math.min(PREVIEW_ROOM, groupWidth - CHAT_MIN_WIDTH);

  return room - previewWidth > 1 ? room : null;
}
