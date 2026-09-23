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
