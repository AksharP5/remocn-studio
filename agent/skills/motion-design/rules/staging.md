# Staging

Answers "what enters when, from where, and in what order" inside one scene. Read before laying out a scene's `Sequence` offsets — the everything-enters-at-once failure is decided here.

## Stagger sibling entrances; never start a group on the same frame

Simultaneous entry fuses separate things into one block and reads as a slide build. The offset itself tells the viewer the elements are distinct — before any content is read.

- **Numbers:** ~3f between siblings, range 2.5–5f `[unverified]` (Survival Kit, animation-native — preferred; Disney drag 2–6f @24 ≈ 3–8f @30, Carbon 20ms/item ≈ 1–2f rescaled, Rauno 2–6f, all `[unverified]`); jitter ±1–2f keeps it from reading mechanical `[unverified]`. Nothing starts or stops together either — stagger the ends too.
- **Remotion:** per-child `spring({frame: frame - i * 3})` or `Sequence from={i * stagger}`; never one transform on the parent container doing all the work.
- **Check:** `{id: simultaneous-entry, measures: sibling elements sharing an identical entrance start frame, threshold: >2, severity: warn}`
- **Sources:** Survival Kit §P2 p.163, §P3 p.226–230, §P4 p.265/289 — "only robots" start together (asserted); Carbon §sequence-and-stagger (asserted); UX in Motion §P2 offset-delay (asserted); Disney 12 §overlapping action (asserted); Rauno Freiberg §choreography (asserted); NN/g §competing animations (asserted).

## Cap the whole cascade; shrink per-item delay as the count grows

A stagger is a beat, not a queue. As the list grows, the per-item gap shrinks so the group finishes inside one bounded window.

- **Numbers:** total group spread ≤30f `[unverified]` (Carbon: cascade ≤500ms UI, per-item delay shrinks with count `[unverified]`).
- **Remotion:** `delay = Math.min(4, 30 / count) * index` frames.
- **Check:** `{id: stagger-total-cap, measures: spread from first to last entrance of one group, threshold: >30 frames, severity: info}`
- **Sources:** Carbon §sequence-and-stagger (asserted).

## Group entrances semantically, order them by importance

Temporal grouping must match logical grouping: one card is one unit, separate items are separate beats. The lead element moves first; content precedes decoration; the showy piece (a chart, a flourish) comes last, after the informative content has settled.

