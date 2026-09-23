## Why

The canvas can be navigated and edited, but routine editing still has friction:
a rebuild drops the card of an ordinary element, objects cannot be aligned
precisely without typing numbers, arrow keys only step frames, the camera has no
keyboard or selection framing, and anything placed outside the frame is
invisible while it animates in or out.

## What Changes

- The card of an ordinary (non-managed) element is reopened on the same element
  after the canvas swaps to a rebuilt runtime. Managed objects already keep theirs.
- Moving and resizing snap to the frame's edges and centre and to other managed
  objects, with a guide line; ⌘/Ctrl while dragging turns snapping off.
- Arrow keys nudge the selected managed object by one unit (ten with Shift),
  coalesced into one operation; with no editable selection they still step frames.
- ⌘0 is 100%, ⌘+ and ⌘− zoom, ⇧1 fits the video, ⇧2 and a toolbar button
  zoom to the selection.
- Content outside the frame is drawn dimmed on the canvas; a toolbar toggle hides it.

## Capabilities

### Modified Capabilities

- `preview/inspect`: snapping, keyboard nudging, selection restored after a rebuild.
- `preview/shadow-canvas`: camera shortcuts, zoom to selection, content outside the frame.

## Non-goals

Snapping for rotated objects, distribution/spacing guides, multi-selection,
persisted camera or overflow preference. Rendering and export still clip to the frame.

## Impact

Preview runtime (`geometry.ts`, `inspect.ts`, `native-entry.tsx`,
`player-runtime.tsx`), `shared/studio-geometry.ts` (pure snapping),
`lib/studio/native-preview.ts` (selection across the swap),
`lib/studio/preview-camera.ts`, `hooks/use-preview-camera.ts`,
`components/studio/canvas-preview.tsx`. No IPC or history change.
