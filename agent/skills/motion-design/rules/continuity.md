# Continuity

Answers "how one scene becomes the next, and what the whole video's rhythm is". Read before writing a `TransitionSeries` or butting two `Series` scenes together — the no-motion-across-boundaries failure is decided here.

## Cut on action, and carry the motion across — matched direction, matched speed

Place every boundary while something is visibly mid-movement, never on a settled pose — motion masks the cut and forgives small mismatches — and let that motion continue on the other side with no gap, same direction, similar speed, even at a new zoom. A cut with zero cross-boundary motion is the slide-deck tell. House reconciliation: the camera settles ≥12f before the boundary (camera.md); element motion continues and the cut lands mid-element-motion. Bounded exception (house decision): a montage run — shots linked only by theme, for a short burst or passage of time — legally abandons continuity, never as the video's spine.

- **Numbers:** ≥1 element with nonzero velocity within ±5f of every cut; frame-diff in the 3 frames each side must be nonzero — `[unverified]`.
- **Remotion:** time boundaries to land mid-`interpolate`, not after the spring settles; the incoming lead element starts mid-motion with a slope matching where the outgoing scene left it, or an element persists outside the `Series`.
- **Check:** `{id: cut-on-motion, measures: frame-diff in the 3 frames each side of a cut, threshold: ≈0 both sides, severity: warn}` and `{id: boundary-dead, measures: motion energy and direction/speed match in a ±5-frame window around each cut, threshold: >50% of boundaries with none, severity: warn}`
- **Sources:** Cinematography §Cutting on action, §Continuity of movement, §Match the speed, §Montage; Carbon §continuity checklist; Fluent §show where it went; UX in Motion §continuity; Apple HIG §trackable transitions; Rauno Freiberg §momentum; Material Motion §shared axis (all asserted); house decisions.

## Exit one edge, enter from the opposite one

An element that leaves frame left enters the next scene from frame right — the cut is an imaginary pan; re-entering from the side it left by flips the world. Only a vertical exit is directionally neutral. The elliptical cut rides on this: exit, then pick the element up entering later — the dead travel between vanishes invisibly.

- **Numbers:** principle only.
- **Remotion:** scene N animates x past −120%, scene N+1 starts it at +120% moving the same direction; `translateY` exits release the constraint.
- **Check:** `{id: exit-enter-direction, measures: exit edge of scene N vs entry edge of N+1 for one element, threshold: same horizontal edge, severity: warn}`
- **Sources:** Cinematography §Entering and exiting frame, §Neutral axis, §Elliptical cut (asserted).

## Hard cuts change the frame by at least 20%

Two near-identical consecutive framings read as a glitch, not a cut — change angle, size, or position substantially; same subject at the same size wants a viewpoint rotation ≥30°. Scoped (house decision): the floor applies to hard cuts only; animated shared-element and container transforms are deliberately near-continuous and exempt.

- **Numbers:** ≥20% composition change per hard cut; ≥30° rotation when scale is unchanged; container scale change ≥1.2× counts — all `[unverified]`.
- **Remotion:** adjacent scenes on the same content differ in container scale, position, or crop — never a near-identical re-layout.
- **Check:** `{id: cut-min-change, measures: frame-diff between last frame of N and first of N+1 on hard cuts, threshold: below floor, severity: warn}`
- **Sources:** Cinematography §The 20% rule, §The 30° rule (asserted); house decision on scope.

## The cut vocabulary: match, zero, look

Three ways a boundary carries meaning. Match cut: shape, screen size, and frame position all three align — shape alone is not enough. Zero cut: a full-frame occluder covers the boundary for 2–3 frames and the scenes swap under it. Look cut: scene N ends with an element orienting toward an edge and scene N+1 reveals what it "looked at" there — the viewer binds the two (Kuleshov, measured) provided the direction matches.

- **Numbers:** occluder covers the frame 2–3f; look angle must plausibly match the object's position — `[unverified]`.
- **Remotion:** match cut — outgoing element's final rect equals the incoming element's initial rect, content swaps at the cut; zero cut — a full-bleed shape sweeps the boundary with the swap on its covered frames.
- **Sources:** Cinematography §Match cut, §Zero cut, §POV cut (Kuleshov measured; rest asserted).

## Scenes roll in and roll out

Never start a scene exactly at the start of its movement or end it at the finish: the carried element is already mid-arrival at frame 0, exits complete only at the last frame — a frame 0 identical to frame 5 is dead air. New events inside the scene still wait a beat on the settled frame, so the viewer has somewhere to stand.

