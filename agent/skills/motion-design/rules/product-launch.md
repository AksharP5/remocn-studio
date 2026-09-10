# Product-launch observations

Use this reference when comparing a launch montage with the local measured corpus.
These are observations from a heterogeneous sample, not a required pacing profile.
A tutorial, quiet announcement or one-shot demonstration can differ substantially.

## Evidence and limits

REM-299 measured 15 official launch sources from Apple, Linear, Vercel, Raycast and
Stripe on 2026-08-23: 449 automatically detected intervals and six manually annotated
films. Repository evidence lives under `reference-corpus/product-launch/`; this
corpus is not necessarily present in the installed skill bundle.

A detected interval is not necessarily a shot or a reading hold. Detection can miss
internal choreography in a continuous camera move. The aggregate combines different
brands, durations and messages; prevalence does not establish quality or causality.
Use per-reference observations for the film's actual direction.

## Observed distributions

At normalized 30fps, median detected interval length was about 40 frames / 1.33s;
the middle half was roughly 23–65 frames / 0.75–2.17s. About 36% were shorter than a
second. Detected boundaries were approximately 68% cuts, 25% motion transitions,
5% fades and 2% unknown. These figures describe this sample, not an edit quota.

About 56% of detected boundaries fell within four normalized frames of a beat.
That does not identify the intended musical cue or require matching every boundary.
Compare meaningful impacts, register changes and visual peaks against the actual mix.

Roughly 59% of analyzed time was classified as camera, element or mixed motion.
A moving background can coexist with a reading hold, but a still frame is also valid.
No individual element inherits a movement requirement from an aggregate percentage.
The measured static-run median (0.25s) and p75 (0.75s) are detector observations,
not limits on how long a title or result may remain readable.

## Apply to a specific launch

Identify the promise, real visual proof and final payoff. Choose the number and
length of shots from those needs. Inspect a short passage demonstrating the central
motion idea, event relationships and rhythm before building the full launch.
Compare event structure and framing with one suitable
reference rather than forcing every shot toward the sample median.

Use `keeps_moving` only when the selected shot explicitly promises continuous motion.
Set its interval and tolerance for that behavior and FPS. Stillness, a direct cut,
a long disclosure and a repeated rhythm can all be correct for the selected film.
