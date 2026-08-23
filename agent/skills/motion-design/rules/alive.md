# Alive

Answers "what happens after the entrance settles". Read when a scene has a hold — the dead-after-entry failure is decided here. House position: hero/focal content keeps subtle residual motion; recurring chrome may rest; ceremony is rationed on repeats.

## Nothing focal sits pixel-frozen — give it a moving hold

After the entry settles, the hero keeps a low-amplitude residual drift, breathing scale, or micro-oscillation. This is the classical moving hold; without it the frame is a slide.

- **Numbers:** amplitude ±1–3px translate or ±0.5–1% scale `[unverified]` (Disney folklore); classical hold length 10–20f @30fps before any re-pose `[unverified]`; Survival Kit flags static >60f `[unverified]`.
- **Remotion:** after the entry spring settles, layer `Math.sin(frame / fps * rate)` at tiny amplitude on translateY/scale of the focal element — and spend visible effort on the arrival itself: a small settle, tilt, or secondary offset right after landing instead of holding the final value cold. The camera is the other cure: when an element exits, a subtle push-in takes up the slack; when one enters, a slight pull-out makes room (camera.md, Hitchcock's rule as a clock — Cinematography §Move In / Move Out, asserted).
- **Check:** `{id: dead-after-entry, measures: focal-element pixel change during its on-screen hold, threshold: zero change for >60 frames, severity: warn}`
- **Sources:** Disney 12 §moving hold (folklore numbers, asserted principle); Survival Kit §P1 Eric Larson, §P3 p.227–229, §P4 p.263–264, 313, 324–325 (asserted); Rauno Freiberg §proportional feedback (asserted); NN/g §attention ceiling (measured, tightened for video).

## Trailing parts settle late, from the inside out

Attached and secondary parts lag the driver, arrive after it, and settle in reverse order of size — container first, smallest accent last. When every animated property of an element reaches its final value on the same frame, the whole thing reads as a rigid cutout. Balance moves with delayed counter-motion at restrained amplitude.

- **Numbers:** children lag 2–5f behind the driver and end 3–8f after it `[unverified]`; counter-motion delayed 2–4f, smaller amplitude `[unverified]`.
- **Remotion:** child `interpolate` ranges end 3–8f after the parent's; lower `damping` on children; a jointed chain fixes stiffness with per-index phase lag (`Math.sin(frame - i * lag)`), not with a different easing curve.
- **Check:** `{id: no-follow-through, measures: animated props of a composite reaching final value on one shared frame, threshold: all same frame, severity: warn}`
- **Sources:** Survival Kit §P2 p.136, 151, 156–157, §P3 p.226–241 (asserted); Disney 12 §follow-through (asserted).

## No dead air inside a long move

An element translating for a while with nothing moving inside it floats and loses weight. During any substantial move, at least one secondary property animates on its own timing — and content never launches from a dead standstill.

- **Numbers:** any move >20f needs ≥1 secondary property animating `[unverified]`.
- **Remotion:** while the container translates, a child rotates/scales/drifts on its own phase; long-held text carries a 1–3% drift underneath.
- **Check:** `{id: dead-air, measures: secondary animation during moves >20 frames, threshold: none, severity: warn}`
- **Sources:** Survival Kit §P3 p.214, §P4 p.313 (asserted).

## No scene goes fully static — keep one slow ambient layer running

Independent of the hero's hold, every scene carries one ambient motion across its whole duration: a background drift, a slow parallax, a gentle scale. Drifting-cloud scale — slow, dim, small — so it enriches without pulling focus.

- **Numbers:** dead-frame ceiling: no frame-diff below noise for >90 consecutive frames (3s) `[unverified]` (tightened from NN/g's 10s UI ceiling); ambient amplitude a few px/s equivalent `[unverified]`.
- **Remotion:** one `interpolate` over the scene's full `durationInFrames` with a small output range on a background layer.
- **Check:** `{id: dead-frame-run, measures: consecutive frames with no visible change anywhere, threshold: >90 frames, severity: warn}`
- **Sources:** NN/g §10s attention (measured); Apple HIG §ambient drift (asserted); Disney 12 §moving hold (asserted).

## Recurring chrome may rest, and repeats get less ceremony

The liveliness budget belongs to the hero. Persistent labels, chrome, and baselines can be simply still — and the third occurrence of the same element type enters with far less flourish than the first (halve the duration, drop the overshoot, or just fade).

- **Numbers:** ceremony decays by the ~3rd repetition `[unverified]` (NN/g, measured).
- **Remotion:** first instance gets the full dictionary entry; later instances a shortened or plain variant. Recurring elements crossing scenes ride one continuous interpolate instead of re-entering each scene.
- **Sources:** Rauno Freiberg §frequency & novelty (asserted); Apple HIG §no motion tax on repeats (asserted); NN/g §third-viewing decay (measured).

## Numbers count to their value; never pop a metric as static text

A metric that appears fully formed is dead on arrival. The count-up is how the value arrives, decelerating into the exact final reading on its landing frame.

- **Numbers:** principle only.
- **Remotion:** `Math.round(interpolate(frame, [a, b], [0, target], {easing: Easing.out(Easing.cubic)}))` in the text node.
- **Check:** `{id: static-number-swap, measures: numeric text replaced between adjacent frames without a continuous count, threshold: any hero metric, severity: info}`
- **Sources:** UX in Motion §P5 value change (asserted).

## Emphasis is a beat, not a loop

Acknowledge a moment with one brief accent — a pulse, a dip to 0.97, a flash — then rest. Idle decorative loops (rotating rings, pulsing dots) promise change and deliver none.

- **Numbers:** accent one cycle, 3–8f `[unverified]` (Rauno "briefly"; Kowalski 0.97 press dip); flourish total ≤20f `[unverified]` (Fluent).
- **Remotion:** `interpolate(frame, [t, t+3, t+8], [0, 1, 0])` once; no unbounded periodic transform on a settled element.
- **Check:** `{id: idle-loop, measures: unbounded periodic transforms on settled elements with no narrative role, threshold: any, severity: info}`
- **Sources:** Fluent §delightful-brief (asserted); Rauno Freiberg §acknowledge then leave (asserted); NN/g §meaningless loops (measured); Apple HIG §indeterminate loops (asserted).

## Ban slow full-opacity oscillation

The breathing-logo idle loop in the 4–6s period band at visible amplitude is Apple's named discomfort zone and reads as a screensaver. If something must sway, shorten the period or shrink the amplitude and translucency.

- **Numbers:** avoid ~0.2 Hz — periods of 100–200f — at amplitude >2% of frame height on an opaque element `[unverified]` (Apple, measured sensitivity peak).
- **Remotion:** ambient sines use short periods or tiny amplitudes; never a 150-frame full-opacity sway.
- **Check:** `{id: slow-oscillation, measures: periodic loops with period 100–200 frames and amplitude >2% frame height, threshold: any on an opaque element, severity: warn}`
- **Sources:** Apple HIG §oscillation (measured).

## A loop must vary before it repeats

The eye catches the repeat: a perfect in-place cycle reads as a mechanical loop, and mirror-identical half-cycles are the giveaway. Vary each occurrence, run several differing sub-cycles before hooking back to the start, and let repeating motion progress across the frame rather than treadmill around a fixed point.

- **Numbers:** period ≥60f (2s) before an exact repeat `[unverified]`; half-cycles must not be mirror-identical `[unverified]`; a convincing rotation needs ≥3 distinct positions per revolution `[unverified]`.
- **Remotion:** modulate the main loop with a second low-frequency sine on a different period; compose `frame % total` of N varied sub-cycles; loops drift or advance rather than oscillating in place.
- **Check:** `{id: cycle-length, measures: frames before a loop repeats exactly, threshold: <60, severity: info}` and `{id: loop-mirror-identity, measures: mirrored half-cycle similarity, threshold: >98% identical, severity: info}`
- **Sources:** Survival Kit §P2 p.111/126, §P3 p.180–192 (asserted).

## Shake by out-of-order positions, never a pure sine

A tremble built from symmetric oscillation reads as a metronome. Real shake exposes positions out of order — skip forward, come back, irregular holds — and a traveling vibration interleaves two slightly offset copies of the motion on alternate frames.

- **Numbers:** positions played out of sequence (1,3,2,4,3,5…) with mixed 1–2f holds `[unverified]`; residual vibration after a fast event 3–5f `[unverified]`.
- **Remotion:** a hand-written non-monotonic frame→offset array, or a seeded `random()` per frame — never `Math.sin(frame * k)` alone for shake.
- **Check:** `{id: sine-shake, measures: shake driven by a single pure sinusoid, threshold: any, severity: info}`
- **Sources:** Survival Kit §P4 p.296–299 (asserted).

## Schedule detail motion in the holds, not the moves

Micro-animation (shimmer, ticks, blinks) is invisible during a fast passage and competes during a transition. It runs while the scene is holding.

- **Numbers:** principle only.
- **Remotion:** gate micro-animations on the window after the last entrance settles and before the exit begins.
- **Sources:** Disney 12 §secondary action timing (asserted).
