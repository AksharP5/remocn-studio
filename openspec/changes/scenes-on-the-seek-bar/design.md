## Context

The preview runtime (`preview/`, compiled by the project's webpack into the
canvas's Shadow DOM) already subscribes to Remotion's sequence registry
(`Internals.SequenceManager`, `preview/interactivity.tsx`) to find timing
windows for the properties pane. Every mounted `<Sequence>`, `<Series.Sequence>`
and `<TransitionSeries.Sequence>` is in it with `from`, `duration`, `parent`,
`showInTimeline`, `type` and `displayName`. Measured in the installed Remotion
(`test/fixtures/render-smoke`): `from` is relative to the parent sequence, and
`displayName` is the `name` prop or an empty string — there is no fallback to
the child component, but `singleChildComponent` carries it when there is one.

The runtime and the pane share one window. Runtime → pane state travels as
preview messages (`transport.state`, `playhead`), mirrored by hand in
`lib/studio/preview.ts` and kept in step by `lib/studio/preview.test.ts`.

## Goals / Non-Goals

**Goals:** scenes derived where the registry lives; one message shape; the
bar stays cheap to render while playing at 30–60 fps.

**Non-Goals:** a multi-track timeline, loop ranges, persisted speed.

## Decisions

### The runtime derives scenes; the pane only draws them

`preview/scenes.ts` (pure, tested) turns registry entries into
`{ id, name, from, duration }[]` with absolute frames: it sums `from` up the
parent chain, keeps `type === "sequence"` with `showInTimeline`, takes the top
level, and descends one level while the top level is a single sequence covering
the whole video. Names: `displayName`, else the single child component's
display name, else `Scene N`. Alternative considered — deriving in the webview
from a raw registry dump: the registry holds refs and functions that cannot
cross the message boundary, and the fold would be duplicated anyway.

The runtime posts `{ type: "scenes", scenes }` when the derived list changes
(compared by value), not with every playhead tick. The registry changes on
mount and unmount, so the list is recomputed on registry change, debounced to
one per frame. Sequences deeper than the scene level mount and unmount as the
playhead moves; they do not change the derived list, so no message is sent.

### Speed is a transport command

`{ type: "transport.rate", rate }` sets `playbackRate` on the Player. The pane
owns the value (webview state in the transport hook), resends it after a
rebuild's runtime reports ready, and resets it to 1 when the video changes.
Remotion applies the rate to media elements it controls; `<Audio>`/`<Video>`
follow it.

### Drawing

`useSeekScenes` (hook) maps scenes to percentages of the duration and decides
which labels fit, measured once per resize, not per frame. The segments are a
static layer under the slider's fill; only the fill and the handle move while
playing. A click on a label seeks through the existing `seekTo`; the bar keeps
its slider semantics for dragging and the keyboard.

### Scenes are described in the video, and the check makes it mandatory

The runtime knows which objects are mounted and, through the registry, which
scene is playing — but not which scene an unmounted object belongs to, so a
list built from observation would reshuffle as the playhead moves. The
membership therefore lives in `studio.json`, written by the agent: a scene object
(definition id `scene`, the constant `SCENE_DEFINITION` in
`shared/studio-document.ts`) with the scene's name as its label, and `parentId`
chains from every object to it. `parentId` already means grouping only — "it does
not imply inherited values or transforms" (v5 README) — so no geometry changes.
A definition may have no fields, so a scene object costs one `bind` on the
scene's root.

A convention alone was not enough: every object in `imaginator` was written with
`parentId: null`. `sidecar/tools/tunability.ts` already reads the video's files
and `studio.json` for every design check, which the conventions require before
finishing, so three static rules join it: `unnamed-scene` (error) for a
`<Series.Sequence>` / `<TransitionSeries.Sequence>` in `index.tsx` with no `name`;
`scene-without-object` (error) for a named one with no scene object of that
label; `object-outside-scene` (warning) for an object whose parents never reach a
scene object, skipped when the video declares no scene objects at all so a video
made before this change gets the two errors, not 29 warnings. Scenes sequenced
elsewhere than `index.tsx` are not seen; the conventions put them there.

### The list links to the seek bar by name

A scene row finds its frames by matching its label to a scene's `name` from the
runtime's scene list. Both are written by the agent under one convention, and the
check fails when a named scene has no object of that label, so they agree for
videos the check has passed. When they do not, a scene row just selects without
seeking — never an error. Linking through the runtime (the sequence a scene
object is mounted in) was rejected: it only works while that scene is on screen,
which is exactly when the jump is not needed. An off-screen object seeks to the
scene of its nearest scene ancestor.

## Risks / Trade-offs

- [A video built without `<Series>` has one top-level sequence per element] →
  the "fewer than two scenes → plain bar" rule and the descend rule cover the
  common shapes; an odd structure shows odd segments, never an error.
- [Premounted sequences register before they start] → frames come from
  `from`/`duration`, not from mount state, so premounting does not shift them.
- [Nested `<Series>` inside a scene] → out of scope; the scene is one segment.
- Failure direction: if the registry cannot be read, no `scenes` message is
  sent and the bar is plain; nothing is shown as an error.

## Migration Plan

None. Existing videos get scenes where their sequences have names or single
component children; new turns add names through the conventions.
