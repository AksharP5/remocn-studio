# Easing

Answers "what curve does this motion take". Read before passing any `easing:` to `interpolate` or configuring a `spring`. The direction rule (out on entry, in on exit, in-out for on-screen moves) is industry consensus across every source.

## Enter on a decelerating curve — fast arrival, gentle settle

Every entrance starts at speed and brakes into rest. An ease-in entrance drags at the start and lands abruptly; it is the wrong shape everywhere.

- **Numbers:** Material emphasized-decelerate `cubic-bezier(0.05, 0.7, 0.1, 1)`, standard-decelerate `cubic-bezier(0, 0, 0, 1)` `[unverified]`; Carbon expressive `cubic-bezier(0, 0, 0.3, 1)`, productive `cubic-bezier(0, 0, 0.38, 0.9)` `[unverified]`; Fluent `cubic-bezier(0, 0, 0, 1)` `[unverified]`; Kowalski's expressive out `cubic-bezier(0.16, 1, 0.3, 1)` `[unverified]`.
- **Remotion:** `[0.05, 0.7, 0.1, 1]` as the inline default of the component's `entryEasing` prop, spread in as `Easing.bezier(...entryEasing)` on every entry range (or a spring, whose `damping` and `stiffness` are props of their own); never an ease-in on an entrance.
- **Check:** `{id: ease-in-entry, measures: easing family on entry ranges, threshold: any ease-in or linear entry on a spatial property, severity: warn}`
- **Sources:** Material Motion §easing-tokens (asserted); Carbon §entrance-easing (asserted); Fluent §fast-out-slow-in (asserted); Emil Kowalski §7-tips (asserted); NN/g §easing (asserted); Val Head §ease-out (asserted).

## Exit on an accelerating curve — slow release, fast departure

An exit gathers speed until it leaves; braking off-screen reads as reluctance. Exception: an element that will return (parking off-frame) decelerates out with a standard curve instead.

- **Numbers:** Material emphasized-accelerate `cubic-bezier(0.3, 0, 0.8, 0.15)` `[unverified]`; Carbon expressive exit `cubic-bezier(0.4, 0.14, 1, 1)` `[unverified]`; Fluent `cubic-bezier(1, 0, 1, 1)` `[unverified]`.
- **Remotion:** `[0.3, 0, 0.8, 0.15]` as the inline default of the component's `exitEasing` prop, spread in as `Easing.bezier(...exitEasing)` on exit ranges — declared inside the enum variant that owns the exit, so it exists only where it is sampled; pair with an opacity fade — nothing slides off at full opacity.
- **Check:** `{id: exit-at-full-opacity, measures: exiting element opacity at last visible frame, threshold: ≥0.9 while translating out, severity: warn}`
- **Sources:** Material Motion §easing-tokens (asserted); Carbon §exit-easing + exception (asserted); Fluent §slow-out-fast-in + "always combine with fade" (asserted); NN/g §easing (asserted); Val Head §ease-in-exits (asserted).

## Move on-screen elements with an in-out curve

Something visible before and after its move eases both ends and keeps speed through the middle.

- **Numbers:** Material standard `cubic-bezier(0.2, 0, 0, 1)` at ~15–18f `[unverified]`; Carbon standard `cubic-bezier(0.2, 0, 0.38, 0.9)` / `cubic-bezier(0.4, 0.14, 0.3, 1)` `[unverified]`; Fluent point-to-point `cubic-bezier(0.55, 0.55, 0, 1)` `[unverified]`.
- **Remotion:** `[0.2, 0, 0, 1]` as the inline default of the component's `moveEasing` prop, spread in as `Easing.bezier(...moveEasing)` for mid-scene repositioning of a persistent element.
- **Sources:** Material Motion §standard (asserted); Carbon §standard-easing (asserted); Fluent §point-to-point (asserted); Val Head §in-out (asserted); Emil Kowalski §natural motion (folklore).

## Linear easing is banned on transforms; allowed only on short pure-opacity fades and mechanical loops

Constant velocity from rest to rest is the strongest slideshow tell. The exemptions are narrow: an opacity-only blink of a few frames, and continuous mechanical motion (counters, spinners, marquees) that never starts or stops on screen.

