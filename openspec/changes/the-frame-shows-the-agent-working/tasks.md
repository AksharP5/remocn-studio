## 1. Preview runtime

- [x] 1.1 Remove `data-remocn-selection-label` from `preview/geometry.ts` and `preview/inspect.ts`, and its check from `preview/inspect.test.ts`; the runtime is back to its state before this change.

## 2. Webview

- [x] 2.1 Add `frameLabelOf` to `lib/studio/preview-camera.ts` (drop `SELECTION_LABEL_ATTR`): above the frame's top-left corner, constant height, clamped to the shown part of the top edge, nothing when under the top inset, below the bottom inset or narrower than 32px. Test in `lib/studio/preview-camera.test.ts`.
- [x] 2.2 Keep `ThinkingMark` extracted from `components/studio/thinking.tsx`; `components/studio/transcript.test.tsx` still passes.
- [x] 2.3 Add `hooks/use-frame-label.ts`: `isTurnWorking` (running, no permission card, no source question) and `useFrameLabel`, which measures the chrome through the exported `insetsOf` when bounds, video size, rulers or inspector change, and places the label on every `view.subscribe` step by writing its transform and max-width. Delete `hooks/use-canvas-working.ts` and its test.
- [x] 2.4 Add `components/studio/canvas-frame-label.tsx` (the name and the memoised mark behind `FrameWorking`) and mount it in `components/studio/canvas-preview.tsx` while the video is shown, not in the full-screen view; delete `components/studio/canvas-working.tsx`. Test in `components/studio/canvas-frame-label.test.tsx`: named above the corner, follows the camera without a render, hidden under the toolbar and off the canvas, measured again when the chrome changes, the mark only while the turn works with no card waiting, unsubscribed on unmount.

- [x] 2.5 While the turn works the label shows `ThinkingMark` three tiles wide (`tiles` prop, 1px gap so the tiles read as one 15×5 matrix) and a working phrase from `lib/studio/working-phrases.ts` with the `shimmer` utility instead of the name; `hooks/use-working-phrase.ts` moves to the next phrase every 3 s on `useNow`, starting at a random one. Tests in `components/studio/canvas-frame-label.test.tsx` and `lib/studio/working-phrases.test.ts`.

## 3. Verification

- [x] 3.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; update the changeset.
- [ ] 3.2 In the running app: open a video and see its name just above the frame's top-left corner; send a message with nothing selected and see the name give way to the wide dot-matrix mark and a shimmering working phrase that changes every few seconds, and the name come back when the turn ends; pan, zoom, Fit and ⇧2 and see the label stay on the corner at the same size; pan the frame's top edge under the toolbar and off the canvas and see the label go and come back; zoom in past the frame's left edge and see the label stay at the left of the canvas; toggle rulers and the inspector and see it move clear of them; see the mark leave when the turn ends and while a permission card waits; open full screen and see no label; turn on Reduce motion and see the mark still; check the name is readable over the dimmed surround in both dim and hide modes.
