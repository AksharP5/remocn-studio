# Spec 04: the picker aims at what the person sees

Part of `docs/plans/2026-09-02-inspect-00-overview.md`; read its ground rules
first. Design record: `docs/plans/2026-09-02-inspect-usability-design.md`,
plan item 4. Effort S. Depends on nothing; pairs with spec 01.

## Goal

A click on a line of text lands on that line, including the gaps between its
words. Invisible and masked layers cannot win a click. A decorative surface
covering most of the frame loses to anything smaller under the same point. Alt
still picks the literal topmost node.

Complaint addressed: 2.

## What is wrong today, with the code that does it

All in `preview/picker.ts`:

- `coversText` (`:52-77`) reads only the element's *own* text nodes. Agent
  markup renders words as child spans (`remocn-vidrush-sponsor/components/WordPush.tsx:256-282`,
  `display: "inline-block"`, `marginRight: 0.22em`), so the line div covers no
  text in its own gaps and a click between two words falls through.
- `paintsSurface` (`:79-96`) counts any `backgroundImage`, and `paints`
  (`:120-132`) never reads `opacity` or `visibility` or a mask. A word at
  `opacity: 0` before its entry frame is pickable; a full-frame radial glow
  (`remocn-need-sponsor/components/AmbientField.tsx:146-157`, `inset: -260`)
  and a masked ghost box (`remocn-vidrush-sponsor/components/Backdrop.tsx:137-182`)
  win a click aimed at copy behind or in front of them; the Highlight marker
  (`components/Highlight.tsx:120-134`) wins in a word gap.
- `pickAt` (`:186-211`) takes the first candidate that `paints`; there is no
  preference for text over a surface.

`climb` (`:148-171`) is correct and stays as it is: an inline-level element
that paints no surface folds up to its line.

## Changes

All in `preview/picker.ts`, pure over computed style and client rects, with
tests in `preview/picker.test.ts` (jsdom). `getComputedStyle` in jsdom does
not lay out, so the tests set inline styles and stub `getClientRects` /
`getBoundingClientRect` on fixture nodes the way the existing `climb` tests do.

1. **`nearText(element, x, y)`** replaces `coversText` as the text test. Walk
   descendant text nodes with a `TreeWalker` (`NodeFilter.SHOW_TEXT`), skipping
   whitespace-only text and any text whose element, or an ancestor up to
   `element`, has computed `opacity < 0.05` or `visibility !== "visible"`. For
   each rect of each text node, accept the point when it lies inside the rect
   widened horizontally by `0.35 × fontSize` of that text's parent element (the
   word gap) and unchanged vertically. Keep `coversText` exported for callers
   and tests, implemented as `nearText` with allowance 0.
2. **`paints(element, x, y)`**: return `false` when computed `opacity < 0.05`
   or `visibility !== "visible"`. When `maskImage` or `webkitMaskImage` is not
   `none`, the element paints only if `nearText` is true (a mask can hide any
   part of a surface; text is the one thing it is known to show).
3. **Candidate order in `pickAt`**: among `under` (topmost first), prefer the
   first element for which `nearText` is true; otherwise the first element that
   paints a surface, is replaced, or is SVG, except that a surface whose box
   covers at least 80 % of the container's width *and* height loses to any
   later candidate under the same point that paints and covers less. Fall back
   to `topmost` as today. Alt (`exact`) is unchanged.
4. **`onDown` in `preview/inspect.ts`** ignores `event.button !== 0` (spec 01
   does this too; whichever lands first).

Tests, one fixture each, named after the corpus shape they come from:

- WordPush: a block `div` with two `inline-block` spans and a gap; a point in
  the gap picks the line div, not the surface behind it.
- Highlight: an absolutely positioned marker with a background behind a text
  span; a point on a glyph picks the span's line, a point on bare marker picks
  the marker.
- AmbientField: a full-frame gradient div behind a line; a point on the line
  picks the line; a point on empty canvas picks the gradient.
- Backdrop: a masked box with a background; a point on it with no text picks
  what is behind it.
- Unrevealed word: a span at `opacity: 0` is skipped, its line is still picked
  when another word is visible, the surface behind is picked when nothing is.
- Alt keeps the topmost node in every case above.
- The existing `climb` cases keep passing untouched.

## Acceptance in the running app

1. `remocn-vidrush-sponsor` scene 3: click between two words of a claim line;
   the hover box and the pick are the line, not the Highlight marker or the
   backdrop.
2. `remocn-need-sponsor` RevenueScene: click a figure that sits over the accent
   glow; the figure is picked. Click empty canvas; the glow or the scene
   background is picked and the pane says so by name (spec 01).
3. Pause before a line has entered; hovering its words draws nothing until they
   are visible.

## Out of scope

Anything about what the pick *means* once made (spec 01 and 02). SVG handling
stays as documented in CLAUDE.md.

## Verification

`bun run check`, `bun run typecheck`, `bun run test`, `bun run changeset`.
Update CLAUDE.md "The picker answers two questions grab got wrong" with the
three new rules.