- **Numbers:** entries already underway at frame 0; first 8–12f may carry a settling tail; lead-in before the first new major motion ~15–30f — all `[unverified]`.
- **Remotion:** entry ranges start at a negative conceptual offset (element partway through arrival at the cut); the first fresh entrance waits ~15f.
- **Check:** `{id: dead-first-frame, measures: frame 0 of a scene vs frame 5, threshold: identical, severity: warn}` and `{id: action-lead-in, measures: frames before first major new motion in a scene, threshold: <15, severity: info}`
- **Sources:** Cinematography §Overlap all movement, §Rock in, §Entering and Exiting Frame beat (asserted).

## Cut faster toward the climax

As the video builds to its payoff, shot durations shrink — the accelerating rhythm is what tells the viewer something is converging. A section building to a climax must not have scene durations that grow.

- **Numbers:** e.g. 90→60→40→25f toward the payoff `[unverified]`.
- **Remotion:** in a `Series` building to the key claim, each scene's `durationInFrames` shorter than the last.
- **Check:** `{id: accelerating-rhythm, measures: scene durations during a build-to-climax section, threshold: non-decreasing, severity: info}`
- **Sources:** Cinematography §Converging parallel cutting (asserted); Survival Kit §P3 p.209–211 — steps shorten as interest rises (asserted).

## Open by establishing or by slow disclosure — the two legitimate openings

Either the first scene is the orienting wide, or the video opens on a telling detail and pulls back to reveal context (slow disclosure). Pick one; in medias res is a bounded, deliberate exception (house decision). Withhold the most important subject until the strongest moment — show its effects first. Spend the strongest craft on the open and the close: those two scenes carry the judgment of the piece.

- **Numbers:** slow-disclosure open: start scale 2–3× on one detail, easing down over the scene or over 30–60f `[unverified]`.
- **Remotion:** first scene's camera scale ≤ later scenes' (establishing) or a keyframed scale-down (disclosure); the establishing view is never a dead stop — fold it into a move following an element in.
- **Sources:** Cinematography §Introductions, §Slow disclosure, §The main characters (asserted); Survival Kit §P4 p.334 — strongest craft at open and close (asserted).

## Hook up consecutive scenes exactly

For a shared or persistent element, the outgoing pose of scene A must match the incoming pose of scene B — a transform that jumps across a cut reads as a splice error. A recurring element keeps its exact placement across alternating scenes or appears in only one of them, and after a cutaway of t seconds a resumed action has advanced by a plausible t.

- **Numbers:** principle only.
- **Remotion:** end scene A's interpolations at the values scene B starts with, or render the element outside the `Series` so one continuous interpolate spans the boundary; recurring elements read shared position constants.
- **Check:** `{id: boundary-continuity, measures: a shared element's transform delta across a cut with no transition, threshold: any jump, severity: warn}`
- **Sources:** Survival Kit §P4 p.335 (asserted); Cinematography §Continuity of position, §Continuity of time (asserted).

## Impacts use the pop idiom: skip the contact, show the result

Never show the frame of contact — cut to the target already displaced, then ease slowly back toward rest, sound one frame after contact on the recoil. A scoped, legitimate exception to smoothness (house decision): impacts and comic exits (wind-up, then the element gone with zero travel frames), nothing else. For the fastest events: nothing, then the result, a brief residual vibration the only trace — never speed lines or blur streaks.

- **Numbers:** one-frame gap at contact, sound +1f; receiver kick 2–4% decaying over ~4–5f; residual oscillation 3–5f; a fast travel-and-hit ≈6 single-frame positions — all `[unverified]`.
- **Remotion:** step change via adjacent input stops `[f, f+1]`, then a long `Easing.out` back; audio/flash one frame after the displaced frame.
- **Sources:** Survival Kit §P2 p.93–98, §P3 p.242, §P4 p.275–279, 293–295 (asserted).

## Peers share an axis; unrelated content fades through

Peer scenes slide along one shared axis in the same direction while crossfading. Unrelated content instead empties the frame first — outgoing fade completes in the first third, then the new content fades in while growing slightly. Never an even 50/50 crossfade of unrelated pictures.

- **Numbers:** shared axis ~18f total, both layers translating 60–120px at 1080p (30dp UI); fade-through ~18f: exit in first ~6f, entry over remaining ~12f with scale 0.92→1 (Material 300/100/200ms) — all `[unverified]`.
- **Remotion:** `TransitionSeries.Transition` combining `slide()` + `fade()` for peers; a custom presentation for fade-through — a mid-transition frame must never blend both scenes at full strength.
- **Check:** `{id: even-crossfade, measures: mid-transition frame blending both scenes near 50/50, threshold: any between unrelated scenes, severity: info}`
- **Sources:** Material Motion §shared-axis, §fade-through (asserted); Fluent §page transitions (asserted).

