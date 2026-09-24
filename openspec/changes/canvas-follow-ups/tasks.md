## 1. Middle button

- [ ] 1.1 Log pointer events for a middle-button drag in the running app (moved from `canvas-pan-follows-the-pointer` 2.1) and find the layer that drops the moves.
- [ ] 1.2 Fix it in that layer and verify in the app that a middle-button drag pans like Space-drag (moved from 2.2 and the middle-button part of 3.2).

## 2. Cleanup

- [ ] 2.1 Remove the grab script: `GRAB_SCRIPT_ENV` in Rust and the sidecar, the `grab/index.global.js` resource, `/__remocn/grab.js`, `withoutWebFonts` (moved from `shadow-preview-canvas` 6.5); `cargo check`, `bun run check`, `bun run typecheck`, the full suite.
- [ ] 2.2 Suspend the render compiler between renders after the native compiler takes over ready/failed reporting and the still-cache reset (moved from `shadow-preview-canvas` 6.6).

## 3. Coverage

- [ ] 3.1 Tests for stale connection and disposal, camera boundaries, native bundling, reload and media cleanup, and packaged resources (moved from `shadow-preview-canvas` 4.2).