- **Numbers:** build order: frame/chrome → headings/copy → data → key claim/CTA → animated showpiece `[unverified]` (Carbon's 5-step order); decoration lags content by 3–8f `[unverified]`.
- **Remotion:** `Sequence` offsets follow that order along the reading eye-path — left before right, top before bottom, and the element meant to be seen first animates first and carries the most contrast; the scene's key claim is the last entrance before the hold, and nothing connective moves after it lands.
- **Sources:** Carbon §choreography build order + continuity don't (asserted); Cinematography §Movement in the Visual Field — the Western eye enters left, reads left→right, top→bottom (asserted); UX in Motion §P2 semantic grouping (asserted); Emil Kowalski §functional-vs-decorative (asserted); Disney 12 §staging (asserted).

## One focal arrival at a time

Two attention-seeking motions running at once cancel each other. Per beat, one element owns the largest motion and contrast; secondaries stay subordinate in amplitude — and get cut if they compete.

- **Numbers:** principle only.
- **Remotion:** one high-amplitude mover per 10-frame window; background layers hold amplitude low while a focal element animates; separate a gesture and its message in time (offset a pointer from its label ≥8f `[unverified]`), and place state changes on a hold, never inside a broad fast move.
- **Sources:** NN/g §competing animations, peripheral attention (measured); Disney 12 §staging, secondary action (asserted); Apple HIG §attention cues (asserted); Survival Kit §P4 p.312–325 — one main idea per scene, move only the smallest part that carries the meaning; §P4 p.320–322 (asserted).

## Give every entrance a motivated origin — nothing pops into a settled frame

An element materializing from screen-center with a bare fade has no story. It enters from where it logically comes from — its cause, its parent, the frame edge it belongs to — and its transform anchors there, not the geometric center. Anything mounting after a scene's first frame needs a visible arrival or another element "calling" for it; the one exception is deliberate shock, which must be set up beforehand and land on a beat.

- **Numbers:** any mid-scene appearance carries an opacity/transform ramp ≥5f `[unverified]`.
- **Remotion:** set `transformOrigin` toward the source; pair opacity with a translate or scale from that origin; entry direction stays consistent per element class for the whole video.
- **Check:** `{id: orphan-entry, measures: entries by opacity alone with no transform, threshold: any focal element, severity: warn}` and `{id: unmotivated-pop-in, measures: element appearing mid-scene with no ramp ≥5 frames, threshold: any outside a set-up shock beat, severity: warn}`
- **Sources:** UX in Motion §P8 cloning (asserted); Cinematography §Medium Shot + exceptions (asserted); Emil Kowalski §transform-origin (asserted); Rauno Freiberg §spatial consistency (asserted); Fluent §established axes (asserted).

## Tight framings keep a piece of the context

When a scene zooms into a detail, keep an edge of a previously seen element visible so the detail stays anchored to its world — a crop that isolates the subject completely floats free of the video around it.

- **Numbers:** principle only.
- **Remotion:** in a pushed-in scene, let a sliver of the wider layout (a border, a neighbor's edge, the baseline) remain in frame.
- **Sources:** Cinematography §"Get a Piece of It" (asserted).

## Scale in from near-final size, never from zero

Growing from nothing is the commonest generated-video cliché. Panels start around 0.8, small elements around 0.9–0.95; a plain fade-in still grows slightly.

- **Numbers:** panels 0.8→1, accents 0.9–0.96→1, fade-in growth 0.85–0.92→1 `[unverified]` (Kowalski example 0.93; Material fade 0.92; Rauno 0.8 floor for panels `[unverified]`).
- **Remotion:** `interpolate(p, [0, 1], [0.9, 1])`; never an output range starting at 0 for scale.
- **Check:** `{id: scale-from-zero, measures: initial value of scale-in output ranges, threshold: <0.8 warn, <0.3 severe, severity: warn}`
- **Sources:** Emil Kowalski §scale (asserted); Rauno Freiberg §proportional scaling (asserted); Material Motion §fade pattern (asserted).

## Give the hero a wind-up; skip it for pushed objects

A self-initiated hero entrance earns a small counter-move before the main move — a dip before a rise — slower and smaller than the action it precedes: slow wind-up, fast release. Elements moved by a transition or camera enter directly. For a snap with no visible wind-up, an invisible 2–4f counter-offset is too fast to read but still felt.

- **Numbers:** anticipation offset ≈10–20% of main travel, 3–6f `[unverified]` (School of Motion 3–5f, Survival Kit 3–6f — Survival Kit preferred); invisible anticipation 2–4f `[unverified]`.
- **Remotion:** prepend an opposite-signed segment: `interpolate(f, [0, 5, 20], [0, -12, 100])` — hero elements only.
- **Check:** `{id: entry-has-anticipation, measures: pre-move opposite the main direction on hero entries ≥15f, threshold: absent, severity: info}`
- **Sources:** Disney 12 / School of Motion §anticipation (asserted); Survival Kit §P3 p.212–214, §P4 p.272–274, 282–283 (asserted).

## Structure an emphatic moment as a take: anticipation, accent, settle

The emphatic beat has three parts — dip slow, hit fast, cushion slow — and a small sharp move from stillness reads louder than a big flailing one: freeze, snap a short distance, cushion back into the hold.

- **Numbers:** standard take ≈15f total `[unverified]`; sharp accent: hit in ≈4f, whole take ≈10f, minimal travel (frame-chart measured, Survival Kit).
- **Remotion:** three chained interpolate segments, or a dip followed by an under-damped `spring`; a single monotonic curve is not a take.
- **Sources:** Survival Kit §P4 p.285–286 (asserted), p.292 (measured).

## Layer the motion: primary pass first, secondaries follow

Animate the focal element as a testable pass on its own, then add secondaries, then trailing parts — so each layer follows the one before it instead of moving in sync. State the point with big shapes; detail is finishing work.

- **Numbers:** principle only.
- **Remotion:** block the container/hero transforms before per-child effects; secondaries get delayed springs offset from the layer they follow; subsidiary loops run at half or a quarter of the primary tempo, never matching it (2:1 or 4:1 period ratios `[unverified]`).
- **Sources:** Survival Kit §P1 three-ways-to-animate, §P2 p.155, §P3 p.185–186, 191, 252–255 (asserted).

## Break symmetry in time — no twinning, no rigid blocks

Two elements doing the identical thing at the identical time read dead, and a multi-part element animating as one rigid transform reads as a cardboard cutout sliding. House refinement (Williams over Disney folklore): symmetry itself is legitimate — it reads as authority and order — but take the curse off it by delaying one side of the pair. Composites always need at least one delayed or overlapping child.

- **Numbers:** delay one side of a mirrored pair 5–8f `[unverified]` (Survival Kit); per-part delay 3–6f, amplitude variance ±10% `[unverified]` (Disney 12); ≥1 delayed child per multi-part element `[unverified]`.
- **Remotion:** mirrored elements share one spring with a 5–7f delay on one side; drive heading/subheading/CTA off one spring with per-part frame offsets, never only the parent container.
- **Check:** `{id: rigid-group-entry, measures: groups of ≥4 elements with frame-identical transforms through an entry, threshold: any, severity: info}`
- **Sources:** Survival Kit §P4 p.323–324, §P2 p.158 (asserted); Disney 12 §twinning, overlapping action (asserted); Rauno Freiberg §never perfectly uniform (asserted).

## Travel on the layout's axes, one axis at a time

Movement follows the axis the layout implies; straight diagonals and paths that cross other entering content read as chaos. When both axes must change, offset the two moves so the path turns a corner or arcs.

- **Numbers:** overlap the X and Y windows ~30–50% `[unverified]` (Carbon).
- **Remotion:** two interpolates with offset ranges — X over `[t, t+n]`, Y over `[t+0.6n, t+1.6n]` — never one range driving both; a slight perpendicular sine gives an arc, flatter as speed rises. Long moves take arcs or shallow S-paths; dead-straight paths are reserved for short, powerful moves.
- **Check:** `{id: diagonal-travel, measures: x and y driven over the identical range with both deltas large, threshold: any, severity: info}`
- **Sources:** Carbon §paths (asserted); Fluent §established axes, collision ban (asserted); Disney 12 §arcs (asserted); Survival Kit §P1 revolving ball, §P2 p.90–91, §P3 p.182 (asserted).
