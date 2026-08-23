# Product-launch rhythm

Answers "how should a product-launch film breathe?" These are measured genre
defaults, not universal motion laws. Use them for a launch teaser, feature reel,
or event opening; do not carry them into a tutorial, testimonial, or calm
changelog by habit.

## Evidence and limits

REM-299 measured 15 official launch sources from Apple, Linear, Vercel, Raycast,
and Stripe on 2026-08-23: 449 automatically detected scene intervals, six
manually annotated films, and a mean optical-flow confidence of 0.82. The
committed evidence is in `reference-corpus/product-launch/`: per-video JSON,
manual annotations, threshold sensitivity, and the aggregate profile.

An automatic "scene" here means a detected visual boundary. It can miss
internal choreography inside a continuous camera move: the Apple May opening
contains a 35s detected interval with multiple reveals, and Linear Agent opens
with 17s of continuously moving UI. Treat the duration distribution as the
cut-level rhythm, never permission to hold one pose for the same time.

## Default cut-level rhythm: 40f, with deliberate 22–66f variation

At a normalized 30fps, the median detected interval was **40f / 1.33s**; the
middle half ran **23–65f / 0.75–2.17s**. **36%** of intervals were shorter than
30f. A launch sequence therefore needs unequal rhythm: roughly one short accent
for every two ordinary beats, mixed with a smaller number of longer explanatory
or payoff holds.

- Start a first timing pass near 40f per cut-level beat.
- Spend 18–29f on accent inserts, impact results, and rapid proof.
- Spend 40–66f on one readable product state or claim.
- A beat longer than 66f needs internal events — camera travel, UI-state changes,
  secondary motion, or staged reveals. Duration alone never counts as a hold.
- Do not force every sequence to the median. The measured p25–p75 spread is the
  useful default, not a target to flatten.

**Evidence:** profile rules `product-launch-scene-duration` and
`product-launch-short-accent-share`; measurement IDs listed in
`profiles/product-launch.json`.

## Prefer decisive cuts and carried motion; fades are punctuation

Detected boundaries were **68% hard cuts**, **25% motion-transitions**, **5%
fades**, and 2% unknown. Defaulting every boundary to a crossfade reverses the
genre's measured vocabulary.

- Use hard cuts for new claims, viewpoints, and short proof inserts.
- Carry direction, camera energy, a shared surface, or an action through nearby
  cuts; six manual reviews repeatedly showed continuity doing the smoothing.
- Use motion-transitions when the same product world or spatial axis continues.
- Reserve fades for an intentional register change, breath, or clean brand
  close. They should be exceptional in a launch montage.

**Evidence:** aggregate `transitionTypeShares`; manual boundaries in
`annotations/linear-agent.json`, `vercel-product-tour.json`,
`raycast-2026.json`, `stripe-reader-s700.json`, and both Apple annotations.

## Music is a grid, not a prison

After normalizing every source to 30fps, **56%** of detected boundaries landed
within ±4f of a beat (40% within ±3f; 31% within ±2f). Use the committed
aggregate's `meanBeatHitRateFrames30` values rather than the source-FPS values in
individual measurements. Align the strongest claims, impacts, and register
changes; let intermediate UI choreography cross the grid so the film does not
become a metronome.

## Holds keep one low-amplitude layer alive

Across the corpus, 59% of analysed time carried camera, element, or mixed motion.
Manual review found the same staging pattern: the message receives a readable
plateau while a background, camera, product state, or human action keeps moving.
The deliberate exception is a clean closing card after a dense run.

- Write the intended moving layer into `video/motion.md` for every long launch
  hold.
- Assert it with `keeps_moving` over one bounded scene interval when stillness
  would be a defect.
- Do not attach `keeps_moving` to an earned end card or narrative pause; explicit
  intent outranks the genre default.

The measured static-run median was 0.25s and p75 was **0.75s**. When a layer is
explicitly required to stay alive, start `maxStaticFrames` at **24f at 30fps**
(0.8s, rounded just above p75) and scale it with FPS. Do not use that threshold
on an end card or copy the frame count to another FPS without scaling it.

## Launch-teaser recipe

Use this default for a cinematic launch teaser, not a full tutorial or a list of
every feature. A useful first cut runs **20–55s**:

| Share | Beat | What happens |
|---|---|---|
| 0–10% | Hook | Open on a telling detail already moving; withhold the full product or claim. |
| 10–25% | Promise | Resolve the product/feature name and one outcome, not an inventory. |
| 25–75% | Proof run | Show 3–6 real product states; vary ordinary 40f beats with 18–29f accents. |
| 75–90% | Payoff | Show the strongest finished state; allow a longer internally active hold. |
| 90–100% | Brand close | Clear the frame, land one CTA/date, and earn the cleanest pause. |

The content contract is `product`, one `promise`, 3–6 visual `proof` states, one
`payoff`, an optional single `cta`, and the real `brand` spec. If audio exists,
name its strongest impacts and register changes in `video/motion.md`. The proof
run is choreography, not enumeration: if it needs more than six states, narrow
the promise or make a product demo instead.

For the hook, prefer a real product crop with `push-through`, `zoom-blur`, or a
restrained `soft-blur-in`. Use shared-axis or carried product-shell motion
inside the proof run, then spend the simplest transition and stillness on the
brand close. The catalog is a vocabulary, never a requirement to decorate
every beat.
