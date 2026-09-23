## Selection across a rebuild

Managed objects are selected by stable ID and the app re-sends `studio.highlight`
for the new generation, so they already survive. An ordinary pick is a DOM node
of the old runtime; the app closes its card on `rebuilt`. At the swap the old
runtime's pick is read as its anchor (`anchorOf`, the per-instance selector) and
handed to the new runtime's `start`. When Inspect is armed there, the anchor is
resolved and reported exactly like a click, so the card reopens through the
ordinary `selection` message. Unsent tuning is still reset, as before; a missing
or managed target restores nothing.

## Snapping

Snapping works in screen pixels so it feels the same at every zoom, and converts
back through the parent scale: for unrotated geometry every handle moves its edge
by `delta × parentScale` on screen, so a screen correction `s` is a parent-space
correction `s / parentScale`. Targets are collected once per gesture (the frame
paused): the Player's frame box and every other visible managed object. The pure
`snapBox` picks the nearest line within 6 px per axis among the sides the handle
moves (all three for Move, the moved edge for a resize, none for rotation or an
aspect-locked corner) and returns the guide span. The move is recomputed with the
correction; guides are drawn in the overlay layer and cleared at commit.
Rotated boxes (object plus parent rotation not a multiple of 360°) do not snap.

## Keyboard nudging

One keyboard gesture accumulates arrow presses and commits 400 ms after the last
one, so holding an arrow is one write and one Undo. It holds the camera lock like
a drag, so a rebuild waits for it. A focused handle nudges its edge or rotation;
otherwise the object moves. Arrows that are not consumed fall through to frame
stepping. Blur commits a keyboard gesture instead of cancelling it.

## Camera

`fitPreviewCamera` takes a zoom ceiling: 1 for Fit, 4 for a selection. Zoom to
selection reads the selection's on-screen box from the overlay element tagged
`data-remocn-selection-bounds` (the selection box or the geometry frame) and fits
it with a 48 px margin inside the same occlusion insets as Fit, now one
`canvasInsets` helper. Shortcuts are handled in the section's capture phase and
ignore typing targets but not geometry handles.

## Outside the frame

The native Player renders with `overflowVisible` and the slot no longer clips.
Videos usually clip to the frame themselves too: a root or scene container the
size of the frame with `overflow: hidden` (e.g. `film-stage` in a generated
video). `frame-clips.ts` marks, on the canvas only, every clipping element whose
box coincides with the Player's frame box within 1 px and overrides it to
`overflow: visible`. It rescans after DOM insertions, a frame later. Smaller clips
(a phone screen, a rounded card) are left alone, so only "cut at the frame edge"
is lifted, which the mask shows anyway. A mask box at the frame's screen
rect casts a 20000 px spread shadow in the canvas background: translucent to dim,
opaque to hide. It sits below the overlay layer and ignores the pointer, so
out-of-frame objects stay selectable. Rendering, Snapshot and export are unchanged.
