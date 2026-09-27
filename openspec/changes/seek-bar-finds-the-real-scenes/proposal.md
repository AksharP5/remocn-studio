## Why

Reported on `remocn-walk`, a Video of eight named scenes in a `<Series>` beside a
soundtrack and one overlay. The scene track above the seek bar drew
"Is Inside Series Container" and "Score" over each other at the left and a
clipped "Sound: …" over "Score ending" at the right, with about twenty tick marks
below them. None of the eight scene names appeared.

The rule in `preview/live-preview` takes the top-level sequences as the scenes. It
descends into a sequence that spans the whole video only when that sequence is
alone at the top. `remocn-walk`'s top level holds the `<Series>` container, the
two score sequences, every sound-effect sequence and "Dot to baseline", so the
rule never looked inside the Series. It took the container itself as a scene. The
container's only name is Remotion's placeholder `<Series>` around
`IsInsideSeriesContainer`, and the unnamed-scene fallback turned that into
"Is Inside Series Container". The segments then overlapped on the bar. Each label
was confined to its own segment, but nothing stopped it at the frames another
scene covered.

## What Changes

- **A sequence spanning the whole video is a frame, not a scene.** The scenes are
  looked for inside it, even when shorter sequences sit beside it. A `<Series>`
  frame is tried before any other, then the frame with the most sequences in it.
  When the inside of a frame yields fewer than two scenes, the frame is passed
  over and the scenes come from the level it sits on.
- **A sequence whose frames other scenes already cover is not a scene.** That
  rules out a sound effect inside a scene or across a cut, and a second sequence
  over the same frames. When two sequences cover the same frames and only one has
  a name, the named one stays.
- **A segment's name stops where the next scene starts**, so two scenes that
  overlap for a transition never draw their names over each other.
- The boundary ticks on the seek bar are drawn taller and with more contrast.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `preview/live-preview`: "The seek bar shows the video's scenes" gets the new
  rule for what counts as a scene, and a name now stops at the next scene.

## Impact

- **Preview runtime** (`preview/scenes.ts`): the fold from Remotion's sequence
  registry to scenes. The `scenes` message is unchanged.
- **Webview** (`lib/studio/seek-scenes.ts`, `components/studio/preview-controls.tsx`):
  segment widths and the tick style.
- **Shared contract, sidecar, Rust core**: untouched. No protocol bump.

## Non-goals

- **A nested Series inside a scene.** Each scene stays one segment.
- **Reading the sound off the sequence.** Remotion registers a sequence's
  `<Audio>` only while the playhead is inside that sequence. A "holds only sound"
  test would therefore change with the frame, and the bar would flicker. Coverage
  by other scenes is decided from frames alone.
- **A multi-track timeline.** The bar shows one row of scenes.
