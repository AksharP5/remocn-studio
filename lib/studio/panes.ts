// The sidebar is a fixed-width column outside the resizable group, so the
// layout holds the chat, the preview, and the properties pane while it is up.
// Each combination is its own id list, which is what keeps the stored width of
// a two-pane window from being read as a three-pane one.
const WITH_PREVIEW = ["chat", "preview"];
const WITH_PROPS = ["chat", "preview", "props"];
const CHAT_ALONE = ["chat"];

export function showsPreview(
  chosen: boolean | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): boolean {
  return chosen ?? (isLoadingProjects || hasProjects);
}

export function panelIdsOf(
  isPreviewShown: boolean,
  isPropsShown = false
): string[] {
  if (!isPreviewShown) {
    return CHAT_ALONE;
  }

  return isPropsShown ? WITH_PROPS : WITH_PREVIEW;
}
