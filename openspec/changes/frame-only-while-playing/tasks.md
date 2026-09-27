## 1. Webview

- [ ] 1.1 In `hooks/use-canvas-preview.ts`, return whether the stage clips: content outside hidden, or the transport playing. Verify in a new `hooks/use-canvas-preview.test.tsx` that it clips while playing in dim mode, stops clipping on pause, and always clips in hide mode.
- [ ] 1.2 In `components/studio/canvas-preview.tsx`, apply the hook's value to the stage instead of reading `camera.outside` there; extend `components/studio/canvas-preview.test.tsx` so the stage clips while playing and not while paused.

## 2. Verification

- [ ] 2.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [ ] 2.2 Re-run the WebKit harness in design.md against the change: the September scene at 50% and 30% zoom plays at the bare Player's speed with content outside shown.
- [ ] 2.3 In the running app: with content outside shown, play remocn-walk — the September scene is smooth and nothing is drawn beside the frame; pause — the rows beside the frame reappear dimmed at that frame and can be picked; scrub and step — they follow; with content outside hidden, nothing beside the frame is drawn or picked, playing or paused; Snapshot and Export are unchanged.
