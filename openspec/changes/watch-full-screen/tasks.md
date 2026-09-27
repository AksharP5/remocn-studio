## 1. Rust core

- [x] 1.1 Allow `core:window:allow-set-fullscreen` in `src-tauri/capabilities/default.json`.

## 2. Webview: window and camera

- [x] 2.1 Add `holdWindowFullScreen` to `lib/studio/shell.ts`: a scoped Effect that enters macOS full screen unless the window is already there, leaves it on release only if it entered, and reports a leave seen through `onResized` + `isFullscreen()`; verify in `hooks/use-preview-viewing.test.tsx` with `mockIPC`.
- [x] 2.2 Give `usePreviewCamera` a `viewing` flag: hold the camera, fit the whole frame to the whole viewport (refit on resize), restore on exit (or leave the new video to its first fit), keep the first fit out of the view, never remember the viewing camera, ignore jumps; verify in `hooks/use-preview-viewing.test.tsx`.

## 3. Webview: the view

- [x] 3.1 Add `hooks/use-preview-viewing.ts`: enter/exit/toggle gated on a ready video, F with the canvas focused and not typing, Esc and K while viewing, the shield's focus, click and wheel, idle fade while playing, the full-screen hold and its notice, exit when the canvas is hidden; verify in `hooks/use-preview-viewing.test.tsx`.
- [x] 3.2 Wire it in `hooks/use-canvas-preview.ts` and pass `viewing` to the camera.
- [x] 3.3 Remove the DOM-fullscreen state and toggle from `hooks/use-preview-transport.ts`.
- [x] 3.4 Render the view in `components/studio/canvas-preview.tsx` (fixed black section, hidden chrome, shield, clipped stage, centred fading dock, toolbar button) and the panel's button in `components/studio/preview-controls.tsx`; components only render.

## 4. Verification

- [x] 4.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [ ] 4.2 In the running app: F, the toolbar button and the panel button open the view and the window goes full screen; the video is fitted on black with nothing outside the frame; the panel fades while playing and returns on pointer move; Space, K, ←/→ and a click work; clicks, double-clicks, drags and pinches edit nothing; Esc, F and the button close it, the window leaves full screen and the camera is back where it was; the frame and play state carry over both ways; from a window already in full screen, leaving the view keeps it full screen; the green button closes the view; tooltips on the panel show in the view.
