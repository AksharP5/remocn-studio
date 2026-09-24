## Context

`hooks/use-preview-camera.ts` owns the camera `{ x, y, zoom }` in screen pixels
relative to the viewport. Since `canvas-pan-follows-the-pointer`, input steps are
folded into one `setCamera` per animation frame. Fit, zoom and zoom to selection
set the target camera directly. Cameras are remembered in a module-level `Map`
(`savedCameras`) for the session only. The surround is the frame `div`'s
`box-shadow: 0 0 0 20000px`, positioned with `left/top/width/height`.

## Goals / Non-Goals

**Goals:** everything stays in the webview; one owner for the camera.

**Non-Goals:** guides, alternative units, runtime changes.

## Decisions

### Tween in the camera hook, interpolated in view space

A jump computes its target as today, then animates from the current camera on
`requestAnimationFrame` over 200 ms with an ease-out curve. The interpolation
(`interpolateCamera`, pure, in `lib/studio/preview-camera.ts`) moves the video
point at the viewport centre linearly and the zoom geometrically (in log space),
so zooming does not appear to accelerate and the centre travels straight.
Linear `x`, `y`, `zoom` was rejected: at a 10× zoom change the frame's corner
visibly swings away before settling. Any input step cancels the tween and
applies to the camera as it stands. `prefers-reduced-motion` is read with
`matchMedia` and followed live.

### Surround as four edge rectangles

The shadow is replaced by four `div`s covering the viewport around the frame,
each sized from the camera. Their repaint is bounded by the viewport, whereas the
shadow's paint extent is 40000px on a side. This is to be confirmed with Web
Inspector's Timelines during a pan (task 1.3); if it does not reduce paint time,
the shadow stays and the change drops this item.

### Rulers drawn to canvas elements

`hooks/use-canvas-rulers.ts` draws each ruler into a `<canvas>` at device pixel
ratio, redrawn on camera, bounds, pointer and selection changes (at most once per
frame). Tick spacing (`rulerTicks`, pure) picks the smallest step from
1, 2, 5 × 10ⁿ video pixels whose labels are at least 60 screen pixels apart.
The rulers are marked `data-canvas-occludes` so Fit and zoom to selection leave
their space. The selection extent comes from the element Inspect marks with the
selection-bounds attribute, the same one zoom to selection measures. SVG was
rejected: a few hundred tick nodes re-laid out per pan frame.

### Pixel grid as a background

An overlay clipped to the frame draws the grid with a repeating CSS gradient
whose size is `zoom` pixels and whose position follows the camera. It lives in
the app's overlay layer, not in the runtime, so Snapshot and Export never see it.

### Remembered cameras in settings

Cameras are stored as the video point at the viewport centre plus zoom, so a
different window size restores the same view. `canvasCameras` holds up to 50
entries (most recent first) keyed `projectId:composition:width:height`, written
by the webview through `lib/studio/settings.ts` 500 ms after the camera settles
and on unmount. `canvasRulers` holds the toggle. Both are read with the
hydrated settings. Writes use the existing store functions (Effect); a failed
write is logged and the session keeps working from memory. It is never shown
to the person.

## Risks / Trade-offs

- [A tween re-renders the pane each frame for 200 ms] → acceptable after the
  inspector memoisation; measured together with 1.3.
- [Settings writes while panning] → debounced to one write after settling.
- [A remembered camera whose video changed dimensions] → the key includes the
  dimensions, so it falls back to Fit.
- Failure direction: every piece degrades to today's behaviour (no animation, no
  rulers, Fit on open); none produces a notice.

## Migration Plan

New settings keys start empty; nothing to migrate.
