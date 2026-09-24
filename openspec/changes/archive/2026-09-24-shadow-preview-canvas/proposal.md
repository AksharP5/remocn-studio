## Why

Editing needs a navigable canvas with an inspector that does not continually
resize the video. Following the initial lab, the user explicitly requested the
full adaptation in the main application. This replaces the earlier opt-in gate.

## What Changes

- Make the project's own React/Remotion Shadow DOM runtime the main preview.
- Reuse one Player/editing runtime through explicit surface roots and transport.
- Provide pan, pointer-anchored zoom, Fit, 100% and per-video camera memory.
- Float existing properties, playback controls and annotations above the canvas.
- Adapt existing studio-objects-v5 transport at native compilation time without
  modifying authored projects, their values or operation histories.
- Preserve direct geometry/text edits, Snapshot, Docs, receipts and Undo through
  existing commands. Keep the renderer/export pipeline independent.

## Capabilities

### New Capabilities

- `preview/shadow-canvas`: Native workspace, camera and explicit runtime lifetime.

### Modified Capabilities

- `preview/live-preview`: Main native host, playback shortcuts and scoped reloads.
- `preview/inspect`: Root-scoped picking and screen-space editing overlays.
- `shell/layout-and-panes`: Floating properties instead of a fourth column.

## Non-goals

A JavaScript sandbox, simultaneous project runtimes, a new scene model, timeline
or keyframe authoring. Tests, builds, lint, type checks and browser verification
remain explicitly deferred to the user.

## Impact

Webview surface loading and shell layout; a dedicated project webpack build;
packaged preview source modules and v5 transport loader. No Rust IPC or stored
history migration. No external video source edits. The lab URL remains an alias
for the same Studio shell, not a separate feature implementation.
