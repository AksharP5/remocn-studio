## 1. Camera

- [ ] 1.1 Add `interpolateCamera` (centre linear, zoom in log space) to `lib/studio/preview-camera.ts` and verify in `lib/studio/preview-camera.test.ts`.
- [ ] 1.2 Animate jumps in `hooks/use-preview-camera.ts`: 200 ms ease-out, cancelled by input, immediate under reduced motion and blocked by an edit lock; verify in `hooks/use-preview-camera.test.tsx` with fake timers.
- [ ] 1.3 Replace the 20000px shadow with four edge rectangles; with the user, compare paint time during a pan in Web Inspector Timelines and keep the faster one.

## 2. Rulers and grid

- [ ] 2.1 Add `rulerTicks` (1, 2, 5 × 10ⁿ, 60px label spacing) with tests.
- [ ] 2.2 Add `hooks/use-canvas-rulers.ts`: draw both rulers, pointer and selection marks, toggle with ⇧R; verify the toggle and occlusion in `hooks/use-canvas-rulers.test.tsx`.
- [ ] 2.3 Draw the pixel grid from 800% in the overlay layer; verify it is absent below 800%.
- [ ] 2.4 Render rulers, toggle and grid in `components/studio/canvas-preview.tsx`; the component only renders.

## 3. Persistence

- [ ] 3.1 Add `canvasCameras` and `canvasRulers` to `lib/studio/settings.ts` (Effect save functions, hydrate) and verify in its test.
- [ ] 3.2 Save cameras as centre-in-video-units plus zoom, 500 ms after settling and on unmount, 50 most recent; restore on open; verify a restore at a different viewport size keeps the centre.

## 4. Verification

- [ ] 4.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [ ] 4.2 In the running app: ⇧1, ⇧2, ⌘0 and the zoom buttons animate; a pan interrupts; reduced motion jumps; rulers follow the camera, mark the pointer and the selection, and ⇧R hides them across a relaunch; the grid appears at 800%; a relaunch restores the camera; panning is at least as smooth as before.
