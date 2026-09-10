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
Custom word pushes can use `staggeredGroup` for both member animation and group
completion, preserving the chosen treatment.

The supplied combinations emit `MotionReview` automatically. Custom sequences
mount it around the whole sequence and attach `useCue` to the real targets; use
the same beats for animation and review. Keep the wrapper mounted across child
handoffs so review can observe a target disappearing prematurely. See the module
README for clocks, scope, content edits and bounded coverage.

Build the difficult combination and its neighboring transition with the actual
copy, font, images and aspect ratio. Check the content at realistic player size.
If the target duration cannot contain the message and its movement, shorten or
regroup content, improve its layout, or reallocate time. A reading estimate is a
planning aid, not a measurement of comprehension.

Run `design_check` in full mode. It discovers event boundaries from rendered v2
contracts and compares targets with their promised intervals. Inspect the returned
transition frames and the moving result against the chosen direction. Fix measured
defects and review missing contracts, unvisited frames and stale reports; the
pipeline revalidates the report when completing review. This verifies bounded
mechanics, not creative success. Canvas/footage and unusual visual effects still
need review of their actual pixels.
