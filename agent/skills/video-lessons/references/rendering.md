# Rendering and reproducibility

Scope: verify available options against the installed renderer. Historical settings
such as scale 2, CRF 15 and ANGLE are test configurations, not compulsory delivery
settings or guarantees of visual quality.

## Verify the artifact

Use the registered composition and actual entrypoint. Choose resolution, scale,
codec and backend for the deliverable; inspect fine type and maximum zoom in the
encoded result. A high-resolution render cannot restore detail absent from a source.

Wait for the actual renderer process to complete, check its exit status and inspect
the produced container and duration. A shell notification or a wrapper exit does not
prove the render finished. Use unique output paths for concurrent attempts. Before
retrying a failed render, identify its owned process; do not kill unrelated renders.
Preserve real exit codes when piping tool output.

Save the export path, source version or content hash, settings and checked coverage
in the video's review. Re-render affected intervals after changes. An earlier MP4
must not be presented as verification of later source edits.

## Pixel and temporal checks

Inspect actual rendered fonts, UI content, seams, numeric values and transitions.
Use exact frame exports for frame-level diagnosis. Contact sheets locate suspect
intervals; inspect those intervals more densely and in motion. A tile filter may
pad missing cells with black, which is not evidence the video fades to black.

Compare repeated captures of the same frame under identical settings when seeking
should be deterministic. Byte comparison is useful for identical lossless captures;
use appropriate pixel comparisons when encoding or metadata differ. A difference
is evidence to investigate, not automatically a motion defect.

Review the actual audio mix and visual cue alignment in the exported fragment.
A beat map alone does not verify perceived sync. Inspect full-render coverage,
stale flags and failed/skipped checks before claiming completion.

## Sound effects end when the sound does

Symptom: the Studio preview stops with a warning or "The video could not render"
once playback passes the first few sound cues, while the export renders fine.
Applies to any `<Audio>` (or `<Html5Audio>`) cue inside a `<Sequence>` that has
`from` but no `durationInFrames`. Such a sequence lasts until the end of the video,
so every cue already played stays mounted, and the count of mounted audio elements
only grows. Remotion's Player limits how many can be mounted at once
(`numberOfSharedAudioTags`, 5 by default) and throws
`Tried to simultaneously mount N <Html5Audio /> tags`; the renderer has no such
pool, which is why an export succeeds. Observed on evlibutton (Remotion 4.0.520):
a score plus about twenty one-shot effects, each in an open-ended sequence.

Correction: give every one-shot cue its own length. Set the sequence's
`durationInFrames` to the sample's duration in frames (read it from the file, e.g.
with `getAudioDurationInSeconds` from `@remotion/media-utils` in
`calculateMetadata`, or a measured table next to the samples), so the cue unmounts
when its sound has finished. Keep the score and other beds that genuinely run to the
end open-ended or sized to their section. Verify by previewing past the densest run
of cues, not only by rendering.

Counterexample: a single music bed that plays to the last frame needs no duration.

## Media and project setup

Inspect media duration, trim offsets and freeze points so a video never seeks past
its usable clip. Self-contained excerpts and original clips require different trim
origins. Simultaneous decoders have a machine-dependent cost; measure resource use.

Match Remotion packages to compatible exact versions. If hooks appear stuck despite
changing frames, check duplicate React/Remotion contexts and nested dependencies
before rewriting animation code. Resolve only the conflicting dependency; do not
blindly delete an unrelated project's node_modules.

A nested demo should export its composition component through the intended entry,
not register a second root inside a parent composition. `staticFile` resolves against
the serving project's public directory; locate assets there or use another supported
asset mechanism with provenance.

Node render/bundle scripts may need explicit configuration rather than inheriting
CLI settings. Check aliases, CSS setup, backend and environment loading. Reuse a
bundle when taking many stills of unchanged source. Verify CORS for cross-origin
assets and the environment variables actually exposed to the composition.

## Footage stutters where the source is smooth

Symptom: in the export, footage repeats a frame and then skips the next one, in a
steady rhythm (every third frame at 30 fps), while the source file plays smoothly
and the preview looks fine. Applies to `OffthreadVideo` playing phone or camera
files whose frames are stamped on a millisecond-rounded clock: a time base that
does not divide the frame rate, such as 1/16000 at 30 fps, where the steps
alternate 528 and 544 ticks instead of 533⅓. Recognise the file with
`ffprobe -v error -select_streams v:0 -show_entries packet=pts -of csv=p=0 <file>`:
the differences between consecutive values are not all equal. `OffthreadVideo`
asks for exactly `frame / fps`. A source frame that starts even 0.3 ms after that
moment is "not started yet", so the previous frame is shown again and the late
one never is. The studio's design check reports such a file as
`footage_late_frames`, with the number of late slots.

Observed on test-orcdev (Remotion 4.0.520, 220 frames of one clip): through
`OffthreadVideo`, 144 of 220 exported frames were the right source frame. Through
`<Video>` from `@remotion/media`, 212 of 220 were, and rendering the original file
or a remuxed copy gave pixel-identical output. The whole 803-frame film then
matched a clean reference on 499 of 500 distinguishable frames.

Correction: embed the clip with `<Video>` from `@remotion/media`, which accepts a
frame that starts within a millisecond of the requested time. Add the package with
the project's own package manager, pinned to its `remotion` version. Pass
`objectFit` as a prop rather than as CSS. Do not rewrite the person's file. Only on
a Remotion without `@remotion/media` (before 4.0.351), remux the clip onto an exact
grid without re-encoding and point the scene at the copy:
`ffmpeg -i in.mp4 -map 0:v:0 -c copy -bsf:v h264_mp4toannexb -f h264 v.h264`, then
`ffmpeg -r 30 -i v.h264 -i in.mp4 -map 0:v:0 -map 1:a:0 -c copy -video_track_timescale 15360 out.mp4`.
Verify by matching exported frames to source frames over a few seconds of motion.

Counterexample: a near-identical frame that recurs strictly every sixth frame is
a 25 fps capture padded to 30 by the camera. It is in the source itself, no
component removes it, and fixing it is a timeline or interpolation decision for the
person.
