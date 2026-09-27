## Why

The canvas is an editing surface: rulers, the inspector, selection outlines,
dimmed content outside the frame and a playback panel that reserves space. There
is no way to simply watch the video large, the way it will be seen once
exported.

A fullscreen button already exists in the playback panel, but it never appears
in the app. It asks the webview for DOM element fullscreen, and WKWebView only
enables that behind WebKit's private `fullScreenEnabled` preference, which wry
sets only when Tauri's `macos-private-api` feature is on. This app does not
enable it, so `document.fullscreenEnabled` is false and the button is not
rendered.

## What Changes

- A **Full screen** button at the end of the canvas toolbar, the existing button
  in the playback panel, and **F** with the canvas focused (not while typing or
  editing text) open a full-screen view of the video.
- The window enters macOS full screen, and the canvas fills it: the video fitted
  and centred on black, nothing outside the frame, no toolbar, inspector,
  rulers, selection outlines or status hints, and no selecting, editing, panning
  or zooming.
- The playback panel stays, centred at the bottom, and fades out with the
  pointer after a short idle while the video plays; moving the pointer, a key or
  pausing brings it back. Space and K play or pause, ← and → step a frame, a
  click on the video plays or pauses.
- **Esc**, **F** or the panel's button leave the view. The canvas camera returns
  to where it was, and the window leaves full screen only if the view put it
  there. Leaving macOS full screen from the green button or the menu also ends
  the view.
- Playback position, play state, speed and volume carry over both ways: the
  video runtime stays mounted and the view is the same canvas, restyled.
- If the window cannot enter full screen, the view fills the window instead and
  the panel says so.
- The dead DOM-fullscreen path in `usePreviewTransport` is removed.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: a new requirement, the video can be watched full
  screen.
- `preview/live-preview`: the playback panel's fullscreen scenario is replaced by
  the full-screen view.

## Non-goals

- DOM element fullscreen through `macos-private-api`: it would put the app on a
  private WebKit key, and Base UI tooltips portal to `document.body`, outside a
  fullscreen element, so the panel's hints would vanish (see design).
- Picture-in-picture, a separate player window, or presenting on a second
  display.
- Remembering the view across launches or per video.
- Showing the scene labels, Snapshot or Export while watching.

## Impact

- Webview: new `hooks/use-preview-viewing.ts`; `hooks/use-preview-camera.ts`
  (hold and restore the camera, fit to the whole screen, do not remember the
  viewing camera); `hooks/use-canvas-preview.ts` (wires the view);
  `hooks/use-preview-transport.ts` (DOM fullscreen removed);
  `lib/studio/shell.ts` (hold the window in full screen, as a scoped Effect);
  `components/studio/canvas-preview.tsx`, `components/studio/preview-controls.tsx`
  render it.
- Rust core: `src-tauri/capabilities/default.json` gains
  `core:window:allow-set-fullscreen`. No Rust code.
- No sidecar, preview runtime, IPC, protocol, history or `settings.json` change.
