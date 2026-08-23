# Timing

Answers "how many frames does this animation get". Read when choosing a duration for any entry, exit, move, or hold — before writing the `interpolate` range. All frame counts are at 30fps for full-frame video, after the ×1.5–2 rescale of UI values; original UI values in parentheses. Survival Kit numbers are animation-native (24fps film ×1.25) — prefer them where they conflict with rescaled UI values.

## Timing and spacing are two separate decisions — design both

When a hit lands (the keyframe's frame number) and how positions distribute between hits (the easing) are independent levers. The same duration with different spacing is a completely different motion; never accept default spacing because the duration is right.

- **Numbers:** principle only.
- **Remotion:** timing = the `interpolate` input range and `Sequence` offsets; spacing = the `easing:` over each range. Every range gets both decided explicitly.
- **Sources:** Survival Kit §P1 timing-and-spacing, coin experiment (asserted).

## Pick durations from a small ladder, not per-animation invention

Ad-hoc durations make a video read as many hands. Keep at most three or four distinct duration classes per video and derive every range from them.

- **Numbers:** ladder anchors: micro accent 4–6f, small element 8–12f, panel/card 12–18f, full-frame move 20–36f `[unverified]` (Material 50–1000ms ladder, Fluent 83/167/250ms, Carbon 70–700ms tokens `[unverified]`).
- **Remotion:** one `DUR` constants module in frames; every `interpolate` range length and `Sequence` offset comes from it, never an inline number.
- **Check:** `{id: duration-off-ladder, measures: distinct micro-durations per video, threshold: >5 distinct values, severity: info}`
- **Sources:** Material Motion §duration-tokens (asserted); Fluent §standard-durations (asserted); Carbon §duration-tokens (asserted); Val Head §tokens (asserted).

## Scale duration with size and travel distance

The farther an element travels or the larger the surface, the longer its move — and non-linearly, so big moves are not proportionally slow. One constant duration for everything is the single strongest uniform-rhythm tell.

- **Numbers:** captions/chips 8–12f (180–300ms), cards/text blocks 12–18f (300–400ms), full surfaces 20–30f (500ms iOS sheet) `[unverified]`; Material bands small 50–200ms / partial 250–400ms / full-screen 450–600ms `[unverified]`.
- **Remotion:** derive move length from travel: `dur = base + k * Math.sqrt(distancePx)`; small props get short tokens, full-frame moves the long band.
- **Check:** `{id: uniform-durations, measures: spread of entry spans across differently sized elements in one scene, threshold: all spans identical, severity: warn}`
- **Sources:** Material Motion §duration-scaling (asserted); Carbon §duration (asserted); Emil Kowalski §7-tips duration (asserted); NN/g §duration-vs-distance (asserted); Val Head §size rule (asserted); Survival Kit §P3 p.182/189, §P2 p.99 — a broad full-frame gesture needs ~60f with cushions, half a second reads as a flash `[unverified]` (asserted).

## Keep every entry inside the perceptible-but-brisk band

Below ~4 frames a change reads as a pop, not motion; past ~30 frames a single element's entry reads as syrup. Scene-long ambient drift is exempt — this bounds element entries and exits only.

- **Numbers:** entry span 6–30f, hard floor 4f `[unverified]` (NN/g 100–500ms band, Val Head ≥200ms perception floor, ~230ms mean visual perception `[unverified]`, measured).
- **Remotion:** no entry `interpolate` span under 4f or over ~30f; hero entrances may reach 30f, chrome stays near 8f.
- **Check:** `{id: entry-too-long, measures: per-element entry span, threshold: >30 frames, severity: warn}` and `{id: imperceptible-animation, measures: entry/exit span, threshold: <4 frames, severity: warn}`
- **Sources:** NN/g §duration (measured); Val Head §perception thresholds (measured); Emil Kowalski §great-animations (asserted); Rauno Freiberg §200ms rule (asserted).

## Make exits faster than entries

Leaving must cost less than arriving; spend the choreography on the arrival. Sources disagree on ratio — Material and Fluent run 2:1, NN/g 0.67–0.83× — house default: exit ≈ 0.5–0.8× its entry.

- **Numbers:** entry 12–20f, matching exit 6–12f `[unverified]` (Material 400/200ms, Fluent 333/167ms, NN/g 300 vs 200–250ms `[unverified]`).
- **Remotion:** the out-range of a `Sequence` gets roughly half the frames of its in-range.
- **Check:** `{id: exit-not-faster, measures: exit span vs matching entry span, threshold: exit ≥ entry, severity: warn}`
- **Sources:** Material Motion §applying (asserted); Fluent §animation-properties (asserted); NN/g §asymmetrical-timing (asserted).

## Expansion is slower than collapse

Growth stages the new content; collapse just clears room. Same asymmetry as entry/exit, applied to size changes.

- **Numbers:** expand 12–18f decelerating, contract 6–10f accelerating `[unverified]` (Fluent 300/150ms `[unverified]`).
- **Remotion:** two ranges over `scale`/clip: the opening one longer with ease-out, the closing one shorter with ease-in.
- **Sources:** Fluent §object example (asserted).

## Reserve the extra-long band for full-canvas moments

Durations past ~24f belong to scene-scale camera moves and ambience, never to a single element's entrance.

- **Numbers:** 21–36f band (Material 700–1000ms extra-long; Carbon 700ms slow-02 for background washes) `[unverified]`; nothing content-bearing slower than the background's own change.
- **Remotion:** only the scene wrapper or a background layer interpolates over these spans.
- **Sources:** Material Motion §tokens extra-long (asserted); Carbon §slow-02 (asserted).

## Holds carry the rhythm; do not fill every gap

Up to ~30f of stillness between related moves needs no bridging animation — a beat of rest is what makes the next arrival land. Longer than that, hand the frame to ambient motion (see alive.md).

- **Numbers:** unfilled gap ≤30f (1s) between related moves `[unverified]` (NN/g 1s train-of-thought limit, measured); caption/callout dwell ≥90–120f before exit `[unverified]` (Kowalski 4s toast `[unverified]`).
- **Remotion:** schedule micro-detail (counter ticks, shimmer) inside holds, not during transitions.
- **Sources:** NN/g §response-times 1.0s (measured); Emil Kowalski §toast dwell (asserted); Disney 12 §timing/holds (asserted); Survival Kit §P4 p.319 — a pause is what reads as thought (asserted); Cinematography §Entering and Exiting Frame — roll on the settled frame ~15–30f before the first event (asserted).

## A pose must be held long enough to read

Anything you want the viewer to register holds at least 6 frames; an accent pose shorter than 5 frames does not land at all. Steal the frames from the preceding motion if the schedule is tight.

- **Numbers:** readable hold ≥6f (Williams 6 @24fps, Avery 5 — a genuine range); accent pose ≥5f; any state that must read ≥3f `[unverified]`.
- **Remotion:** gaps between interpolation segments ≥6f; extend a key state backward into the previous segment rather than shortening the hold.
- **Check:** `{id: min-hold, measures: pose held between moves, threshold: <6 frames, severity: warn}` and `{id: min-accent-duration, measures: distinct accent pose length, threshold: <5 frames, severity: warn}`
- **Sources:** Survival Kit §P4 p.270, 292, 305/308 (asserted).

## Build the video on a tempo grid; the neutral beat is half a second

Set the piece's tempo before animating and land boundaries and entrances on multiples of one beat unit — then break the grid deliberately. The human reference cadence is two beats per second; judge every other duration against it. Cycle period maps to energy: shorter reads frantic, longer reads heavy.

- **Numbers:** neutral unit 15f (0.5s — stopwatch survey, measured); beat grid of 15–30f `[unverified]`; cycle-period ladder 5/10/15/20/25/30/40f from frantic to dirge — 15f businesslike, 20f leisurely, 25f+ tired/heavy `[unverified]`; prefer periods divisible by 2 and 4 `[unverified]`.
- **Remotion:** a global `BEAT` constant in frames; `TransitionSeries` boundaries and entrance `from`s land on multiples, with deliberate exceptions.
- **Sources:** Survival Kit §P2 p.109–110 — Kahl's pedestrian survey (measured), Jones's tempo grid (asserted).

## Vary repeated beats and scene durations — never a uniform grid played straight

Real consecutive beats differ; equal durations read mechanical. Repeated same-kind events vary 20–60%, paired beats run unequal (~2:1), and the whole video alternates slightly-too-fast with slightly-too-slow scenes.

- **Numbers:** consecutive same-kind events differ 20–60% (traced live action: 15f then 24f, ~1.6:1 — measured); paired beats ≈2:1 `[unverified]`; scene-duration stddev/mean <0.15 is the flag `[unverified]`.
- **Remotion:** jitter successive durations of repeated events; unequal alternating `Sequence` lengths; shorten beat lengths toward a climax. Vary framing scale along with duration — no two adjacent scenes identical in both length and zoom (camera.md's `shot-scale-variety`); pacing is a compositional decision, not a residue.
- **Check:** `{id: uniform-beat, measures: duration variance of consecutive same-kind events, threshold: <10% variation, severity: warn}` and `{id: duration-variance, measures: stddev of scene durations / mean, threshold: <0.15 with ≥3 scenes, severity: warn}`
- **Sources:** Survival Kit §P2 p.140–141 (measured), §P1 X-Sheet, §P4 p.296, §P3 p.194–211 (asserted); Cinematography §Montage / Russian formalists, §Editorial fodder (asserted).

## When it feels frantic, double the duration — do not shrink the distance

The classic beginner error is too much movement in too little time. The remedy is time, not travel: keep the amplitude and give the move twice the frames.

- **Numbers:** ×2 remedy; non-pop transforms ≥10f `[unverified]`.
- **Remotion:** double `durationInFrames` of the offending move; amplitudes stay (see the exaggeration bias in easing.md).
- **Check:** `{id: min-move-duration, measures: non-pop transform spans, threshold: <10 frames, severity: warn}`
- **Sources:** Survival Kit §P2 p.99 (asserted).
