---
"remocn-studio": patch
---

Replace the main Studio preview iframe with a navigable Shadow DOM canvas using
the project's own React and Remotion. Add pan, pointer-anchored zoom, Fit and
per-video camera memory, with the existing properties pane floating over the
canvas. Route selection, geometry handles, inline text, Snapshot, playback,
save receipts and Undo through the shared runtime and existing editing hooks.

Adapt supported studio-objects-v5 transports during native compilation without
rewriting video source. Scope styles and editing queries, retain playhead state
across preview-only rebuilds, and package the native runtime and compatibility
loader. Keep rendering/export on its existing bundle.
