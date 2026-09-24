## Why

An object can only be selected by clicking what paints under the pointer. An
object that is transparent, covered by another, or not on screen at the current
frame cannot be reached at all, and there is no overview of what a video is made
of. The objects document already describes every editable object as a tree
(`label`, `parentId`), independently of the frame, and the app reads it as soon
as the preview is ready — the list exists, it is just not shown.

## What Changes

- With nothing selected, the inspector shows the video's editable objects as a
  tree, in place of the video details; the details shrink to one line below it.
- Hovering a row outlines the object on the canvas; clicking selects it and
  opens its properties, exactly as clicking it on the canvas would.
- Objects not on screen at the current frame are listed dimmed; selecting one
  opens its properties without an outline on the canvas.
- Tab and Shift+Tab select the next and previous object on screen, in the order
  of the list, while the canvas has focus.
- A video without editable objects says so instead of showing an empty list.

## Capabilities

### Modified Capabilities

- `preview/inspect`: the object list, hover from the list, Tab selection.
- `shell/layout-and-panes`: the inspector becomes a vertical icon bar with a
  collapsible content area; Export moves to the pane header. This requirement is
  also modified by the unarchived `shadow-preview-canvas`; archive that first.

## Non-goals

- Renaming, reordering, hiding, locking, grouping or deleting objects from the
  list: each writes the document or the code, and belongs in its own change.
- Listing ordinary elements that are not managed objects: they have no stable
  catalogue; Inspect still picks them on the canvas.
- Jumping to the frame where an off-screen object appears: the document does not
  record when an object is on screen. `scenes-on-the-seek-bar` may make that
  possible later.
- Multi-selection.

## Impact

- Preview runtime: report which managed objects are mounted; draw a hover
  outline on request.
- Webview: messages mirrored in `lib/studio/preview.ts`; the list comes from
  the document `hooks/use-managed-objects.ts` already holds; a new
  `hooks/use-canvas-layers.ts`; the inspector renders it.
- No sidecar, IPC, Rust or history change.