## Direction encodes the story, and the line is never crossed silently

One direction means forward for the whole video; going back reverses it exactly. Zoom means containment — in for detail, out for overview; lateral slide means sequence. This is film's action axis (the 180° line) on layout: elements placed left and right stay on their sides across every scene reusing that world, and a travelling element keeps its screen direction until a scene shows the turn. The line can move — a head-on beat, a camera move within a scene, or an unrelated interstitial each reset it — but crossing it is done boldly with an anchor in shot, never by a timid few degrees.

- **Numbers:** backward/return transition ~30–50% shorter than forward `[unverified]` (Fluent).
- **Remotion:** fix one `slide()` direction for forward cuts and one `DIRECTION_TO_GOAL` constant all travel multiplies; a recap/return scene reverses it; scale-through transitions for detail↔overview moves.
- **Check:** `{id: direction-inconsistent, measures: forward-cut slide directions and a shared element's motion-vector sign across cuts, threshold: mixed or flipped without narrative cause, severity: info}`
- **Sources:** Cinematography §180° rule, §Screen direction, §Reverse, §Exceptions; Material Motion §forward-and-backward; Fluent §directionality; NN/g §spatial metaphors; Rauno Freiberg §direction semantics; Apple HIG §exit mirrors entry (all asserted).

## Open detail by transforming the container, not cutting to it

When a small element becomes a full scene, morph its container — position, size, radius — into the new surface, and swap the inner content inside asymmetric fade windows.

- **Numbers:** expand ~18f, collapse ~15f; incoming content fades during 0–25% of the transform, outgoing during 60–90% on the return `[unverified]` (Material's published constants, measured).
- **Remotion:** interpolate one container's x/y/width/height/borderRadius between the two layouts; content fades ride fractions of the transform progress, not the whole.
- **Sources:** Material Motion §container-transform (measured constants); UX in Motion §P4 transformation (asserted); Rauno Freiberg §fluid morphing (asserted); Fluent §connected animation (asserted).

## Keep transitions short relative to scenes

A transition is connective tissue; it must never stall the story or outweigh the content it joins, and it should carry something (an element, the camera) — motion for its own sake between scenes is filler.

- **Numbers:** transition 12–20f against scene bodies of 90f+; decisive changes land at one crisp moment, not a long dissolve — `[unverified]`.
- **Remotion:** `TransitionSeries.Transition` durations from the short band; the scene bodies own the time.
- **Check:** `{id: transition-scene-ratio, measures: transition frames ÷ adjacent scene frames, threshold: >0.3, severity: info}`
- **Sources:** UX in Motion §non-realtime brevity (asserted); Rauno Freiberg §commit-at-end (asserted); Val Head §per-effect durations (asserted).

## Vary the entrance vocabulary across scenes

The same entrance gimmick scene after scene reads as a template by the third repeat. Rotate dictionary behaviours while keeping one easing family and one spatial model, so variety never becomes inconsistency.

- **Numbers:** same entry behaviour in >3 consecutive scenes is the flag `[unverified]` (NN/g, measured).
- **Remotion:** different entry-role dictionary components per scene; identical meanings still get identical motion (a lower-third always enters the same way).
- **Check:** `{id: monotone-entries, measures: distinct entry behaviours across consecutive scenes, threshold: one behaviour in >3 consecutive scenes, severity: info}`
- **Sources:** NN/g §repetition decay (measured); Carbon §semantic consistency; Fluent §consistent invoke/dismiss; Val Head §one treatment per category; Survival Kit §P2 p.163 — one changed parameter makes a stock motion new; never ship a default-parameter preset twice (all asserted).

## One motion system per video

All scenes draw from one easing family, one duration ladder, one register. Expressive, showy motion is rationed to the significant beats — if everything moves with equal weight, nothing reads as important.

- **Numbers:** expressive-register animations ≤~20% of all animations `[unverified]` (Carbon); ≤3–4 distinct easing configs per video `[unverified]` (Val Head).
- **Remotion:** one shared motion-constants module imported by every scene; springs/overshoot/blur reserved for 1–2 emphasis beats per scene.
- **Check:** `{id: expressive-ratio, measures: share of expressive-register animations, threshold: >20%, severity: info}`
- **Sources:** Carbon §two registers; Emil Kowalski §rationing; Fluent §consistent; Val Head §token set; Apple HIG §weight of delivery (all asserted).
