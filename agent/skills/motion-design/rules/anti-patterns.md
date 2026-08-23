# Anti-patterns

The consolidated blocklist. Scan it after drafting a scene; anything here is a known cliché or a named failure, not a style choice. Each entry: what it is, one line of why, who names it.

## Linear motion between rest states
Constant velocity reads as broken machinery; it is the strongest slideshow tell. — Material, Carbon, Apple, Fluent, Disney 12, UX in Motion, NN/g, Val Head, Survival Kit (even inbetweens; the mechanical midpoint).

## Ease-in on an entrance
Drags at the start, lands abruptly — the exact inverse of a responsive arrival. — Emil Kowalski, Val Head, Fluent.

## Everything entering at once
Simultaneous entry fuses separate things into one slide build and gives the eye nowhere to go; all parts starting or stopping on one frame is what "only robots do". — Carbon, UX in Motion, Disney 12, Rauno Freiberg, NN/g, Survival Kit.

## Scaling in from zero
Grow-from-nothing is the commonest generated entrance cliché; nothing real arrives from a point. — Emil Kowalski, Rauno Freiberg.

## Bare opacity fade for a new object
An appearance with no origin breaks the causal chain; every entry needs a motivated direction or scale. — UX in Motion, Emil Kowalski (default transform-origin).

## Exits as slow and elaborate as entries
Symmetric in/out pairs deaden the rhythm; leaving must be cheap. — Material, Fluent, NN/g.

## Sliding off screen at full opacity
An exit without a fade looks like content falling off the stage. — Fluent.

## Even 50/50 crossfade of unrelated content
Two full-strength pictures blended is mush; empty the frame first, then bring the new in. — Material (fade-through exists to forbid it).

## Hard cut with zero cross-boundary motion
A boundary nothing crosses is a slide advance, not a scene change. — Carbon, Fluent, UX in Motion, Apple, Material.

## Backward navigation that doesn't reverse the forward direction
Direction is a spatial promise; breaking it destroys the viewer's map. — Material, Fluent, Rauno Freiberg.

## Element frozen dead after entry
A pixel-frozen focal element makes the frame a slide; the moving hold exists for this — and a landing followed by nothing (no weight transfer, no settle) is the same failure at arrival. — Disney 12, NN/g (attention ceiling), Survival Kit, house position.

## Unnatural full stop
Halting with no settle, or stranding an element mid-gesture, reads as a glitch. — Disney 12, Apple.

## Bouncing opacity or color
Effects channels have no mass; only spatial properties may overshoot. — Material.