- **Numbers:** linear opacity blink ≤5f (Fluent 83ms bare-minimum fade `[unverified]`); everything positional takes a curve, principle only.
- **Remotion:** every `interpolate` on translate/scale/rotate passes `easing:` from a prop; a bare call is only legal when the output drives `opacity` over a short span or a loop. Linear as a deliberate choice is `[0, 0, 1, 1]` as that prop's inline default, not a hardcoded `Easing.linear`.
- **Check:** `{id: linear-organic, measures: interpolate on transform props without an easing option, threshold: any occurrence outside loops, severity: warn}`
- **Sources:** Material Motion §linear (asserted); Carbon §easing (asserted); Apple HIG §watchOS floor (asserted); UX in Motion §P1 (asserted); Disney 12 §slow-in-slow-out (asserted); NN/g §easing (asserted); Val Head §most-common-mistake (asserted); Fluent §bare-minimum (asserted); Survival Kit §P1 coin experiment — identical duration with different spacing is a different motion (asserted).

## Never tween straight from A to B on a hit — go A to X to B

A bare two-keyframe tween is the single biggest character killer: the transitional position belongs off the straight path (an arc, a tilt, an overshoot) and never at the geometric midpoint. Bias the breakdown hard toward one neighbor for understated, stable movement.

- **Numbers:** principle only (Hawkins: "don't go from A to B, go from A to X to B").
- **Remotion:** multi-stop `interpolate([0, 0.5, 1], [A, X, B])` with X authored off the A→B line; on a rotation, dip the mass at the midpoint — pure two-point rotation slides features across a static shape.
- **Check:** `{id: bare-two-key-hit, measures: two-keyframe linear tweens on accent/impact moves, threshold: any, severity: info}`
- **Sources:** Survival Kit §P1 extremes-and-breakdowns, §P2 p.88, §P3 p.218–223, §P4 p.291 (asserted).

## Falls accelerate; slow-in exists only at the apex

Anything dropping gains speed all the way down — decelerating into the ground reads weightless. A heavy element's descent immediately follows its rise with no float at the top, and the descent is faster than the ascent.

- **Numbers:** principle only.
- **Remotion:** `[0.11, 0, 0.5, 0]` — quad-in — as the inline default of the falling element's `easing` prop; ease-out only for rises and settles; piecewise easing for bounces.
- **Check:** `{id: fall-easing, measures: easing on downward moves, threshold: any decelerating curve into a landing, severity: warn}`
- **Sources:** Survival Kit §P1 bouncing ball, §P2 p.92, §P3 p.188 (asserted).

## Snap into accents — no ease-in on a hit

Easing into an accent is mush. The arrival is steep with zero soften; the cushion belongs on the recovery after the hit. This is a scoped exception to the entry-decelerate default: it governs emphasis hits on already-visible elements, not entrances.

- **Numbers:** hard accent recoils past its end and bounces back over ~4–11f `[unverified]`; soft accent passes through and drifts to a cushioned stop `[unverified]`.
- **Remotion:** steep arrival (no ease-in half) + a decelerating recovery curve, both as inline defaults of the accent's own `easing` props, or a low-damping `spring` whose `damping` and `stiffness` are props; never an in-out curve into an accent.
- **Check:** `{id: mushy-accent, measures: easing shape at accent arrival, threshold: ease-in component on the hit, severity: info}`
- **Sources:** Survival Kit §P4 p.293–294, 306 (asserted).

## Size spring configs to what moves

Snappy for small parts, soft for whole-frame surfaces; a large panel overshoots less than a small chip. Use springs when motion should feel physical or reactive, authored beziers for choreographed entries and exits.

- **Numbers:** Material spatial springs — small stiffness 1400, default 700, full-screen 300, damping 0.9 (≈2:1 per size step) `[unverified]`; effects (opacity/color) damping 1.0, stiffness 3800/1600/800 `[unverified]`.
- **Remotion:** `spring({fps, frame, config})` whose `damping`, `mass` and `stiffness` come from number props with inline defaults — high damping and low velocity for large surfaces, livelier configs for chips and accents; keep the ratio, not the absolute values. A `spring()` is not an easing and never becomes one.
- **Sources:** Material Motion §spring-system (asserted); Rauno Freiberg §weight physics (asserted); Emil Kowalski §springs (asserted); Disney 12 §timing-as-weight (asserted).

