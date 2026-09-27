## Context

`preview/scenes.ts` folds Remotion's sequence registry, which reaches the preview
runtime through `PlayerInternals.TimelineSequenceObserverContext`
(`useSceneObserver`, `preview/scenes-report.ts`), into `{ id, name, from, duration }[]`
and posts it as the `scenes` message. The webview draws it with `segmentsOf`
(`lib/studio/seek-scenes.ts`) through `useSeekScenes` in the playback dock. See
the archived `2026-09-23-scenes-on-the-seek-bar` design for the pipe itself.
This change keeps that pipe and replaces only the fold and the segment width.

## What Remotion registers, read from 4.0.520

Read in `remotion/dist/cjs/series/index.js`, `Sequence.js` and
`use-media-in-timeline.js` of the reporting project (`remocn-studio-v2-videos`):

- `<Series>` renders one `<Sequence name="<Series>" durationInFrames={Infinity}>`.
  Its registered duration is clipped to the rest of the video, so it spans the
  whole video. Its single child is `IsInsideSeriesContainer`, so the old
  unnamed-scene fallback named it "Is Inside Series Container". That is the
  wrong name in the report.
- Each `<Series.Sequence>` registers as a `sequence` whose parent is that
  container, with the `name` prop as `displayName` (or `<Series.Sequence>`) and
  `isInsideSeries: true`. A sequence nested inside a scene gets `false`.
- `<Audio>` registers as type `audio` with the enclosing sequence as its parent.
  A `<Sequence>` renders its children **only while the playhead is inside it**,
  and it registers itself regardless. So at any frame, most sound-effect
  sequences are registered with no children at all. "A sequence that holds only
  audio" cannot be decided without the result changing with the frame.
- `from` is relative to the parent. `duration` is already clipped to the parent
  and the video.

`remocn-walk` at 0:26 therefore registers, at the top level: the Series
container (0–900), "Score" (0–846), "Score ending" (840–900), a dozen
"Sound: …" sequences and "Dot to baseline" (660–705). The old rule descended
only into a whole-video sequence that was alone at the top level, so every one
of these became a scene. Their segments overlapped, and so did their names.

## Decisions

### A whole-video sequence is a frame; look inside it first

At each level, a sequence spanning the whole video (after clipping) that holds
visible sequences is a frame. The frames are tried in order: first a frame whose
children are Series members (`isInsideSeries`), then the frame with the most
children, then registration order. The first frame whose inside yields at least
two scenes wins, and the search recurses so that Film → Act → scenes still
works. When no frame yields two, the level's own sequences are used, minus the
whole-video ones. This keeps "a background spanning the video beside real
scenes" working, since the background's inside yields nothing.

Alternative rejected: treating the Series specially and ignoring everything
else. That fails for a video with no Series but a whole-video `<Sequence>`
wrapper and a soundtrack beside it, which is the same shape as the report.
Alternative rejected: using `isInsideSeries` alone as the rule. It is an optional
field (older Remotion does not register it), and it says nothing about
TransitionSeries.

### Coverage, not type or length, drops the extras

A candidate whose frames are all covered by the other candidates is dropped. The
candidates are visited weakest first: shortest, then unnamed before named, then
the later registered before the earlier. This one pass removes a sound effect
inside a scene, a sound effect across a cut (covered by the two scenes on either
side), and a duplicate over the same frames (the named or earlier one stays).
Two scenes that only partly overlap, as in a transition, are both kept.

Rejected: a minimum length as a share of the video. A real one-second scene in
a one-minute video is 1/60 of the bar, and any threshold that catches a
twelve-frame sound effect also catches it. Rejected: dropping sequences whose
children are all audio. The children mount only while playing (see above), so
the list would change as the playhead moved.

Known limit: without a Series or a whole-video frame, a sound-effect sequence
that sticks out past the last scene or sits in a gap between scenes is still
shown. The bar degrades to one extra segment, and nothing is reported as an
error.

### A name stops at the next scene

`segmentsOf` sorts the scenes and ends each segment at
`min(scene end, next scene start, video end)`. The button and the label use that
width, and the label truncates with an ellipsis inside it (`truncate px-2`). The
label hides below 48px on the measured bar, and the button's `title` still names
it. At `remocn-walk`'s shortest scene (Accents, 60 of 900 frames), a dock of
830px gives 55px, so the name shows truncated. Below about 720px the name is
hidden and the scene is named on hover.

### Ticks

The tick at each boundary goes from 6px at 30% of the foreground colour to 8px at
50%. Full-height lines were rejected in the first design because they read as
blocks that were still loading. The reported illegibility came mostly from
twenty ticks bunched together, which the new rule removes. The contrast bump is
for the plain case: eight ticks over the played part of the bar
(`foreground/10`) in the light theme.

## Ownership and failure direction

- Preview runtime: the fold. Webview: segment geometry. Nothing crosses a new
  wire, the `scenes` message is unchanged, and there is no protocol bump,
  migration or settings key.
- An unexpected registry shape yields odd segments or a plain bar, never an
  error. A registry the runtime cannot read still sends no `scenes` message.
