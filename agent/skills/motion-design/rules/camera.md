# Camera

Answers "when may the whole frame move, and how". Read when a scene feels static or when reaching for a push-in, pan, or parallax — the static-camera failure and its overcorrection (a lurching frame) are both decided here. House position: more camera than film's rare-by-default (our failure mode is static, not restless) — but every move passes three gates: motivated, lands on new information, settles before the cut.

## Give each scene one motivated camera move

A locked-off frame is a deliberate statement ("static, rigid world"), not a default — but a move that exists only to move is worse. Motivate both the start and the end: the move follows an entering element, concentrates on the focal subject, or reveals the next block, and it lands on a frame that differs meaningfully — never a 3% drift that ends "where the camera ended up". A bare zoom coupled to nothing looks amateur; ride it on element motion or a beat.

- **Numbers:** push-in scale 1→1.05–1.15 toward the focal element over the scene `[unverified]`; the landing frame must show something the opening frame did not.
- **Remotion:** a "camera" wrapper `AbsoluteFill` whose transform is keyed to a content event — start a few frames before the event it anticipates, never after.
- **Check:** `{id: static-scene-container, measures: scene-container transform change over a whole scene, threshold: zero on >50% of scenes, severity: info}` and `{id: unmotivated-move, measures: camera transform with no correlated content event or no composition change start-to-end, threshold: any, severity: info}`
- **Sources:** Cinematography §Motivation and Invisible Technique, §Static Frame, §Zoom (asserted); Disney 12 §staging/camera (asserted); NN/g §slow motion for uninitiated changes (asserted).

## The camera settles before the cut, with easing at both ends

Never cut while the camera is still moving: the move ends and the new frame holds a beat before the boundary. House reconciliation: the CAMERA settles ≥12f before the cut while ELEMENT motion continues — the cut itself lands mid-element-motion (continuity.md), because settling everything first is exactly what reads lifeless. Every camera move feathers in and out; launching at full speed or grinding to a halt is a defect.

- **Numbers:** camera transform ends ≥12f before the scene's last frame `[unverified]`.
- **Remotion:** camera `interpolate` output ranges close ≥12f before `durationInFrames`; `Easing.inOut(Easing.cubic)` or a high-damping spring on every wrapper transform — linear on a camera move is a bug.
- **Check:** `{id: camera-settle, measures: last camera keyframe vs scene end, threshold: <12 frames gap, severity: warn}` and `{id: camera-ease, measures: easing on camera transforms, threshold: linear or single-ended, severity: warn}`
- **Sources:** Cinematography §Motivation and Invisible Technique (asserted); house decision.

## Pans have a speed floor

A background traversing the full frame width too fast strobes and reads unreadable — film gives a crossing ~5s; our floor is looser but real. Faster is legal only as a deliberate whip-pan with blur, used as a transition.

