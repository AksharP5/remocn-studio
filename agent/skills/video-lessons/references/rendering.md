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
