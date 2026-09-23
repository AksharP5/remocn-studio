## 1. Camera

- [x] 1.1 Queue pointer and wheel camera steps and apply them once per animation frame in `usePreviewCamera`; flush on teardown.
- [x] 1.2 Memoise `CanvasInspector` on the values it reads so a camera change does not re-render it.

## 2. Middle button

- [ ] 2.1 Log pointer events for a middle-button drag in the running app and find the layer that drops the moves.
- [ ] 2.2 Fix it in that layer.

## 3. Verification

- [x] 3.1 `bun run check`, `bun run typecheck`, touched tests and the full suite.
- [ ] 3.2 In the running app: Space-drag and trackpad pan keep the video under the pointer, with and without a properties pane open; a middle-button drag pans.
