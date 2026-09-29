## Why

Seen on test-orcdev (2026-09-29): footage stuttered in the export and looked fine
at its source. The camera files stamp frames on a millisecond-rounded clock (time
base 1/16000, frame steps of 528 and 544 ticks instead of 533⅓), so every third
frame starts about 0.3 ms after its n/30 slot. `OffthreadVideo` asks the compositor
for exactly `n/fps` and gets "not started yet", so it shows the previous frame again
and then skips one. Measured on 220 frames of one clip: 144 of 220 exported frames
were the right source frame (`0,1,1,3,4,4…`). The agent fixed it by remuxing the
clips onto an exact grid, after a whole round of diagnosis that any phone or
camera footage can trigger again.

`<Video>` from `@remotion/media` accepts a frame that starts within 1 ms of the
requested time (4.0.520, `getFrameFromTimestamp`). Through it, the original and
the remuxed copy rendered pixel-identical and matched the reference on 212 of 220
frames; the other 8 are near-identical frames of a 25 fps capture padded to 30.
Remotion's own skill already recommends `<Video>`; the agent used `OffthreadVideo`
anyway. No Linear issue yet.

## What Changes

- The studio's conventions tell the agent to embed footage with `<Video>` from
  `@remotion/media`, not `OffthreadVideo`. A project that does not declare
  `@remotion/media` gets it with the project's own package manager, pinned to the
  project's Remotion version.
- The new-project template declares `@remotion/media` at the template's Remotion
  version, so a new project needs no install for it.
- `video-lessons` records the lesson: the symptom, how to recognise the file, the
  cause, the correction, and a counterexample.
- The design check gains a footage-timing rule. For every `OffthreadVideo` the
  rendered page shows, it reads the source file's frame timestamps and reports
  how many frame slots would show the previous frame. The finding points at
  `<Video>` from `@remotion/media`. The rule reports its own status: completed,
  not applicable, or skipped with a reason.

## Non-goals

- **Normalising footage when it enters the library.** Remuxing fixes any component,
  but the app has no muxer, and it would rewrite a file the person dropped in.
- **Rewriting existing `OffthreadVideo` usage unprompted.** An existing component is
  left alone unless the design check flags it or the person asks.
- **Cadence judder in the capture itself** (25 fps padded to 30). No component
  removes it; that is a timeline or interpolation decision.
- **Explaining the ~2 grey-level difference** between `@remotion/media` and
  `OffthreadVideo` output. The design measures which one matches the source
  (`<Video>` does); why `OffthreadVideo` is darker is not pursued.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent/design-check`: a new requirement that footage the renderer would show late
  is measured from the file and reported with its own rule status.
- `agent/knowledge`: a new requirement that the conventions name `<Video>` from
  `@remotion/media` for footage and say how a project gets the package.

## Impact

- **Sidecar**: a pure reader for frame timestamps in the video container, and the
  footage-timing rule beside the frame audit in `sidecar/preview/` (a new
  `DesignFindingCode` and a readiness rule status). The frame audit also collects the
  `OffthreadVideo` proxy sources the page requests. The conventions sentence goes in
  `sidecar/agent/`.
- **Skills bundle**: `agent/skills/video-lessons/references/rendering.md`.
- **Template**: `templates/remotion/package.json` gains `@remotion/media`.
- **Webview, Rust core, shared IPC**: no change. The design check's answer shape is
  already open to new finding codes, and `SIDECAR_PROTOCOL` does not move.
- **Preview**: the Studio preview was built around `OffthreadVideo`. Whether
  `@remotion/media` previews well in WKWebView is unverified, and it is the first
  task, checked in the running app.