## Overshoot and squash on text glyphs, or squash as a default anywhere
Elastic settle belongs to panels and objects; bounced type reads childish and breaks baselines — and blanket squash-and-stretch turns everything rubbery. Deformation is for impact frames of focal elements only. — Fluent (reconciled), Val Head, Survival Kit (demoting Disney's #1), house decision.

## Twinning
Mirrored, simultaneous, identical motion on paired elements reads dead; symmetry itself is fine once one side is delayed 5–8f. — Disney 12, Rauno Freiberg (perfectly synchronized = mechanical), Survival Kit (the delayed-side cure).

## Straight diagonal travel and crossing paths
Movement off the layout's axes, or entering paths colliding with exiting ones, reads as chaos. — Carbon, Fluent.

## Same entrance gimmick every scene
By the third repeat a flourish is a template; ration ceremony and vary the vocabulary — formula repetition is the "comic rabbits" epitaph. — NN/g (measured decay), Rauno Freiberg, Apple (motion tax), Survival Kit.

## Idle decorative loops
Spinners, pulsing dots, and ambient loops with no job promise change and deliver none. — NN/g, Rauno Freiberg, Apple (indeterminate loops).

## Slow full-opacity oscillation (~0.2 Hz)
The 4–6s breathing sway sits in a measured discomfort band and reads as a screensaver. — Apple.

## Whole frame moving at once mid-scene
With no stationary anchor the video lurches; full-frame motion belongs inside transitions. — Apple, Val Head.

## Peripheral/edge motion at full strength
Edge movement hijacks attention away from the subject. — Apple, NN/g (measured).

## Numbers popping in as static text
A metric that appears fully formed is dead; the count-up is its arrival. — UX in Motion.

## Competing simultaneous attention-seekers
Two loud motions cancel each other; one focal arrival per beat. — NN/g, Disney 12 (competing secondary action).

## Decorative motion with no job
Motion noticed for its own sake is noise; if it says nothing, cut it. — Apple, Carbon, Emil Kowalski, NN/g.

## Guide element stealing the final beat
Connective tissue still moving after the content lands parks the eye on the wrong thing. — Carbon.

## One duration for everything
Uniform timing regardless of size and travel is the uniform-rhythm failure itself; consecutive same-kind beats identical in length are its beat-level form. — Material, Carbon, Emil Kowalski, Val Head (ad-hoc values), Survival Kit (measured 20–60% real-beat variance).

## Imperceptibly fast meaningful changes
An animation under ~4 frames is a pop that reads as a glitch. — Val Head (measured perception floor), NN/g.

## Animating layout properties
Height/padding/margin tweens where clip-path or transform would do; costly and shift-prone. — Emil Kowalski.

## Casual parallax
Multi-rate layers as a default scene treatment is noise; parallax is a garnish. — Val Head, UX in Motion (reconciled).

## Flashing urgency motion
Strobing countdowns and attention-hijacking flicker are a dark pattern. — NN/g.

## Wobble
Shapes and volumes that vary frame to frame on one element (layout jitter, rounding, reflow bleeding into an animation) destroy the motion entirely. — Survival Kit.

## Cardboard-cutout motion
A multi-part element moving as one rigid transform, with no overlap, stretch, or delayed child, reads as a flat picture sliding around. — Survival Kit, Disney 12 (rigid blocks).

## King Kong effect
Everything on screen moving by the same amount — and its twin, everything thrashing at once. The target is a stable image with local flexibility. — Survival Kit.

## Hitting a pudding
Showing the actual contact frame of an impact instead of cutting to the displaced result robs the hit of all force. — Survival Kit.

## Speed lines and blur streaks
Decorative streaks are a crutch for weak motion; the fast-event idiom is nothing, then the result, then a brief residual vibration. — Survival Kit.

## Mushy accents
Easing into an accent softens the one moment that must hit; snap in, cushion out — and don't machine-gun every beat, hit only the important ones. — Survival Kit.

## The in-place seamless cycle
A loop the eye catches repeating — perfect period, mirror-identical halves, treadmilling around a fixed point — reads mechanical. — Survival Kit.

## The polystyrene rock
A heavy element handled with no preparation, no low-and-slow movement, weighs nothing. Mass is announced by anticipation and paid for in frames. — Survival Kit.

## The 2-frames-ahead tyranny
One fixed sync offset applied mechanically to every audio beat; lead accents by 1–3 frames chosen per hit, never a constant. — Survival Kit.

## Unmotivated camera move or zoom
A move that exists only to move pulls the viewer out; a bare zoom coupled to nothing looks amateur — every move is motivated at both ends and lands on new information. — Cinematography.

## Cutting while the camera is still moving
No settle beat before the boundary reads as the editor missing the frame; the camera parks ≥12f before the cut (elements keep moving). — Cinematography.

## Near-identical consecutive shots
A hard cut changing the frame by less than ~20% reads as the video glitching, not as a cut. — Cinematography (the 20% rule).

## Accidental jump cut
A small unexplained skip in an element's position or time across a cut is a continuity failure; deliberate discontinuity is rhythmic and repeated. — Cinematography.

## Timid line-cross
Flipping the left/right world by a few unmotivated degrees reads as an error; a legal line-cross is bold and keeps a known anchor in shot. — Cinematography.

## Proscenium
The whole video from one static, audience-seat framing — a filmed play; use at least two framing scales and break scenes into shots. — Cinematography.

## Element popping between alternating scenes
A recurring element at different positions in alternating scenes snaps back and forth; share its placement constants or keep it in one of them. — Cinematography.

## Calendar pages and spinning clocks
Quaint time-passage devices; elapsed time is a background state change across a cut (progress fuller, sky darker), wordless. — Cinematography.

## "Film student" mood inserts
Arch, heavy-handed atmosphere shots used for mood alone turn obvious fast; at most one content-free interlude per video. — Cinematography.

## Accidental dutch tilt
A static nonzero rotation on a scene wrapper reads as a bug — viewers spot off-level verticals immediately; a dutched frame is animated in and means anxiety. — Cinematography.
