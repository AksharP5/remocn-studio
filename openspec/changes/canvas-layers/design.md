## Context

`hooks/use-managed-objects.ts` reads the objects document (`studio.read`) on
every `studio.ready` for the open video, before anything is selected, and
exposes `select(id)`, which is what a `studio.select` from the canvas does. The
document's objects carry `id`, `label` and `parentId`. What the webview does not
know is which objects are mounted at the current frame — only the runtime in the
Shadow DOM sees `[data-studio-object]` elements.

## Goals / Non-Goals

**Goals:** no new IPC; the list derived from state the app already holds; the
runtime reports mount changes, not every frame.

**Non-Goals:** document writes from the list; ordinary elements in the list.

## Decisions

### The list is webview state; presence is runtime state

`hooks/use-canvas-layers.ts` builds the tree from the managed session's document
(pure `layersOf(document)` in `lib/studio/layers.ts`, tested: parents before
children, orphans at the root, cycles impossible because the document refuses
them). Presence arrives as `{ type: "studio.present", ids }`
from the runtime (`preview/presence.ts`), posted when the set of mounted managed
objects changes — a `MutationObserver` over the runtime's element, coalesced to
one post per animation frame. It needs no generation key: a staged runtime's
messages are buffered and delivered in order after the `rebuilt` that reveals
it (`lib/studio/native-preview.ts`), so the last presence the pane receives is
always the shown runtime's. While playing, the set changes only at object entry and exit, not per
frame. Alternative considered — the webview querying the Shadow DOM itself: it
would duplicate the runtime's notion of a managed root (`managedRoot`) and break
the rule that the runtime owns its DOM.

### Hover is a command, drawn by Inspect's hover layer

`{ type: "studio.hover", objectId | null }` asks the runtime to draw the quiet
hover outline Inspect already paints for the pointer. A row hover wins over the
pointer hover while it lasts; `null` hands hover back.

### Selection reuses `managed.select`

Clicking a row calls `managed.select(id)`; the hook already sends
`studio.highlight` for the selected object, which draws the selection and
handles when mounted and nothing when not. Tab is handled in
`use-canvas-layers` on the canvas viewport's keydown (capture), skipping text
fields and controls with the same `typing` test the camera uses, and ignored
while `data-preview-editing` is set.

### Placement

`CanvasInspector` renders the list in place of `VideoDetails` when there is no
selection; the details become a single muted line under it. The component only
renders what the hook returns.

### Layers and Properties are two views of one selection

Added after the first build (2026-09-23): once something was selected, the only
way back to the list was dropping the selection. The inspector header carries
Layers / Properties tabs while the list is available. The view is derived, not
stored per se: `use-canvas-layers` remembers which selection the person chose
Layers for, and shows Layers while that same selection is open. A new
selection — a canvas click (a new object id, or a new Inspect card) or a row
click — is not the remembered one, so Properties shows without an effect
resetting anything. With the list unavailable (editing disabled) the header
keeps its single "Inspect" title.

### A bar of icons instead of a crowded header

Added after the first build (2026-09-23): the header row held Layers,
Properties, Snapshot, Export and Hide at once. The views and Snapshot move to a
48px vertical bar (36px buttons, 20px icons) on the inspector's outer edge, as in VS Code's activity bar,
and collapsing keeps only the bar, so the floating "Show inspector" button goes.
Export moves to the pane header rather than becoming an unlabelled icon: it is
the pane's primary action, and it was already there in Docs. The one
`ExportButton` in the header now renders the export dialog in both modes.
`--canvas-inspector-width` is the bar's width when collapsed, so Fit, the
header and the playback panel keep clear of it.

### Groups and scenes

Added 2026-09-23: videos are described by scene objects (definition id `scene`,
the constant `SCENE_DEFINITION` in `shared/studio-document.ts`, shared with the
design check `scenes-on-the-seek-bar` adds) parenting their objects. The list is
built from `parentId` alone, so any object with children is a group and a
`scene` object is a scene group. Expansion is derived: a group is open when the
person said so, else when something inside it is mounted (presence plus
ancestors) or it holds the selection. The person's choices live in the hook as
per-id overrides; a new selection clears the overrides of its ancestors while
rendering, so selecting on the canvas reveals the row without an effect. Unknown
presence (before the runtime reports) opens every group, which is what a flat
list showed.

## Risks / Trade-offs

- [A large document makes a long list] → rows are plain, the list scrolls; no
  virtualisation until a video with hundreds of objects exists.
- [Presence lags a rebuild] → the pane forgets presence on `rebuilt` and the
  revealed runtime's buffered presence follows it; rows show as mounted in between.
- Failure direction: a failed document read is already a worded error in the
  managed session; the list shows that sentence. A missing presence message
  degrades to every row undimmed, never to an error.

## Migration Plan

None. Videos without studio-objects-v5 show the empty state.
