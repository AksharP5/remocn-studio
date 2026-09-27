## Why

REM-531: the canvas plays videos slower than the Remotion Player does on its own
when content outside the frame is shown, which is the default. Measured in WebKit
around the studio's real native runtime, remocn-walk's September scene (a wall of
type whose rows run thousands of pixels past both frame edges) plays at about 23
fps on the canvas against about 26 for the bare Player at 50% zoom, and at 30%
zoom at 15–16 fps with around 30 dropped-frame stalls in under three seconds.

The earlier proposal (`frame-only-while-playing`) answered it by drawing only
the frame while the video plays. That is rejected: dim mode has to stay dim —
content outside visible, dimmed — and be smooth.

This exploration found where the cost really is (design.md has every number).
It is not the area of the surround and not the dim rectangles: it is repainting,
every frame, content that only moves. Each September row is a strip of type
under an SVG outline filter that slides by `transform` each frame. WebKit
repaints a moved element's whole box and re-runs its filter over it, and the
only thing that bounds that work is a frame-sized `overflow` clip in the same
transformed space — exactly the clip the canvas lifts. Take the filter away and
lifted plays at a full 30 fps; clip the stage and it plays at the bare Player's
speed. Promote the moving strips to their own compositing layers and it plays at
full speed **with the content outside shown**: the strip is painted once and the
compositor slides it.

## What Changes

- The preview runtime composites what moves: an element inside the video whose
  inline `transform` changes from one update to the next is given its own
  compositing layer for as long as it has a transform, so moving it no longer
  repaints it. Nothing else about it changes — a transformed element already
  forms its own stacking context and containing block.
- With content outside the frame shown, playback keeps pace with the Player:
  content outside the frame keeps moving, dimmed, while the video plays, and can
  be picked when paused, as today.
- Nothing changes in hide mode, full-screen viewing, Snapshot, rendering or
  Export.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: "Content outside the frame is visible on the canvas"
  gains a scenario that pins playback with content outside shown — it stays
  visible, dimmed and moving, instead of the frame-only playback the superseded
  proposal would have made it.

## Non-goals

- Drawing only the frame while playing (the superseded proposal) or a frozen or
  slower-updating copy of the surround: both show the person something other
  than the video, and neither is needed once moving content stops repainting.
- Bounding the lifted paint to the visible part of the viewport. It works only
  as an inner `overflow: clip` (WebKit has no `overflow-clip-margin`, and a
  `clip-path` on the stage does not bound the work), it helps only when zoomed
  in, and it would have to follow every camera move. Recorded in design.md.
- Content whose pixels change every frame (a counter, a colour sweep, a blur
  whose radius animates) still repaints; it did before, and the frame clip in
  hide mode remains the answer for it.
- Stripping the runtime's own marker attributes from the markup a selection
  carries to the agent; `data-remocn-frame-clip` already shows there, and the
  new marker joins it.

## Impact

- Preview runtime only: `preview/frame-clips.ts` — which already lifts the
  frame-sized clips and owns the stylesheet that does it — also watches the
  video's `style` attribute changes, marks the elements whose transform moves,
  and gives the marker `will-change: transform` in the same stylesheet. No new
  file, so no new `tauri.conf.json` resource.
- No webview, shared contract, sidecar, Rust, history or `settings.json` change;
  no protocol bump.
