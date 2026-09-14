# Release Teaser

Registry ID/export: `release-teaser` / `ReleaseTeaser`. Orvio 2, the open-ring
mark and its colors are sample identity material.

[Preview](https://remocn.dev/docs/templates/release-teaser) ·
[Docs](https://remocn.dev/docs/templates/release-teaser.md) ·
[Source JSON](https://remocn.dev/r/release-teaser.json)

Read `index.tsx`, `motion.ts`, `scenes/statement.tsx`, `scenes/closing.tsx`,
`background.tsx` and `geometry.ts` under
`registry/remocn-templates/release-teaser/`. Follow the
[source and adaptation procedure](index.md). Source clock: 960 frames at
60000/1001 fps (16.016 seconds), not exactly 60 fps; design surface 960×540.

## Passages and their causes

| Range | Source | What to study |
| --- | --- | --- |
| Frames 0–610 | `scenes/statement.tsx`, `characterState` in `motion.ts` | Five short statements resolve from their centers while a cropped dimensional form provides continuity. |
| Frames 602–702 | `ringPose`, `background.tsx`, `geometry.ts` | The form pulls back and rotates from a material close-up into the recognizable mark. |
| Frames 610–960 | `scenes/closing.tsx`, `ringPose` | The release lockup resolves over the mark; edge lighting and the background recede while the name remains. |

`characterState` delays characters by their normalized distance from the center.
The delay is bounded rather than increasing indefinitely with character count.
Opacity, small vertical travel and blur describe a focus reveal; large unrelated
travel would change that character. The reveal interval and the outward/inward
ordering of the exit must be considered together.

The background's slow development supports the text. Its main pullback overlaps
the release reveal on purpose: one resolves the identity's shape while the other
names it. This is an example of coordinated simultaneous motion, not a rule that
every text entry needs a camera move.

## Transfer it

Use center-out type for a short statement that deserves focused attention; use a
material close-up and later reveal when the actual identity has a recognizable
form. Preserve the reveal's restrained travel and center-based timing, then
recompute reading windows and exit readiness for new words, lines and fonts.
Bounded stagger does not guarantee that longer copy is readable.

The default ring is a projected mesh shaded on canvas. `logoSrc` produces a flat
custom-logo treatment; it does not turn an arbitrary bitmap into beveled 3D.
Choose an appropriate material treatment for the supplied mark. Inspect the
actual preview/export when translucent light or small blur carries the effect.

## Recognize a weakened adaptation

A parent slide or mask can hide center-out text while its internal clock keeps
running. By the time the template lands, the headline is already settled and
the chosen reveal is lost. Move the source in-point, complete the outer
transition earlier, or coordinate their movement so the reveal stays visible.
Check the last outgoing characters as well as the next phrase's first arrival.

Proof: render a full statement replacement or the close-up-to-lockup passage,
including the visible reading interval. Compare the text's focus, intermediate
form and attention transfer. A long still hold can be appropriate for the final
name; preserve it based on the viewer's task rather than a motion quota.