- **Numbers:** full-width traverse ≥60f unless a whip `[unverified]` (film's blur-backed figure: ~150f @30fps).
- **Remotion:** budget wrapper `translateX` at frame-width ÷ ≥60 px/frame; a whip gets its own blur treatment and lives at a boundary.
- **Check:** `{id: pan-speed, measures: px/frame of full-frame background traverse, threshold: full width in <60 frames outside a whip transition, severity: info}`
- **Sources:** Cinematography §Types of Moves / Pan (asserted, formula-backed).

## Zoom and dolly mean different things — prefer dolly for hero moments

A zoom magnifies a frozen viewpoint: one uniform scale on everything. A dolly keeps the subject steady while the background layers shift behind it — parallax is what carries the dynamism. A countermove (camera against subject direction) doubles the background's apparent speed; budget that against the pan floor.

- **Numbers:** countermove background rate ≈2× same-direction tracking `[unverified]`.
- **Remotion:** zoom = wrapper `scale`; dolly = subject near-steady while background layers translate at their depth rates; the zoom-out-plus-dolly-in disorientation move (subject size constant, background transforming) at most once per video.
- **Sources:** Cinematography §Difference Between a Zoom and a Dolly, §Countermove, §Tracking (asserted).

## Push in to concentrate; pull back once, to end

A push-in selects and concentrates attention — stronger than cutting wide→close. The pull-back from tight to wide is an ending statement: use it to close the video (revealing full context or the lockup), never as a default outro for every scene. One choreographed move may perform several reveals in sequence, replacing that many cuts.

- **Numbers:** final pull-back scale 1→~0.85 `[unverified]`; a multi-reveal move is keyframed through up to 3 poses `[unverified]`.
- **Remotion:** slow wrapper scale-up toward the focal element mid-video; the final scene alone gets the scale-down reveal; a multi-reveal is one camera path with multiple `interpolate` ranges, each pose exposing a new element.
- **Sources:** Cinematography §Move In / Move Out, §Crane Moves, §figs 1.21–23 triple reveal (asserted).

## Re-frame as importance shifts — Hitchcock's rule as a clock

An element's size in frame equals its importance at that moment, and importance moves: when an element exits, push in subtly to take up the slack; when a new one enters, pull out to make room. This keeps a settled composition earning its place instead of going dead (see alive.md).

- **Numbers:** principle only.
- **Remotion:** on a block's exit, ease the remaining layout's scale/position to re-fill the frame; on an entry, a slight wrapper scale-down.
- **Sources:** Cinematography §Hitchcock's Rule, §Move In / Move Out (asserted).

## Rotation is semantic; a static tilt is a bug

Viewers detect off-level verticals immediately. A dutched frame says anxiety or menace and is animated into deliberately; a small nonzero rotation sitting on a scene wrapper for its whole duration is an accident, not a style.

- **Numbers:** principle only.
- **Check:** `{id: accidental-rotation, measures: static nonzero wrapper rotation persisting a whole scene, threshold: any, severity: info}`
- **Sources:** Cinematography §Dutch Head (asserted).

## Handheld noise means "someone's eyes"

Positional jitter on the camera signals immediacy, urgency, or a subjective viewpoint. A neutral observer camera stays steady — for a polished product tone, omit it entirely.

- **Numbers:** noise 1–3px at 0.5–2Hz, only on scenes that mean it `[unverified]`.
- **Remotion:** seeded noise on wrapper position, gated on the scene's declared tone; everywhere else, smooth transforms only.
- **Sources:** Cinematography §Handheld, §POV (asserted).

## The path's shape characterizes the move

A curved, wandering camera path reads devious or uneasy; a straight single-axis move reads honest and purposeful. Match the path to the tone rather than defaulting to whichever is easier.

- **Numbers:** principle only.
- **Remotion:** confident tone = one axis, one eased range; playful/uneasy = paired x/y interpolations tracing a curve.
- **Sources:** Cinematography §Plan Scene / Paths of Glory (asserted).

## Use at least two distinct framing scales across the video

Shot vocabulary exists so a video is not a run of same-scale frames: wide to orient, tight to isolate, an insert to punctuate. A single zoom level for every scene is the proscenium failure — the whole video from one audience seat.

- **Numbers:** ≥2 distinct camera scales per video `[unverified]`; insert-scale beats ~20–45f `[unverified]`.
- **Remotion:** per-scene camera wrapper scale/translate values that actually differ; tight framings keep an edge of known context visible (staging.md).
- **Check:** `{id: shot-scale-variety, measures: distinct camera scales across scenes, threshold: <2, severity: warn}`
- **Sources:** Cinematography §Building Blocks of Scenes, §Cinematic Technique, §Insert (asserted).

## Keep a stationary anchor — never move the whole picture mid-scene

When most of the frame moves at once there is nothing to measure the motion against, and it reads as the video lurching. At least one layer — background, baseline, chrome — stays near-still while others move. Whole-frame motion at full speed belongs only inside transitions.

- **Numbers:** ≥1 layer near-zero motion whenever >60% of pixels move `[unverified]` (Apple; Val Head's >60%-area vestibular threshold `[unverified]`).
- **Remotion:** exempt a background or baseline layer from the camera wrapper; mid-scene, move elements, not the frame.
- **Check:** `{id: no-stationary-anchor, measures: fraction of frame area moving simultaneously mid-scene, threshold: >60% with no still layer, severity: warn}`
- **Sources:** Apple HIG §stationary reference (asserted); Val Head §large-area motion (asserted).

## Dolly through boundaries instead of cutting, when space is the story

Moving the camera across a scene change carries the spatial relationship the cut would discard: zoom in means "inside that element", pull out means "here is the context". Use it for containment moves; peers still slide (see continuity.md).

- **Numbers:** principle only.
- **Remotion:** a whole-scene wrapper translating/scaling with an eased interpolate that spans the `TransitionSeries` boundary; the incoming scene fades from within the zoom target.
- **Sources:** UX in Motion §P12 dolly & zoom (asserted); NN/g §zoom = hierarchy (asserted); Fluent §drill (asserted).

## Zooms and pushes interpolate geometrically, not arithmetically

Depth motion is multiplicative: the visual midpoint of a zoom sits far closer to the small/far state than the arithmetic halfway, so a linearly interpolated scale lurches at the near end and crawls at the far end.

- **Numbers:** construction method, principle only; split the difference only for gentle moves.
- **Remotion:** `Math.exp(interpolate(f, [a, b], [Math.log(s0), Math.log(s1)], {easing}))` on any camera scale change beyond a drift.
- **Sources:** Survival Kit §P1 telephone pole (asserted).

## Lean movers into their travel; bank the turns

A fast-moving element tilts into its direction of travel — more speed, more lean — settling upright on arrival, and anything turning banks toward the center of the turn with the leading part initiating the change. This is the cheapest camera-like life a flat composition can get.

- **Numbers:** fast slide-ins tilt 3–8°, settling to 0 `[unverified]`.
- **Remotion:** couple `rotate`/`skewX` to the velocity of x (`k *` the derivative of the position curve); banked `rotate` toward the curvature center on curved paths.
- **Sources:** Survival Kit §P2 p.102, §P3 p.182/188 (asserted).

## Never carry stepped animation inside a camera move

Content updating at a coarser temporal rate than the pan strobes against it. While a container pans or zooms, every child animates continuously per frame; deliberate stepped styles pause during camera moves.

- **Numbers:** a 2:1 sampling mismatch already strobes `[unverified]`.
- **Remotion:** no `Math.floor(frame / 2)` quantization or hold-and-pop choreography active while a wrapper `translateX`/`scale` is in flight.
- **Check:** `{id: pan-strobe, measures: stepped/quantized child animation during an active camera translation, threshold: any, severity: warn}`
- **Sources:** Survival Kit §P1 stroboscopic jitter (asserted).

## Layer parallax by depth, and treat it as a garnish

During a pan, nearer/primary layers move faster than background layers — depth is felt before it is read. It is a high-cost effect: one parallax scene is texture, parallax everywhere is noise.

- **Numbers:** layer rates ≈ 1.0 / 0.5 / 0.2 of the camera move for fore/mid/background `[unverified]` (UX in Motion illustrative).
- **Remotion:** `x = camX * factor` per layer inside the camera wrapper; distant layers also read farther when slightly blurred and desaturated.
- **Check:** `{id: parallax-everywhere, measures: scenes using multi-rate layer panning, threshold: >50% of scenes, severity: info}`
- **Sources:** UX in Motion §P10 parallax (asserted); Val Head §parallax sparingly (asserted); Cinematography §Three-Dimensional Field, §Atmospheric Perspective, §Tracking (asserted).

## Keep sustained motion out of the frame edges

Peripheral movement drags the eye off the subject and reads as instability. Ambient layers near the edges move slower and dimmer, with brightness matched to their surroundings; primary motion stays inside the title-safe area.

- **Numbers:** principle only.
- **Remotion:** clamp edge-layer amplitude and opacity below the background's level; no accent colors on edge movers.
- **Sources:** Apple HIG §peripheral motion (asserted); NN/g §peripheral attention capture (measured).

## Hide reversals and hard repositions inside a fade

A camera path that must reverse direction, or an element that must teleport, does it under a brief darkening or fade — the discontinuity lives inside the transition, never in the open.

- **Numbers:** principle only.
- **Remotion:** direction reversals under a `fade()` transition; in-scene relocation as fade-out at the old position, fade-in at the new — never a single-frame coordinate jump. Exception: the pop idiom for impacts and comic exits (continuity.md) is a deliberate, scoped discontinuity, not a violation.
- **Sources:** Apple HIG §world rotation, §relocation (asserted).
