## Why

The canvas shows one frame, and the playback panel shows time as a bare line.
A video made of an intro, a feature tour and a call to action looks like one
undivided stretch, so finding "the pricing scene" means scrubbing and watching.
Tuning an easing curve at full speed is guesswork. The seek bar is now tall
enough to carry structure, and the preview runtime already reads every
`<Sequence>` the video registers, so the data is there.

The object list (`canvas-layers`) shows the same video flat: in `imaginator`
all 29 objects have `parentId: null`, so nothing says which scene an object
belongs to, and the runtime can only tell for the scene on screen. A scene has
to be described in the video itself, by the agent, every time — and checked,
because a convention alone was already not followed.

## What Changes

- The seek bar marks the video's scenes: a boundary at the start of each scene
  and the scene's name inside its segment where it fits. Hovering a segment
  names it; clicking a segment's name moves the playhead to the scene's start.
- A playback speed menu in the panel: 0.25×, 0.5×, 1× and 2×. It affects the
  preview only; Export and Snapshot are unchanged.
- Every scene is described, and the design check enforces it: each scene is a
  `<Series.Sequence>` or `<TransitionSeries.Sequence>` in the video's `index.tsx`
  with a short human `name`; `studio.json` has one scene object for it
  (definition `scene`, label equal to that name) bound to the scene's root; the
  scene's objects have it as `parentId`, and an object drawn inside another
  object has that one. A scene without a name or without its scene object is a
  design check error; an object outside every scene is a warning.
- In the object list, clicking a scene moves the playhead to the scene's start,
  and clicking an object that is not on screen moves the playhead to its scene,
  so the object appears with its outline and handles.

## Capabilities

### Modified Capabilities

- `preview/live-preview`: scenes on the seek bar; playback speed.
- `agent/knowledge`: the conventions describe every scene — name, scene object,
  parents.
- `agent/design-check`: three scene rules join the source's tunability rules.
- `preview/inspect`: scene rows and off-screen objects move the playhead.

## Non-goals

- Looping a scene or a range: deferred by decision (2026-09-23).
- Editing scene timing from the bar (dragging a boundary): that is timeline
  authoring, and it would write code the agent owns.
- Showing audio, video or nested sequences as tracks: one row of scenes only.
- Remembering the speed between launches: it resets to 1× with each video.
- Rewriting existing videos: `imaginator` and others are regrouped by asking
  the agent once the conventions and the check exist.
- Rendering the tree itself (collapsible groups, scene rows): `canvas-layers`.

## Impact

- Preview runtime (`preview/`): report the scene list with the playhead state;
  apply the playback rate to the Player.
- Webview: the message shape mirrored in `lib/studio/preview.ts`; the transport
  hook carries scenes and speed; `components/studio/preview-controls.tsx` draws them.
- Sidecar: the scene paragraph in `sidecar/claude/conventions.ts`; three rules
  in `sidecar/tools/tunability.ts` (`unnamed-scene`, `scene-without-object`,
  `object-outside-scene`) with their finding codes.
- Shared: the `scene` definition id from `shared/studio-document.ts`, introduced
  by `canvas-layers`.
- No IPC, Rust or history change: the runtime and the pane share the window.
