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
the whole video. Names: `displayName` unless it is a placeholder in angle
brackets — Remotion 4.0.520 names every unnamed `<Series.Sequence>`
"<Series.Sequence>", which the first build showed nine times on the bar — else
the single child component's name made readable (a trailing "Scene" dropped,
words split: `CustomerStoriesScene` → "Customer Stories"), else `Scene N`. Alternative considered — deriving in the webview
from a raw registry dump: the registry holds refs and functions that cannot
cross the message boundary, and the fold would be duplicated anyway.

The Player has no sequence registry of its own. Found in the running app on
2026-09-23: a first build read `Internals.SequenceManager` from inside the
composition and the bar stayed plain. In Remotion 4.0.520 a `<Sequence>`
registers only when the environment is the Studio or `SequenceRegistrationContext`
is on, and `<Player>` mounts a `SequenceManagerProvider` and turns registration on
only when `PlayerInternals.TimelineSequenceObserverContext` carries an observer —
otherwise the context is Remotion's empty default. The runtime therefore wraps its
`<Player>` in that context with an observer (`useSceneObserver`,
`preview/scenes-report.ts`) that receives every registry change, folds it to
scenes once per animation frame and posts `{ type: "scenes", compositionId,
scenes }` only when the list changed by value. A Remotion without that context
gets no observer, no registry and a plain bar — never an error. Side effect,
wanted: the registry `InteractivityRuntime` reads for the properties pane's timing
windows is populated for the first time in the native canvas.

The pane keeps the latest report under the composition id the runtime sent,
not under the one the pane believes is open, and shows it once the two agree.
Found with a console trace on 2026-09-23: the runtime posted nine scenes for
`imaginator` while the pane's `preview.composition` still read the previous
video, so a filter at receipt dropped the only message — scenes are posted on
change, unlike `transport.state`, which is re-announced constantly.

### Speed is a transport command

`{ type: "transport.rate", rate }` sets `playbackRate` on the Player. The pane
owns the value (webview state in the transport hook), resends it after a
rebuild's runtime reports ready, and resets it to 1 when the video changes.
Remotion applies the rate to media elements it controls; `<Audio>`/`<Video>`
follow it.

### Drawing

`useSeekScenes` (hook) maps scenes to percentages of the duration
(`segmentsOf`, pure, in `lib/studio/seek-scenes.ts`) and labels a segment only
when it is at least 48px wide on the measured bar, measured on resize, not per
frame. Boundaries are 6px ticks from the top edge of the slider track — full-height
dark lines were tried first and cut the bar into blocks that read as content
still loading; the name of the scene under the playhead is drawn in the
foreground colour; the names sit in a
16px row directly above it, one button per segment (an unlabelled one still
names itself on hover). Inside the bar was rejected after the bar gained its
elapsed and total times at its two ends: the first and last scene names would
collide with them, and a clickable name inside the slider fights the slider's
own pointer-down seek and drag. A click on a name seeks to the scene's first
frame through the existing `seekTo`. The speed is a small menu before the mute
button, listing `PLAYBACK_RATES`.

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
scene object — except one the video's `index.tsx` reads by a literal id
(`useStudioObject('film-stage')`), which is how a background or soundtrack that
spans every scene is written — skipped when the video declares no scene objects
at all, so a video made before this change gets the two errors, not 29
warnings. A scene named by an expression (`name={title}`) counts as named; its
object cannot be matched statically and is not reported. Scenes sequenced
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
