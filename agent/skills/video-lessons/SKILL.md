---
name: video-lessons
description: >
  Remotion rules that beat first instinct. Read before writing any scene, transition,
  text entrance, font load, shader or render command, and when something looks wrong —
  text jitter, an empty boundary, a blank or static render, a font fallback, a slideshow
  of fades, motion that comes to rest.
---

# Video production lessons

**Symptom → decision.** Remotion 4.x, 30fps, headless Chrome, `--scale=2`.

---

## 1. House grammar (hard guardrails)

- **Numbers are plain** — `130`, the tagline's "+" stripped.
- **Type keeps its natural tracking and case** (a brand wordmark's own tracking excepted); no badges, no install pills.
- **An element arrives once and locks — nothing pulses.** A spinner is a glyph ramp (`·✢✳✶✺`), not a scale pulse; `animate-pulse` gets `animate-none`.
- **Boundaries are wipes, slides and settles (§6)** — no swirl, no ripple.
- **Physics, not bezier fakes**: `spring()` for element transforms, ease-in-out for large grow/travel moves, `overshootClamping: true`. ONE deliberate overshoot per film at most, normally §7's per-word build.
- **Text travels on X** (§2). **Branded marks keep their colors** (§9).
- **Transform and opacity each own a curve and a length.** Arrive and lock.
- **One accent, spent sparingly.** Cohesion is a shared backdrop, identical framing and consistent captions, not a color wash.

## 2. Text moves on X

- **Text moves on X or stays put** (`remocn/short-slide-right`) — baselines snap to whole device pixels while x-advances stay sub-pixel, so the curve that ticks on Y is smooth on X.
- **One `translateX` on the paragraph, stagger in per-word opacity** — per-word X travel slides words through each other, and per-character promoted layers shimmer even at rest (sixteen: 0.40 jerk vs 0.00 plain).
- **Transform the wrapper, inner spans plain** — a transformed span becomes `display: inline-block`, and a two-tone paragraph wraps one half onto its own line.
- **Purging Y is a grep for `translateY` in every text-bearing container** (console panels, terminal wells, captions, bylines); translateY is for non-text geometry, and the camera stays off type.
- **Text in a continuously scaling wrapper trembles** (~1px row snap + per-glyph sub-pixel wave): `willChange: "transform"` on the wrapper **and** `--scale=2`. `rotate(0.05deg)` cures the row snap alone and harms beside will-change — one or the other.
- **will-change helps only content at rest.** An unavoidable translateY entrance lands its travel in ~60% of the frames (opacity and blur keep the full curve), mirrored for ease-in exits; translating text moves faster than ~0.5px/frame or not at all.
- **Wrappers sit at final size; a reveal is transform + clip-path, re-centered by a compensating translateX** — an animated `width` drags the largest type across fractional pixels every frame.
- **A centered line being "written" reserves its full width from frame 0** (per-glyph opacity toggle), or it re-centers mid-write.
- **Measure jitter**: ffmpeg `format=gray` → luma threshold → `tblend=difference` ×2 → `signalstats`, ranked by spike (`tmix` with negative weights clamps to zero; SAD trackers fail on fast motion).

## 3. Fonts: the silent fallback

- **Fonts load inside the composition, behind a gate** — `@remotion/fonts` `loadFont()` at module scope does nothing (its delayRender fires before any composition mounts) and the render proceeds in the fallback face with no error. `useEffect` + `delayRender`, gate the tree on a `loaded` flag, double-`requestAnimationFrame` before `continueRender` or stills race the screenshot; one-frame stills hold the same way (`waitUntilDone()` / `document.fonts`).
- **Judge fonts on full-scale stills** — at `--scale=0.5` a pixel font's stepped glyphs look like a Courier fallback.
- **Canvas-measure text** (0.6em is a guess), recomputed after `document.fonts.ready` behind the gate or fallback metrics get memoized. Canvas `textBaseline: "middle"` sits above a flex-centered span: alphabetic baseline at `H/2 + (fontBoundingBoxAscent − fontBoundingBoxDescent)/2`.
- **Licensed fonts load via `staticFile` only**, never a shared assets bucket.
- **Check glyph coverage of vendored faces** — a missing `→` (U+2192) falls back mid-line; arrows and checks are SVG.
- **A brand shipping only Roman/400 is `fontWeight: 400` everywhere** — emphasis is size and color, or the browser synthesizes an ugly bold.
- **System-font measurers under wide display faces overlap words**: `measureScale` (Cal Sans 64px ≈ 1.16, Geist 600 56px ≈ 1.1), verified full-scale. Cal Sans + `tabular-nums` sets the thousands comma at full digit width → drop the comma, keep tabular-nums.

## 4. Remotion timing model

- **`durationInFrames` is scoped to the nearest `<Sequence>`** — self-pacing components (RollingNumber, AnimatedLineChart) see the *scene* length: `speed ≈ 1`. Speed 9–13 finishes them in ~10 frames under the entry blur, apparently static.
- **`<Sequence>` rebases `useCurrentFrame()` to 0** — a component gated on ABSOLUTE scene-frame constants stays outside one, or its phase renders blank.
- **`<Sequence>` is an AbsoluteFill** — inside a card the parent is `position: relative`, or it expands to the nearest positioned ancestor and overflow clipping stops.
- **`<Loop>` clips its last iteration to the parent's remainder** — an exit interpolate `[exitStart, durationInFrames]` inverts when the clipped duration < enter duration and crashes the FULL render only; stills never hit the frame. Gate `hasExit = exitStart < durationInFrames`, or run a local exit clock over `[0, exitDur]`.
- **`interpolate` inputRange ascends** — a descending range throws only on the frames that hit it (dwell frames), invisible in spot checks.
- **`OffthreadVideo` freezes at `liveFrom + clipFrames − margin`**, never past its clip end; self-contained excerpts start at t=0, so no `trimBefore`. Peak simultaneous decoders ≈ 8.
- **transition-rail does not wrap scenes in a Sequence** — `useCurrentFrame()` there is the GLOBAL clock; compute slot starts yourself. Frame-exact rebuilds take an absolute `<Sequence>` per scene.
- **Odometers**: `pos = value/10^place % 10` rests higher columns *between* digits whenever the value isn't a multiple of their place; `pos = wrap10(startDigit + progress × travel)`, `travel = (fullTurns×10 + stepDelta) × dir`.

## 5. TransitionSeries & presentation traps

- **The ENTERING presentation stays mounted at `presentationProgress = 1` for the whole incoming scene** — anything not exactly 0 at p=1 paints over it until the next cut (a field that only fades IN sits opaque forever; a window running to 1.08 never clears). Fix at source AND tail-guard every presentation (`interpolate(p, [0.9, 0.99], [1, 0])`) or tail-fade its fields (`[0.08, 0.32, 0.78, 0.98] → [0,1,1,0]`).
- **At p≥1 return bare `{children}`; a finished mask returns `null`** (~33% faster). A full-frame mask/filter/clipPath wrapper left alive at p=1 is 3840×2160 at `--scale=2`, and some GPU/driver combos repeat its last tile — the headline ghosts 2–3× right with a seam — pin `--gl=angle` (§13).
- **The entering layer composites ON TOP of the exiting one** — "halves part to reveal the scene behind" inverts; a reveal-from-behind seam draws BOTH scenes itself every frame.
- **A scene that enters and exits sits in TWO presentations, the EXITING one OUTSIDE** — the inner one's context Provider wins while pinned at p=1 for the back half, and every exit no-ops. Nested boundary effects COMPOSE (multiply opacities, concatenate transforms, intersect masks); the tell is each boundary looking correct alone. Plate and content needing different rules means a hand-rolled sequencer (~30 lines).
- **Covers become WIPES** — a cover leaves a legible headline under opaque texture for ~⅓ of the boundary. A wipe: one front crosses the frame, incoming clear behind it, outgoing clear ahead, brand texture only a narrow band riding the front, both scenes masked by the same gradient geometry from opposite sides.
- **Presentations have no local frame count** — springs run on `vFrame = presentationProgress × REF_FRAMES`.

## 6. Boundary design

**Every scene is two layers.** **Plate**: the pinned layer — color, field, grain, vignette, camera. **Content** travels over it. **Lead**: the pre-roll a carried scene runs before its plate lands.

- **A wipe front travels linearly** (or `bezier(0.42, 0, 0.24, 1)`) — the house exponential is 93% across by p=0.46, a flash or nothing.
- **A wipe masks the CONTENT, not just the plate**, or it is a band over a dissolve: both sides carry the same `linear-gradient` mask from complementary sides on one eased progress.
- **The mask stays put; content moves under it** — a mask is mapped through its own element's transform, so mask + translate on one element puts the front off the ground's line by the travel distance. Two layers per scene: outer carries the mask and never transforms, inner carries opacity/translate/scale/filter.
- **Content LAGS the front** — a wipe *reveals*; a front with nothing behind it is a curtain, and a spring that finishes early and waits reads "arrived and stopped".
- **Masked reveals ride the crop box, not the full-size children** — masking the children exposes a band the crop cut and empties the frame mid-transition.
- **Seam occupancy**: each half runs its own full curve over overlapping sub-ranges (OVERLAP ≈ 0.42), and every incoming scene has something on screen by its own frame 0–8; both halves on the seam's raw progress through one power curve travel while invisible.
- **A scene a boundary REVEALS (wipe/lift/push) has content at local frame 0; a scene a slide carries in is blind ~12 frames and gets a lead of 12–20f** (`f = local + lead`) so the plate arrives mid-assembly, already moving. Either side of a HARD cut is fully composed at frame 0. Best is static structure the plate simply carries — a plate that lands blank and then assembles is two events for one boundary.
- **The FIRST scene's clock starts at ~0 regardless of lead** — its first element takes a negative `at`; empty frames at frame 0 are the most expensive mistake a 30s cut can make.
- **A composed scene carried by a boundary gets a clock independent of the lead and no travel of its own** — a second translate makes the arrival mushy.
- **Any fade-based boundary: render p ≈ 0.3–0.35 and confirm it is not empty** — `lift` drops the outgoing at 0.3 and reveals the incoming at 0.34, so a plate with an invisible backdrop and a delayed headline reads as a cut to black. Wipes are immune.
- **The 3-phase gap (content out → plate crossfade → content in) is only for a GROUND tone change** — black↔white passes through mid-grey, so the plate changes while nothing is on screen; between same-tone scenes it costs ~5 empty frames, a blank tile at a boundary midpoint on the contact sheet.
- **In a slide the plate is pinned; only content travels** — a translated AbsoluteFill sweeps a hard flat-color edge across the frame.
- **`translate(x%, y%)` resolves x against width and y against height** — a "100%" push along 45° on 1920×1080 leaves the incoming plate a quarter on screen; full clearance is ≥141%.
- **A boundary is an authored event the eye registers** — below that threshold the scene just switched, and one that has to be explained before it can be seen is a caption.
- **Vary boundaries by DIRECTION, not mechanism** (settle / drop↓ / slide← / rise↑ / slide→; no two adjacent share one) and **pick the grammar by TONE**: `settle` for big tonal jumps, its color change inside the empty gap frame; slide/rise only between scenes sharing a tone, or a stage-color crossfade gives ~6 washed mid-grey frames.
- **Longer boundaries eat dwell** — only `dwell − in − out` is screen time; a 64f transition beside a 66f scene leaves ~2 clean frames. Budget LEAD/TAIL into neighboring beats; a count-up starts after its own transition has revealed the plate.
- **Match cut / seamless zoom**: both contact surfaces the SAME flat hex at the crossover; incoming content gated until the transition lands; a blinking cursor goes solid and the camera FREEZES before the dive, or it smears the match. The rect math is 2px-fragile — count 1px dividers, use border-box headers; a box-shadow ring isn't a border (a border grows the box and shifts the rect).
- **A post-credits sting rides `settle`** (already a transition) and is never empty — ~26 black frames read "film over". Its entrance is unlike anything else in the cut: pure fade + a hair of scale, no travel, no stagger.
- **Mask-grow over a shared backdrop**: scenes are transparent, so a clip-path reveal carries its own surface fill, and a layer fades only once physically covered — fading on raw progress exposes bare backdrop at the frame edges. Key every fade to the mask-coverage value, computed identically in both directions; every last-to-leave layer is backdrop-colored. A live shader backdrop travels as a STACK prop that covering layers re-render: a second instance is frame-identical, so hand-offs are pixel-invisible.
- **One transition language per film; `fade` is spent once, at the final lockup** — four fades in seven cuts is a slideshow. One shared glow/grain palette; the camera is §7's continuous rig, never reset at a cut.
- **A fly-through is a dive, not a clip-path portal** — a portal draws the incoming clipped inside the shape, pops when the mask clears, and the outgoing's own shape reads as a second copy. The outgoing self-dives at the aperture's origin until its interior swallows the frame; the incoming approaches out of that ground (scale up + unblur).

## 7. Motion & choreography

### The three-pass rule — a scene is finished when nothing in it comes to rest

Three passes; the first two look done and are wrong.

1. **Blocking** — the right moves in the right places. *Icon rises from below, morphs into the tile, holds, slides off the top.* Dead.
2. **Character** — eases and splits. *Headline splits into words at runtime, each masked and pushed up through its own window on `back.out(1.7)`, staggered 0.045s (≈1.5f), starting 0.06s (≈2f) before the card lands.* Alive, still cheap: every element completed before the next started, and rest reads as cheap.
3. **Overlap** — nothing is allowed to finish:
   - **Growth outlives its trigger** — the card grows 1 → 1.05 over 0.86s (≈26f), ignited by the morph, still growing as it leaves.
   - **Anticipate the launch** — crouch `scaleY` to 0.93, stretch to 1.05, fire.
   - **Swap on ONE axis with mirrored eases** — outgoing accelerates off the top on `power4.in`, incoming whips in from below on `power4.out`: same axis, same direction, opposite curves, never in one place at once.
   - **Data bleeds into the exit** — counters counting and bars growing when the crouch starts.

**The test, on every scene: name a frame where everything on screen is at zero speed.** One found is a pass-two scene, unfinished. Every standard below is an instance.

### Standards

- **The settle standard** (all videos): exit = the whole scene shrinks to ×0.84 over 6f on pow5 ease-in AS ONE GROUP — per-element scaling drifts multi-line text apart (line boxes keep height while glyphs shrink). ~1 empty gap frame; bg crossfades ~4f centered in it (only bg, never content). Enter = items from ×1.24, spring d30/k320/m1, opacity in ~5f, staggered ~3f; a multi-line block is ONE item. No Ken-Burns dwell drift.
- **The slide standard**: strictly sequential (concurrent A/B ghosts). A shoved 10% of the axis, pow5, 22f, hidden by an accelerating t² fade inside its own tail; B springs in from 28% on d60/k300/m0.5, overshoot-clamped, fade-in 24f decelerating; one shared canvas color.
- **An exit is asymmetric in curve and length, not direction.** A TRAVELLING shot leaves on its own vector, shorter than the entrance and accelerating where the entrance settled.
- **An arc has a source; a fade does not** — five fade-and-scales in a row are five identical nothings. A toss is ONE flight parameter (x eased-out, vertical hump `4t(1−t)` of it); rotation gets its own springier curve so the spin settles AFTER the position lands; two separately-timed animations drift apart on the first retune.
- **Ambient cycles take mutually prime periods** — 8/10.5/13, or 29/31/37/41/43; harmonic sets re-sync within two cycles into a metronome.
- **`floor((local − offset)/period)` starts at −1 for offset rows** — the cycle opens on its LAST item then jumps. Anchor the index to the first event.
- **Stagger direction carries meaning**: growing gaps (power ~1.3) for failures and exits, compressing for arrivals.
- **Depth swaps** ("one socket, changing occupant") beat lateral ejects, which read as two places. Blur is TIED to scale — softening without shrinking is a focus defect; cap blur ~11px. Nothing parks behind at low opacity at rest — a dim logo behind a logo is a smudge, not a deck.
- **Animate the mark's OWN parts** — the firing state and the finished mark are the same objects at different values of one parameter, so there is nothing to hand over: no substitute, no spawned copies. All layers take identical geometry or the hand-off seams.
- **Hand pixels over with a mask** when one layer must *become* another (radial-gradient `maskImage`, radius = flood progress); a crossfade greys the parts the flood hasn't reached. A superseded layer leaves once its replacement fully covers it, or two shapes are on screen.
- **Still geometry ≠ a still frame** — a dead held beat gets something sent ALONG the geometry before the geometry moves. SVG: `pathLength={1}` normalizes dash math across path lengths; dash gap > path length guarantees one bar; `strokeDashoffset = SEG − t·(1 + SEG)`; fade both ends of the run; guard the arrival tick with `since < period ? 0 : …` or every card ticks at frame 0.
- **Make a consequence, not a second animation.** A mark's leftward travel is flexbox re-centering as the wordmark's `maxWidth` opens from 0; a panel's squeeze is its edge as the running sum of the neighbors' animated widths.
- **Structure before content**: a hairline draws, then content arrives into the box it made — a free reveal in the back half of the beat.
- **Camera continuity is C1**: one continuous CameraRig on the absolute frame across every cut (subtle — a big global zoom is nausea), dwell drift eased in-out so velocity is zero at every dwell↔hop joint, or the take judders. `filter` FLATTENS `preserve-3d`: motion blur lives on an ancestor of the perspective element. Cull fly-past objects early (relZ ≈ −140) — anything visible past that explodes several × per frame and reads as camera shake.
- **One-take grammar**: no transitions — still camera on a tile while it plays (zoom exactly 1 = pixel-crisp), sin-eased pull-back glide between tiles, scenes start `LEAD ≈ 34` frames before the camera lands so the next tile is waking mid-glide, finished scenes freeze on their last frame. Blur from SCREEN-space speed (world speed × zoom).
- **Zoom rigs**: additive springs in the log-scale domain keep overlapping beats continuous; dive targets overshoot the exact fit (2.0 → 2.1) or the last percent leaves a border seam; anticipation is a tiny opposite-direction segment ~8f before the dive; screen-space chrome divides by the projected scale so 1px stays 1px; SVG contours under scaling take `vectorEffect="non-scaling-stroke"`, else stroke-width is in viewBox units.
- **Stop-motion (quantized clock)**: per-pose displacement ~a hand-width, spring settle ≥ ~20 poses for desk-scale travel or it reads as glitching; mass arrivals in waves of 1–2 items, the camera move delayed until the first wave is airborne.
- **Path morphs**: `interpolatePath` figure-eights on winding/start-phase mismatch, and `reversePath` alone doesn't fix it: resample both closed glyphs to fixed-N rings, normalize winding by shoelace sign, rotate the target ring to the min-squared-distance phase, lerp points. Order chains by silhouette similarity; every post-morph action starts AND ends at identity.

## 8. Scene & story structure

- **Land the last frame — the outro has NO exit.** Someone screenshots it; a mark flying off reads as a glitch. Drop the URL when there is nothing left to say.
- **One close carrying five things is five things read past.** The strongest number in the pitch gets its own scene, not a subtitle.
- **A repeated diagram reads as repetition, not a rhyme**, however carefully the second shot inverts the first — a shot that pays off twice spends its surprise the first time. Cut the setup beat.
- **A shot of only type holds ~20 still frames, not ~50** — past ~20 the viewer stops reading and starts waiting. Long holds carry a second element.
- **A heading gets its own breaker**, apart from its visualization.
- **Labels on a filling bar ACCUMULATE** — swapping them orphans every filled block.
- **Tight dwells after a progress bar completes**: ~16–20 frames, then move. Idle beats grow back silently; watch for the ~2s hang.
- **The opener is the marks assembling, motion first** — text comes later.
- **Rebuild the product's OWN signature components and animations** — the site's actual demos with their actual labels. Metaphor scenes are "nothing to look at" and the first thing a client kills; every feature shown ships today.
- **A build is one clock** — a logo build is one continuous object, whole across a match cut.
- **Confirm the axis before building** — «друг под другом» meant stacked along Z (overlapping), not a vertical column.
- **WATCH the render (or contact-sheet it) before defending an idea** — reasoning about a boundary is not seeing it.
- **The changelog-series formula**: each release debuts exactly ONE new transition that *performs the release's meaning*, used exactly twice; the outro is inherited verbatim from the flagship film.
- **Galleries**: fixed center card, items stacked on Z, each blooming over the previous via a center-out clip-path (`inset((1−p)·50% round 16px)`). Camera scrolls over grids and carousels are rejected — blank frames, unwanted movement.

## 9. Brand fidelity & research

- **Branded components keep their OWN colors** — never washed into the palette, `accentColor` never overridden. The one justified intervention is *legibility*: a light-hardcoded component on a dark canvas gets `invert(1) hue-rotate(180deg)` by CSS `filter` (`mix-blend-mode` paints solid over transparent component roots). Their THEMES are shared module constants, never mutated.
- **Read the brand off the LIVE compiled stylesheet** (palette, type scale, radii, tracking, weights); source comments lie — "matches #141318" sat over a token computing to #09090b.
- **Decode assets** — a filename or a fetch summary is a claim: "purple-icon.png" held no purple pixel.
- **Real logos verbatim**: inline the site's actual SVG paths; a raster-only mark is traced (threshold → connected components → Moore boundary → Douglas-Peucker) or omitted, never redrawn by eye or embedded as mush. Authentic quirks stay — a slanted parallelogram `I` is the brand.
- **Mine the brand's own geometry for the motion language** — a quantized dot lattice animates and can *become* a diagram; a logo of separate solids on an exact 60° means assembly IS the story. Assets drawn for 56px chrome are re-authored at beat scale.
- **Spend the accent the way the site does** (often: almost never); the identity's one typeface is the film's, and a monochrome brand stays monochrome.
- **Lockups match SYMBOL heights, not letter heights** (caps = 0.605 × symbol height); guidelines forbid reconfiguring proportions.
- **Positioning moves** — re-verify live homepage copy and CLI commands at build time, never from an old script; two products can share a name, so verify which one the film is about first.
- **The `*_DURATION` constant in `index.tsx` is the only source of truth** — SCRIPT.md/STORYBOARD.md frame numbers drift.

## 10. shadcn/ui, HTML UI & CSS-in-video traps

- **shadcn `transition-*` runs on the WALL clock, not the frame clock** — a hard theme/var flip starts a real-time CSS transition the screenshot catches mid-flight, and adjacent frames disagree. `.video-scope * { transition: none !important; animation: none !important; }`, verified on pixel samples from CONSECUTIVE frames (`--sequence` + ffmpeg 1×1 crop); a still cannot reproduce it, since a direct seek mounts the class already applied.
- **react-day-picker's "today" follows the wall clock** — always pass `today={...}` beside `selected`/`month`.
- **Portal primitives (open tooltip/dropdown/dialog) escape camera transforms** — under transformed planes, inline-rendering components only (Command, Calendar, Accordion).
- **Regular weight over components shipping font-medium/semibold**: `**:font-normal!` on the wrapper.
- **Both theme var sets live in `:root`** — a dark-first `global.css` without `--background`/`--foreground` there paints a light-theme render transparent.
- **Declare `font-family` on the scope element itself** — a CSS-var pin does NOT stop inherited computed styles: a `--font-sans: var(--font-sans)` self-reference broke the html font and serif leaked INTO the pinned subtree. Identical pinned values prove nothing; only a diverging theme exposes holes.
- **`text-indent` INHERITS, and an inline-block is a block container** — a heading's first-line indent re-applies before every animated word span (~80px gaps): word spans take `textIndent: 0`. Word gaps are `marginRight`, not a space — a trailing space in a `white-space: pre` inline-block doesn't collapse.
- **Registry typography components render `position: absolute; inset: 0` centered and read `var(--font-geist-sans)`** — set the var on the composition root and give each line its OWN positioned box (they can't stack in flow). Per-char effects need `speed ≈ 2.2` to finish a long line inside a scene.
- **Primitives that hardcode the light theme** go on a small light Stage card in a dark film, colors untouched.
- **GlassCodeBlock's tokenizer mangles number literals** (`60_000` → `,`, `-0.025em` → `-0.;`) — clean literals only, every code window verified on a rendered still.
- **RollingNumber's root is an AbsoluteFill** — in a flex child it anchors to the nearest positioned ancestor and centers over the scene. Wrap it in a `position: relative` box of explicit size (~`0.62em × digits` × `fontSize × 1.1`) + `overflow: hidden`.
- **Cards over live content are solid** — translucent is unreadable; `overflow: hidden` on the container, content pinned flex-end.
- **Swarms are canvas/SVG** — ~1000 absolutely-positioned per-glyph spans lag Studio.
- **Terminal scroll is a smooth ~10-frame eased glide**, overlapping glides composing additively. A CTA caret appears once the command starts typing — none idling on a bare `$`.

## 11. Shaders, WebGL & three.js

- **WebGL renders black or throws in headless Chrome without `--gl=angle`.** `Config.setChromiumOpenGlRenderer("angle")` covers the CLI and Studio ONLY — Node-API scripts pass `chromiumOptions: {gl: "angle"}` themselves. `remotion.config.ts` is in tsconfig's `exclude`: typecheck it explicitly.
- **ShaderLiquidMetal renders a rounded card, not fullscreen** (even `shape="none"`); god-rays/warp/mesh-gradient/voronoi/metaballs fill edge-to-edge.
- **Dither dissolves take `shape="simplex"`** — the default `wave` fills half the frame with solid colorFront.
- **Grayscale ripple tunnels are nearly invisible at color-preset values** — `scale` low (0.22 → 0.55 through the readable window), `intensity ≈ 0.8`. The entering child is hidden until p ≈ 0.86, so a draw-on inside the incoming scene STARTS at that reveal or is spent behind the cover.
- **Voronoi as a statement cover**: near-black tinted cells (mid-brightness is loud stained glass), gap ≈ 0.07, `colorGlow` = the background hex, `scale` animated for the bloom, the field tail-faded.
- **Caustics: the filaments are the ZERO-CROSSING set** — `exp(-abs(c))` (sharp core + soft halo); `pow(clamp(c,0,1), k)` is a flat grey gradient with no veins.
- **three.js inside Remotion**: `flat` on ThreeCanvas, or ACES lands a calibrated rig ~40% dark; SVG y-down is rotation `[π, 0, 0]` — `scale(s, −s, s)` mirrors windings and normals; ThreeCanvas mounts for the WHOLE scene, since a conditional mid-scene mount flashes black; the camera is mutated in render from `useCurrentFrame` (`useFrame` flickers); `backgroundColor: "transparent"` composites over DOM shader fields; TubeGeometry + `setDrawRange` walks a stroke like an SVG dashoffset.
- **Glossy sheen over near-white glyphs**: pure white is invisible on #f2f2f2 — the band needs dark shoulders (shadow–highlight–shadow). Sheen is white, never the accent.
- **Deterministic physics is `@remotion/noise` + analytic kinematics** — no rigid-body package exists for Remotion.

## 12. CSS & layout traps

- **A CSS value is one line** — a value containing newlines is dropped whole by the CSSOM, so a multi-line template-literal gradient renders *nothing*. Stops clamped to [0,100] and monotonic; a violation voids the declaration the same way.
- **`linear-gradient(Adeg)` aims the AXIS; bands run perpendicular** — a 60° front takes `60deg`, not `90 − 60`.
- **Decorative marks along a wipe front: scatter in screen space, then project onto the gradient axis with CSS's own formula** (`|W·sinθ| + |H·cosθ|`, centered on the box). Marks placed in (along, across) coordinates and inverted land on a different line than the mask.
- **A `gap` on a flex row whose last child is zero-wide still occupies layout** — the row centers offset by gap/2. Put the gap INSIDE the clipped box as `paddingLeft`.
- **`clipPath` doesn't shrink the box** — a lockup mid-reveal sits centered on its FINAL width with a hole beside the mark; translate the group by half the still-hidden width. `maxWidth` genuinely shrinks and re-centers for free, but §2's width rule stands where text jitter matters.

## 13. Rendering & verification

- **Ship render**: `npx remotion render src/remotion/index.ts <id> out/<id>.mp4 --scale=2 --crf=15 --x264-preset=slower --jpeg-quality=95 --gl=angle`. `--scale=2` is not optional — fine-stemmed type breaks up at 1× under H.264, and a 1px accent rule vanishes into subsampled chroma (accent rules ≥3px). `--gl=angle` makes renders deterministic and removes driver variance (§5, §11).
- **Exit codes and notifications lie.** Background completion fires EARLY — watch the output file, not the task. Killing the task kills only the shell wrapper; the render SURVIVES, and a replacement to the same path interleaves two writers and corrupts the mp4: `pkill -f "remotion render"`, then `pgrep`. A looped shell command exits 0 while a still fails — check the file landed. A pipe masks an exit code (`tsc | tail -20` reports the pipe's): diff error COUNTS against a stashed baseline.
- **`ffmpeg -ss` before `-i` seeks to keyframes** — exact frames come from `--frames=a-b --sequence`.
- **Contact sheet**: `ffmpeg -i video.mp4 -vf "select=not(mod(n\,24)),scale=320:-1,tile=6x7" -frames:v 1 sheet.png` catches empty boundaries, blank openings and dead frames. The grid PADS MISSING TILES WITH BLACK — trailing black tiles are not a fade-to-black.
- **Probe colors beat inference**: for each scene's true span, swap every scene for a solid probe color, render `--scale=0.1 --sequence`, read the pixels.
- **Verify on pixels, not on types** — code windows, fonts, seam midpoints (p ≈ 0.3), transition frames, count-up values across frames. Deterministic renders make byte-comparing stills against a baseline a valid regression check.
- **YouTube covers**: hard 2MB cap (gradient art as JPEG ~92). A cover that "looks blurry on YouTube": open `https://i.ytimg.com/vi/<VIDEO_ID>/maxresdefault.jpg` first — if that is sharp, the grid serves a small upscaled derivative and no re-render changes which. Large smooth near-black gradients block up under YouTube compression; flat grounds stay clean.

## 14. Project & dependency traps

- **A standalone demo inside a parent repo**: `index.tsx` re-exports the composition component directly, past the standalone `registerRoot` entry; the nested `node_modules` is DELETED — a second `remotion` gives every hook its own React context and `useCurrentFrame` sits at 0 forever, a **still film with no error**; assets are inline base64 data URIs, since `staticFile` resolves against whichever `public/` is serving.
- **Pin `remotion` and every `@remotion/*` to one EXACT version** — caret ranges get bumped by `shadcn add` → "Multiple versions of Remotion".
- **Node render APIs ignore `remotion.config.ts` entirely** (alias, tailwind, gl) — every render script re-declares them. Bundle ONCE for batch stills; `remotion still` re-bundles the whole project per call.
- **Cross-origin assets need CORS** (`python3 -m http.server` sends none). Only `REMOTION_`-prefixed env vars reach compositions, and the Node bundler API reads NO `.env`, so env-based asset overrides never reach script-driven renders.
- **Check for squatters before building** — untracked stock templates with their own `package.json`/`node_modules` at the target path, including case-variant folders on macOS's case-insensitive FS.
