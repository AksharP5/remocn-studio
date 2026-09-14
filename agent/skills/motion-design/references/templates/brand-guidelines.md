# Brand Guidelines

Registry ID/export: `brand-guidelines` / `BrandGuidelines`. Form Study, its
geometric mark, warm palette and photographs are sample identity material.

[Preview](https://remocn.dev/docs/templates/brand-guidelines) ·
[Docs](https://remocn.dev/docs/templates/brand-guidelines.md) ·
[Source JSON](https://remocn.dev/r/brand-guidelines.json)

Read `index.tsx`, `motion.ts`, `content.ts`, `ui.tsx` and selected scenes under
`registry/remocn-templates/brand-guidelines/`. Follow the
[source and adaptation procedure](index.md). Source clock: 1072 frames at 60 fps,
960×540 design surface. Ranges below use that reference clock; `atFps` converts
it for playback. Typography and collage deliberately overlap.

## Passages and their causes

| Range | Source | What to study |
| --- | --- | --- |
| Frames 0–118 | `scenes/identity.tsx` | Identity establishes a recurring mark before opening the system around it. |
| Frames 118–326, especially 294–326 | `scenes/palette.tsx`, `scenes/typography.tsx` | Color slabs arrive in sequence; the palette moves left as the specimen enters from the right with the same push progress. |
| Frames 324–614 | `specimenState` in `motion.ts`, `scenes/typography.tsx` | Typing, deletion, a second phrase, then increasingly quick style cuts demonstrate a type system. |
| Frames 614–806 | `scenes/collage.tsx` | Photos and graphic plates establish layers while the earlier type becomes background. |
| Frames 806–1072 | `scenes/closing.tsx` | Tile motion and flipping words resolve into the wordmark and recurring mark. |

The palette's last state becomes the starting geometry of the next chapter.
During the 294–326 push, both chapters use the same progress; treating it as two
unrelated slides risks changing their relative spacing. The specimen's faster
cuts change the viewing task from reading a sentence to recognizing variation.
Its text behind the collage becomes texture while the photographs take focus.

## Transfer it

Use the palette push for related graphic states; use specimen changes to reveal
range within a type system; use a collage when a collection benefits from
simultaneous spatial relationships. Preserve shared direction, offsets and
attention changes while adapting the brand and materials.

Measure real text and type faces before setting specimen size. The source's
`fitSize` is a heuristic; longer phrases can need new timing or composition.
Use quick style cuts for visual samples, and provide readable time for essential
claims. Recompose collage crops, scale and stacking for actual photographs.
Recalculate closing-word arrival and reading time if their lengths change.

The template letterboxes at other aspect ratios. A portrait treatment needs
authored composition rather than a claim that scaling made it responsive.

## Recognize a weakened adaptation

Equal timings for every phase erase the shift from deliberate specimen to visual
burst. Treating background type as another required headline creates competing
reading tasks. Replacing photos without reviewing crops can leave all plates
equally prominent or conceal their subjects. Compare the intended focus at the
collage's densest moment before adding labels.

Proof: include the palette/specimen handoff or specimen/collage shift, depending
on the borrowed idea. Check that the outgoing and incoming surfaces move as one
relationship and that essential copy remains available outside dense passages.
