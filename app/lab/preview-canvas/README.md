# Canvas in the main Studio

The canvas is now the default preview in the desktop application's main screen.
There is no experimental setting to enable. `/lab/preview-canvas` remains an
alias of the same AppShell for existing links.

Use a development desktop app or build containing these changes. Restart the
running development app/sidecar to load the native compiler and manifest endpoint;
then open a project and its video normally. A standalone browser still cannot
access Tauri's database and sidecar bridge.

## Interaction

- Click an element to inspect it. The existing properties pane floats above the
  canvas, flush with its top and right edges, and does not resize or automatically
  reframe the video. It is visible by default and shows video information when
  nothing is selected. Its toolbar contains Snapshot, Export and Hide inspector;
  Show inspector restores it without clearing selection.
- Drag a supported managed object, its resize handles or rotation handle.
  Dimension labels use video units; handles remain the same screen size.
- Double-click managed plain text to edit. Escape cancels; click outside or
  Command/Ctrl+Enter saves through the existing operation system.
- Space-drag, middle-button drag, the hand tool or wheel/trackpad pan navigates.
  Ctrl/Meta-wheel pinches around the pointer. Fit and 100% remain explicit.
- K plays while the canvas has focus. Left/Right step frames. Playback controls,
  sound, fullscreen, Snapshot, status and export feedback stay outside the video.
- Docs keeps the mounted runtime hidden. Camera positions are remembered per
  project/video/dimensions within the app session. A rebuild loads the new
  runtime hidden and swaps to it once it has drawn, at the same frame, playback
  state and sound; no loading screen appears. If the new version cannot be
  shown, the previous one stays with a notice.

Existing `studio-objects-v5` files are adapted by the native compiler. Their
source, values, operation logs and renderer/export bundle are unchanged. The
same receipt validation, generation checks, drafts, commit and Undo hooks are
used by both hosts. Unexpected provider transport code fails with a readable
error instead of silently disabling editing.

## Compatibility boundaries

The project owns its React and Remotion root. Imported CSS and Player CSS are
scoped to Shadow DOM; common html/body/:root selectors map to :host. CSS font
faces have owned document registrations with cleanup. staticFile and imported
webpack assets use the preview host's absolute URLs.

Shadow DOM shares the editor's JavaScript window, rem units, viewport units and
media queries. Arbitrary global scripts, portals, document-inserting libraries,
relative fetches and bare root-relative asset strings are not automatically
sandboxed or rewritten. Extracted CSS configurations are rejected; worker and
unusual webpack configurations require individual adaptation. Existing managed
geometry and plain-text eligibility rules still apply.

The canvas was verified by the user in the running app on 2026-09-23. Automated
coverage of stale connection/disposal, camera boundaries, native bundling,
reload/media cleanup and packaged resources is still to be written.
