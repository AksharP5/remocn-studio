# Build and verify movement combinations

For new text, image, graphic or card sequences, read the installed
`src/lib/studio-motion-v2/README.md` and the relevant implementation. Existing v1
films keep their authored behavior; use v2 for new sequences. Choose the visual
treatment from the brief, references and real assets. Own easing, stagger, reading
and transitions without asking the person to tune them.

Select the smallest fitting combination: phrase replacement, heading/details,
image/caption, card-to-grid or metric/graphic. The primitives also fit custom
layouts. The executable plan supplies the end of group entry, reading interval
and complete exit; derive dependent events and the enclosing duration from it.
Read [timing](timing.md) for readiness and group-completion rules before composing
dependent movements. Custom word pushes can use `staggeredGroup` for both member
animation and group completion, preserving the chosen treatment.

Keep authored inputs such as copy, item count, stagger and geometry together.
Compute the member schedule, group boundaries and following events from them;
pass that plan to both rendering and review. A separate array of plausible
timestamps duplicates the schedule and can become false as soon as copy changes.
If a supplied helper does not fit, expose the custom component's computed plan
instead of guessing its completion from the first child or wrapper duration.

The supplied combinations emit `MotionReview` automatically. Custom sequences
mount it around the whole sequence and attach `useCue` to the real targets; use
the same beats for animation and review. For groups, include the visible children
that determine readiness or exit; the presence of an empty wrapper cannot prove
that its words or images are ready. Use the plan's `slot` field for an exclusive
reading position. Keep the wrapper mounted across child handoffs so review can
observe a target disappearing prematurely. See the module README
for clocks, scope, content edits and bounded coverage.

Build the combination and neighboring transition selected to prove the direction,
using the actual copy, font, images and aspect ratio. Check the content at realistic
player size. Verify a relevant temporary input variation for a shared dependency,
such as another word or a longer stagger: the final child, next event, enclosing
duration and review plan must update together. Restore the intended inputs and
inspect the final passage. If the target duration cannot contain the message and
its movement, shorten or regroup content, improve its layout, or reallocate time.
A reading estimate is a planning aid, not a measurement of comprehension.

During draft corrections, use `design_check` in sampled mode on the changed
passage and dependent neighbors. Reserve full mode for final pipeline Review,
after local findings are closed. The full check discovers event boundaries from
rendered v2 contracts and compares targets with their promised intervals. Inspect
transition frames and the moving result against the chosen direction. Fix measured
defects and review missing contracts, unvisited frames and stale reports; source
changes require a fresh full report, revalidated when completing Review. This
verifies bounded mechanics, not creative success. Canvas/footage and unusual visual
effects still need review of their actual pixels.
