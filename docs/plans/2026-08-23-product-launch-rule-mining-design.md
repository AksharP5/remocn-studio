# Product-launch rule mining design

## Goal

Measure the rhythm and choreography of a focused corpus of product-launch
videos, turn the measurements into provenance-backed defaults, and expose only
the mechanically honest subset through the existing motion contract.

Version one covers **product launch only**. It does not mix launch videos with
TikTok, kinetic typography, or changelog genres.

## Corpus

Keep a committed manifest at
`reference-corpus/product-launch/manifest.json` with 12–16 official launch
videos from Apple, Linear, Stripe, Vercel, Raycast, and similarly relevant
publishers. A publisher contributes no more than three entries. Prefer clips
between 15 and 120 seconds; represent a long event by an explicitly declared
intro or promo segment rather than downloading the whole event.

Each entry records the canonical source page, publisher, source ID, published
date when available, local filename, optional segment boundaries, selection
rationale, and expected SHA-256 after the first successful fetch. Raw videos
live under `reference-corpus/product-launch/videos/`, are ignored by Git, and
are never shipped or redistributed.

`scripts/rule-mining/fetch.py` reads the manifest and uses the locally installed
`yt-dlp` for public YouTube or Vimeo pages. Direct publisher-hosted files remain
valid sources. Fetching uses no accounts, cookies, private URLs, DRM bypass, or
access-control workarounds. It records normalized source metadata, duration,
resolution, acquisition time, and SHA-256; a matching local file is not fetched
again. Unavailable sources fail independently and may be replaced in the
manifest.

## Measurement pipeline

The research tooling is local-only and does not add runtime dependencies to
Remocn Studio. FFprobe records media metadata. FFmpeg decodes timestamped,
downscaled analysis frames and audio. Python, OpenCV, NumPy, and librosa perform
the measurements.

For every video:

1. Detect candidate scene boundaries from frame difference and classify the
   surrounding window as `cut`, `fade`, `motion-transition`, or `unknown`.
   Ambiguous transitions remain unknown.
2. Track visual features between frames and estimate a global transform with
   RANSAC. Treat the global transform as camera motion. Compensate it before
   measuring residual dense optical flow, which represents element motion.
3. Classify intervals as `static`, `camera`, `elements`, or `mixed`, with a
   confidence value.
4. Detect musical beats from the audio track and report each boundary's
   distance to the nearest beat plus hit rates inside ±2, ±3, and ±4 frame
   windows.
5. Report scene durations, median and quartiles, short accent scenes, static
   holds, motion near boundaries, transition frequencies, and camera-versus-
   element motion shares.

Thresholds live in a versioned config and are copied into each result. The
aggregator repeats key summaries at neighbouring thresholds so an arbitrary
detector setting cannot silently become a design rule.

One versioned JSON result is written per video. It includes the schema version,
tool versions, configuration digest, source digest, measurements, confidence,
and warnings. Results are committed; raw media and temporary decoded frames are
not.

## Manual annotation

Annotate five to seven representative videos in committed JSON files. Manual
annotations capture semantic facts that pixel analysis cannot infer reliably:

- entrance order and hierarchy;
- overlap between gestures;
- intentional pauses and their narrative role;
- which layer keeps moving during an apparent hold;
- meaningful continuity across scene boundaries.

Annotations reference stable video and scene IDs and validate against a schema.
Automated and manual evidence remain distinct in the raw data and meet only in
the aggregate report.

## Outputs and integration

The aggregator writes a machine-readable product-launch rhythm profile and a
Markdown report containing sample sizes, distributions, confidence, sensitivity
analysis, and measurement IDs behind every proposed rule. A rule with weak or
ambiguous evidence stays in the report and is not promoted to a default.

Promoted rules go to
`agent/skills/motion-design/rules/product-launch.md`, linked from the main motion
design skill. A new `launch-teaser` archetype under the `remocn` skill consumes
the measured rhythm profile as genre defaults while leaving a project's
`video/motion.md` as its sole concrete motion brief.

Extend REM-294 only with the mechanically defensible assertion
`keeps_moving`: selector, bounded frame interval, and `maxStaticFrames` supplied
from the project's motion brief. `design_check` samples a bounded interval with
an adaptive stride and a hard frame budget. Oversized intervals fail with an
actionable request to split the assertion. Aggregate genre facts such as median
scene length or beat-aligned cut share remain authoring guidance rather than
pretending to be checks over two to nine key frames.

## Failure handling and reproducibility

Preflight verifies FFmpeg, FFprobe, Python packages, and available disk space.
Every fetch and analysis unit is isolated. JSON output is schema-validated and
atomically replaced only after success. Aggregation refuses incompatible schema
or analysis-config versions and refuses to promote rules below a documented
minimum sample size.

The downloader and analyser emit concise, actionable failures. Low-confidence
classifications are review items, never silent passes. Every derived artifact
retains enough source and configuration identity to reproduce its claim from a
local corpus copy.

## Verification

Generate non-copyrighted synthetic fixtures with FFmpeg for hard cuts, fades,
camera movement, a moving foreground element, static pauses, and beat-aligned
cuts. Unit-test configuration, schemas, classification, aggregation, atomic
writes, retries, and deterministic re-runs. Run one full synthetic video through
the integration pipeline with numerical tolerances.

Test `keeps_moving` in the existing browser audit fixtures, including missing
and ambiguous selectors, a valid moving target, an overlong hold, and an
interval above the sampling budget. Then run Python tests, focused Vitest,
typecheck, the sidecar build, and the repository check.

Finally generate matched launch examples using the old and measured rhythm
profiles, randomize their labels, and ask the person to choose blindly. Record
the human result in the report; do not replace this acceptance gate with an
invented automatic taste score.