## Dose overshoot by tone; never on opacity, color, or glyphs

Business/productive tone gets a damped settle with no visible bounce; expressive tone may overshoot visibly (scale to ~1.03–1.08 before settling). Opacity and color always settle dead, and text glyphs never bounce — an elastic settle belongs to panels and objects.

- **Numbers:** spatial damping 0.9 for slight overshoot, effects critically damped `[unverified]` (Material); overshoot peak 1.03–1.08 `[unverified]` (Disney 12 exaggeration); Fluent strong entrance: three chained beziers over ~20f `[unverified]`; when exaggerating, push roughly 2× the first instinct — nobody dials it back later `[unverified]` (Survival Kit, folklore).
- **Remotion:** expressive: a `damping` prop defaulting inline to 10–15 on translate/scale only; business: 200. Opacity always via `interpolate` or an overdamped spring.
- **Check:** `{id: bouncing-opacity, measures: opacity/color driven by underdamped spring, threshold: any occurrence, severity: warn}`
- **Sources:** Material Motion §spatial-vs-effects (asserted); Carbon §no-bounce for productive (asserted); Fluent §strong entrance (asserted); Disney 12 §follow-through/exaggeration (asserted); Val Head §overshoot-as-energy (asserted); Survival Kit §P3 p.213 (folklore).

## Squash is not a default — impact frames on focal elements only

House decision (Williams refining Disney): correct spacing on a rigid element already reads physical, and blanket squash turns everything rubbery. Reserve deformation for impact frames of focal elements; rigid or "hard" things (a logo) bounce without squashing. When deforming: conserve area, snap back within a very few frames, and add a just-touching contact frame before the squash.

- **Numbers:** deformation gone ≤5f after impact `[unverified]`; scaleX·scaleY within 0.9–1.1 during, rest bbox drift ≤5% after `[unverified]`; contact frame at scale 1 held 1–2f `[unverified]`.
- **Remotion:** pair `scaleX: 1/s` with `scaleY: s` off one value; `transformOrigin` at the contact edge; end scale = start scale.
- **Check:** `{id: impact-recovery, measures: frames from peak deformation back to rest shape, threshold: >5 frames, severity: info}`
- **Sources:** Survival Kit §P1 golf ball, §P2 p.89–95, §P3 p.225/245–248, §P4 p.288 (asserted); Disney 12 §squash-and-stretch (asserted, demoted); Val Head §playful only (asserted).

## Interpolate depth moves in log space

The visual midpoint of a zoom sits far closer to the small/far state than the arithmetic halfway — linear scale interpolation makes the fast half of a zoom crawl and the slow half lurch. (Camera application in camera.md.)

- **Numbers:** construction method, principle only.
- **Remotion:** `Math.exp(interpolate(f, [a, b], [Math.log(s0), Math.log(s1)], {easing: Easing.bezier(...zoomEasing)}))` for any scale change bigger than a settle.
- **Sources:** Survival Kit §P1 telephone pole (asserted).

## Nothing halts dead — settle every stop

A move that ends at nonzero velocity, or an element that freezes mid-gesture, reads as broken. End with a damped settle or a designed rest pose; a clamped interpolate must not strand an element far from rest.

- **Numbers:** principle only.
- **Remotion:** prefer `spring` over a decelerating bezier for solid-object landings; audit `extrapolateRight: "clamp"` ranges whose end value is not the rest value.
- **Check:** `{id: hard-stop, measures: velocity at final keyframe of a move, threshold: non-near-zero terminal velocity outside exits, severity: warn}`
- **Sources:** Disney 12 §follow-through, "unnatural stops" (asserted); Apple HIG §stranded movers (asserted); Val Head §accelerate/decelerate (asserted); Survival Kit §P4 p.263–264 — spend visible effort on the stop (asserted). House note: hold-and-pop (hold, jump untweened 5–8f, return, jittered intervals `[unverified]`) is a legitimate deliberate stylization, not a violation — Survival Kit §P2 p.158; cushioning is a default, not a law.
