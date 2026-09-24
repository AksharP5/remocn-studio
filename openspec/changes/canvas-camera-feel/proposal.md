## Why

The camera works but does not yet feel like a design tool's. Fit, 100% and zoom
to selection jump, so the eye loses where it was. There is no way to read a
position in video units without selecting something, no pixel reference at high
zoom, and the view resets to Fit after every launch. The dimmed surround is a
20000px box-shadow moved with `left`/`top` on every pan frame, the most
expensive paint left in a pan.

## What Changes

- Fit, 100%, zoom in/out, zoom to selection and their shortcuts animate the
  camera over about 200 ms; pan and pinch stay immediate; reduced motion jumps.
- Rulers along the top and left edges of the canvas in video units, with the
  selection's extent and the pointer marked; a toolbar toggle and ⇧R show or
  hide them, remembered between launches.
- A pixel grid over the video from 800% zoom.
- The camera of each video is remembered between launches.
- The dimmed surround is drawn without the 20000px shadow.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: animated camera jumps, rulers, pixel grid, the camera
  remembered between launches. This capability is introduced by the unarchived
  `shadow-preview-canvas`; archive that change first.

## Non-goals

- Guides dragged out of the rulers, or snapping to them: a follow-up once rulers exist.
- Changing ruler units (percent, frames): video pixels only.
- Remembering the dim/hide preference for content outside the frame.
- Inertia after a pan.

## Impact

- Webview only: `hooks/use-preview-camera.ts` (tween, persistence),
  `lib/studio/preview-camera.ts` (pure interpolation and ruler ticks), new
  `hooks/use-canvas-rulers.ts`, `lib/studio/settings.ts` (two keys),
  `components/studio/canvas-preview.tsx`.
- New `settings.json` keys: `canvasCameras`, `canvasRulers`.
- No preview runtime, sidecar, IPC, Rust or history change.
