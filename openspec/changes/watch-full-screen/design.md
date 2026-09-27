## Context

The canvas (`components/studio/canvas-preview.tsx`) is one `<section>`: a
viewport holding the camera-transformed stage into which
`lib/studio/native-preview.ts` mounts the video runtime, the selection overlay
layer, rulers, the toolbar, the inspector and the playback dock.
`usePreviewTransport` carried a DOM-fullscreen toggle on that section, shown only
when `document.fullscreenEnabled` is true.

Measured on the pinned stack: wry 0.55.1 sets WKPreferences' private
`fullScreenEnabled` key only under its `fullscreen` feature
(`src/wkwebview/mod.rs`), which tauri-runtime-wry 2.11.4 enables only from
`macos-private-api`. `src-tauri/Cargo.toml` enables `protocol-asset` and
`image-png` only, so the key is never set and WebKit reports
`document.fullscreenEnabled === false`: the existing button never rendered in
the app.

## Goals / Non-Goals

**Goals:** watch the video full screen with only playback controls; no remount of
the runtime; the editing camera comes back untouched.

**Non-Goals:** a second window, picture-in-picture, remembering the view.

## Decisions

### Tauri window full screen plus an in-page view, not DOM fullscreen

The view is a state of the canvas in the webview: the section becomes
`fixed inset-0` over the whole webview on black, and the webview asks the core to
put the window in macOS full screen (`getCurrentWindow().setFullscreen(true)`,
permission `core:window:allow-set-fullscreen`). The window part is ownership-
aware: if the window was already full screen when the view opened
(`isFullscreen()`), the view does not touch it on the way out.

DOM fullscreen was ruled out for three reasons. It needs `macos-private-api`,
which also switches on wry's `transparent` private keys and puts the app on
private WebKit API for one feature. In element fullscreen only the element's
subtree is painted, and Base UI tooltips portal to `document.body`, so the
panel's hints would disappear. And a Cargo feature change needs a Rust rebuild
to reach the user, where the chosen path needs one capability line.

`setSimpleFullscreen` (pre-Lion, no Space) was considered: it is instant but does
not match what the green button, the menu's Enter Full Screen and Safari's video
fullscreen do on macOS, and it leaves the person with two different "full
screen" behaviours in one app.

### Restyle the same canvas; do not move the runtime

A portal or a second stage would remount the stage element, and
`useNativePreview` keys the runtime's lifetime on it: leaving the view would cost
a new bundle fetch and the frame. The view instead keeps every element in place
and changes classes and CSS variables: `--canvas-inspector-width` and
`--canvas-ruler` go to `0px`, the toolbar, inspector, rulers, Inspect overlay and
surround are not rendered, the selection overlay layer is made invisible, and the
stage gets `clip-path: inset(0)` so nothing outside the frame is drawn. The
inspector is hidden with `display: none`, not unmounted, so the properties pane
keeps its state. Playback position, play state, rate and volume carry over
because nothing about the runtime or the transport changes.

The fixed section escapes the pane: no ancestor sets a transform, filter,
`contain` or `will-change` (checked through `app-shell.tsx`, `FrozenPane` and
react-resizable-panels 4.12.2's inline styles). It stacks at `z-50` inside the
shell grid's `z-10` context, so dialogs and tooltips portalled to the body still
draw above it.

### A shield marked as canvas chrome gates every editing gesture

While the view is open a transparent, focusable layer covers the stage, marked
`data-canvas-chrome`. The preview runtime's `surfaceEvents` already drop events
whose path contains canvas chrome, and the camera treats `[data-canvas-chrome]`
as a control for pointer, wheel and keyboard, so selecting, text editing,
nudging, panning, zooming and ⇧/⌘ shortcuts all stop without touching the
runtime. The shield takes focus on entry (and returns it to what had it on exit),
so Space and ←/→ reach `usePreviewTransport` as usual and the view hook handles K
and a click as play/pause. A native `wheel` listener on the shield prevents a
pinch from zooming the page.

### The camera holds and restores itself

`usePreviewCamera` takes a `viewing` flag. On entry it stores the current camera
(or a tween's target) with the video's key, stops any tween, and places a fit of
the whole frame into the whole viewport with no insets and zoom up to the camera
maximum, refitting whenever the viewport's bounds change (the window animating
into full screen). The fit is a layout effect measured against the viewport's
live box, so the first painted frame of the view is already fitted rather than
waiting a frame for the `ResizeObserver`. On exit it places the stored camera
back in a layout effect, before paint. If the video's key changed while viewing
(a rebuild with new dimensions), the stored camera no longer applies and the
first-fit effect, which is held off while viewing, frames the new video instead.
`remember` returns false and jumps are ignored while viewing, so the full-screen
camera is never saved as the video's camera.

### Ownership and failure direction

All state is the webview's: `usePreviewViewing` owns `viewing` and the idle
timer; the window's full-screen state is the Rust core's, reached through
`@tauri-apps/api/window` commands, not a new Tauri command.
`holdWindowFullScreen` in `lib/studio/shell.ts` is a scoped Effect: acquire
enters full screen unless already there, release leaves it only when it entered,
and a resize listener reads `isFullscreen()` and reports a leave once it has seen
the window in full screen, so the entry animation's intermediate sizes are not
mistaken for a leave. The hook forks it while the view is open and interrupts it
on exit or unmount.

If the command fails (a missing permission, no Tauri core) the view still fills
the window and the panel's status slot reads "Full screen is unavailable, so the
video fills the window." It is never silent and never fails anything else. The
idle fade uses a hook-level `setTimeout`; it lives in a hook, not in `lib/**`.

No protocol bump, no history migration, no new `settings.json` key.

## Risks / Trade-offs

- WebKit could mis-stack a fixed element inside the rounded, `overflow: hidden`
  card during the full-screen animation → check in the running app.
- The native full-screen transition takes about half a second; the video refits
  on each reported size and may visibly step → acceptable; the camera tween is not
  used for this refit.
- Tests run in happy-dom, which neither lays out nor has a window manager: the
  hook and camera are tested at their boundary, the look and the macOS transition
  only in the running app.
