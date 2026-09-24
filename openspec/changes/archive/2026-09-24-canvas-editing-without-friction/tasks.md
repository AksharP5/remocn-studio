## 1. Selection

- [x] 1.1 Export the pick's anchor and restore it when Inspect arms; carry it across the slot swap.

## 2. Direct manipulation

- [x] 2.1 Pure snapping (`snapLinesOf`, `snapSides`, `snapBox`) with tests.
- [x] 2.2 Snap moves and resizes to the frame and other managed objects with guides; ⌘/Ctrl disables.
- [x] 2.3 Coalesced arrow-key nudging of the selected object or focused handle; blur commits.

## 3. Camera

- [x] 3.1 Zoom ceiling in `fitPreviewCamera`, shared `canvasInsets`, tests.
- [x] 3.2 ⌘0, ⌘+, ⌘−, ⇧1, ⇧2 and a Zoom to selection button.
- [x] 3.3 Draw content outside the frame dimmed, with a toggle to hide it.
- [x] 3.5 Pick content outside the frame: a hit on video content counts wherever it is; the frame rectangle only decides an empty point.
- [x] 3.4 Lift frame-sized clipping inside the video on the canvas only (`frame-clips.ts`, shipped as a resource).

## 4. Verification

- [x] 4.1 `bun run check`, `bun run typecheck`, touched tests and the full suite.
- [x] 4.2 In the running app: a picked ordinary element reopens after an agent edit; snapping and guides at several zoom levels; holding an arrow is one Undo; shortcuts with a handle focused; an element entering from off-frame is visible dimmed and selectable.
