# Spec 01: a selection you can see, named by the agent, identified per instance

Part of `docs/plans/2026-09-02-inspect-00-overview.md`; read its ground rules
first. Design record: `docs/plans/2026-09-02-inspect-usability-design.md`,
plan item 1. Effort M. Depends on nothing.

## Goal

After this spec, a click in Inspect mode always produces a visible answer: a
solid selection box distinct from the hover box, a pane title that is the name
the agent gave the element, and a second click on a *different* instance of the
same component opens that instance instead of being discarded. The hover and
selection boxes are drawn inside the preview document, the way they are today;
what changes is their lifetime, their priority, and what identifies a selection.

Complaints addressed: 1 (no feedback), 2 (the "Div" title), and the identity
half of 3.

## What is wrong today, with the code that does it

- `hooks/use-inspect.ts:126` returns early when `sameElement` matches, and
  `sameElement` (`:440-447`) compares only `targets.at(0)?.targetId`, which is
  Remotion's `overrideId`. Every `Interactive.*` element rendered from one JSX
  call site shares one id in the studio's preview (`remotion/dist/cjs/with-interactivity-schema.js:138-143`
  keys it on the `stack` prop the bundler injects because
  `sidecar/preview/host.ts:237` compiles with `environment: "development"`). So
  the second line rendered by the same component, or any element inside a
  `.map()`, is "the same element" and the click is dropped.
- `preview/inspect.ts:314` paints one box: `const showing = hovered ?? pinned`.
  The selected element's box is visible only while the pointer is off the
  canvas. `report()` (`:377-382`) rebuilds `chain` and sets `pinned = null` on
  every pick, before the app decides anything; `hooks/use-inspect.ts:200-204`
  re-sends `highlight` only when `openTargetId` changes, which a dropped click
  never does. So a dropped click makes the previous box disappear.
- `components/studio/props-pane.tsx:61,103` title the pane with
  `card.tuning.componentName`, the literal string `<Interactive.Div>` for every
  text element. `preview/inspect.ts:337-343` labels the hover box the same way
  plus the tag. The agent's `name="Headline"` is already on the controls object:
  Remotion appends a hidden `name` field to every schema and `readValuesFromProps`
  reads it into `controls.currentRuntimeValueDotNotation` (`with-interactivity-schema.js:151-155`);
  `preview/tuning.ts:340` skips it because it is `hidden`.
- `preview/inspect.ts` `onDown` (`:196-210`) picks on any button; the selection
  overlay lives inside the armed session and is removed by `close()` on disarm.

## Changes

### 1. `preview/anchor.ts` (new): a remount-stable identity for a node

A pure module, tested in jsdom, that turns a DOM node into a selector that
survives a remount of the same tree.

- `anchorOf(node: Element, container: Element): string`. Walk from `node` up to
  `container`. If an ancestor-or-self carries `data-design-id`, the base is
  `[data-design-id="<CSS.escape(id)>"]` and the steps are `> :nth-child(k)` for
  each element from that ancestor's child down to `node`. Otherwise the base is
  `.__remotion-player` and the steps run from the container's child down.
- `resolveAnchor(anchor: string, container: Element): Element | null`, scoped
  to the container (`container.querySelector` after stripping a leading
  `.__remotion-player` base, or `container.ownerDocument.querySelector` for the
  design-id form). When a design id matches several elements, take the first
  and accept the limitation; `design_check` already reports duplicate ids.
- Add `"../preview/anchor.ts": "preview/anchor.ts"` to the `resources` map in
  `src-tauri/tauri.conf.json` next to the other `preview/` entries (`:43-53`).

Tests (`preview/anchor.test.ts`, jsdom): a node under a design-id ancestor;
a node with no design id anywhere; a node that is itself the design-id carrier
(no steps); round trip `resolveAnchor(anchorOf(n)) === n` on a fixture shaped
like WordPush (a `div[data-design-id]` holding inline-block spans); an id that
needs escaping.

### 2. `preview/tuning.ts`: the target carries a name, an instance key and an ordinal

Extend `TuningTarget` (page side, `:50-54`) with:

- `name: string | null`, read from `values.name` when it is a non-empty string.
  `describeTuning` takes `name` as an input alongside `componentName`; the
  caller reads it from `controls.currentRuntimeValueDotNotation.name`.
- `instanceId: string`, the anchor of the link's host node.
- `ordinal: number` and `instances: number` (1-based, both `1` when unknown).
- `where: { column: number | null; file: string; line: number | null } | null`,
  filled by `preview/inspect.ts` (grab's `getSource` per link host), `null`
  until then.

`targetId` keeps its meaning in this spec (Remotion's `overrideId`); spec 02
moves the wire key to the anchor. Do not fold the two yet.

Add `isPlumbing(target): boolean`: true when every field's path is in
`{"hidden", "layout"}`. `<Series>` registers a `controls` with exactly those two
fields and shows up as a chip whose two controls hide the whole film or change
its layout; drop such links from the chain unless they are the innermost.

Tests (`preview/tuning.test.ts`): `name` comes from values and is `null` when
absent or empty; `isPlumbing` on a Series-shaped schema and on a real one.

### 3. `preview/interactivity.tsx`: instances and ordinals, keys at pick time

In `selectedTargets(element)`:

- For each link, `instances` is the count of registered sequences whose
  `controls?.overrideId` equals the link's id; `ordinal` is the link's position
  among them ordered by DOM position of `refForOutline.current` using
  `compareDocumentPosition`, falling back to registration order when a ref is
  null. Both `1` when the count is one.
- `instanceId` is `anchorOf(link.node ?? element, canvas)`; `preview/tuning.ts`
  `controlsChain` already returns `node` per link (`hostOf(fiber)`).
- Keep a `keys: Map<string, string>` from anchor to `overrideId`, written here
  and read by `set`/`reset` so a `targetId` that is an anchor still resolves
  (spec 02 replaces this map with a live registry; in this spec `set`/`reset`
  accept either form).
- Filter with `isPlumbing`, keeping index 0 regardless.

### 4. `preview/inspect.ts`: two boxes, a selection that survives, names on the label

- `overlay()` builds two pairs: the existing hover box and label, and a
  selection box (2px solid `ACCENT`, no fill, `border-radius: 2px`) with a
  selection tag (same style as the label, `ACCENT` background). The selection
  pair is module-level, created once and never removed by `close()`; the hover
  pair stays per session.
- State: `hovered` (per session) and `selected: Element | null` (module-level).
  `paint()` draws the hover box from `hovered` and the selection box from
  `selected`, both, always. Off-canvas pointer hides only the hover pair.
- `onDown`: ignore `event.button !== 0`. Set `selected = picked` synchronously
  before calling `report()`, and repaint, so the box moves on the click itself.
  If `anchorOf(picked)` equals the anchor of the current `selected`, pulse the
  selection box (a 250 ms outline animation via a class the overlay stylesheet
  defines; respect `prefers-reduced-motion` by skipping the animation) and still
  post the selection, with `repeat: true`.
- `report()`: keep building `chain` (now keyed by anchor, value the host node),
  never null the selection. Fill `where` per link with `getSource(link.node)`
  in the same `Promise.all` that resolves the element's own source; cap at the
  chain length.
- `highlightTarget(key)`: moves the selection box to `chain.get(key)` when
  found, back to the picked node when `key` is null or unknown. `close()` no
  longer clears `chain` or `selected`; a `rebuilt` message clears both (the app
  already disarms on rebuild; add a `clearSelection()` export called from
  `preview/entry.tsx` when the hot-reload path fires, see `preview/hot.ts`).
- `nameOf(element)`: the nearest link's `name` first, then `componentName`,
  then the tag, formatted `Headline` / `Headline · div` rather than
  `<Interactive.Div>.div`. Reuse `componentAt` and read `name` from the same
  controls object.
- Post `repeat: boolean` on the selection message.

### 5. `preview/entry.tsx`

- Wrap the hot-reload callback so a rebuild calls `clearSelection()` before the
  page reloads or re-renders; the app side already handles `rebuilt`.

### 6. `lib/studio/preview.ts`: schema

- `TuningTarget` gains `name: Schema.NullOr(Schema.String)` (decoding default
  `null`), `instanceId: Schema.String` (default `""`), `ordinal: Schema.Int`
  (default `1`), `instances: Schema.Int` (default `1`), `where:
  Schema.NullOr(Schema.Struct({ column: NullOr(Int), file: NonEmptyString,
  line: NullOr(Int) }))` (default `null`). Use `Schema.withDecodingDefault` on
  each so an older compiled page decodes.
- The `selection` message gains `repeat: Schema.Boolean` with default `false`.
- Mirror the fields in `preview/bridge.ts` types only where the page reads them.

Tests (`lib/studio/preview.test.ts`): a selection from an older page (no
`name`, `instanceId`, `repeat`) decodes with the defaults; a full one decodes.

### 7. `hooks/use-inspect.ts`

- `sameElement(card, targets)` compares `instanceId` when both sides carry a
  non-empty one, and falls back to `targetId` otherwise (older page).
- A selection with `repeat: true` is ignored entirely: no revert, no reopen.
- The abandon-on-switch behaviour is unchanged in this spec (spec 02 changes it).
- `useEffect` that sends `highlightCommand(openTargetId)` keeps its shape; the
  key it sends is the open target's `instanceId` when present, else `targetId`
  (`highlightTarget` on the page accepts an anchor key).
- Markers: drop the `if (!isArmed) setDrawn([])` in the arm effect so Add's
  markers outlive disarm; `components/studio/preview-pane.tsx:119-127` mounts
  `InspectOverlay` when `inspect.card !== null || inspect.markers.length > 0`,
  not only while armed. The overlay is `pointer-events-none`, so clicks are
  unaffected.

Tests (`hooks/use-inspect.test.tsx`): rename `:409` "leaves a second click on
the same element alone" to "on the same instance" and drive it with a selection
carrying `repeat: true`; add "opens a sibling instance rendered from the same
call site" (same `targetId`, different `instanceId`: the card changes); add
"keeps markers when the mode is turned off". Fixtures gain `instanceId`,
`ordinal`, `instances`, `name`, `where`.

### 8. `lib/studio/tuning.ts` and the pane

- `titleOf(target: TuningTarget): string` returns `name ?? chainLabel(componentName)`.
- `subtitleOf(target, owner: TuningTarget | null, cwd)` returns
  `${chainLabel(target.componentName)} in ${owner.name ?? chainLabel(owner.componentName)} · ${relative where}`,
  where `owner` is the next link outward in the chain, or just the location when
  there is none. Reuse `relativeTo` from `lib/studio/activity.ts`.
- `components/studio/props-pane.tsx`: `PaneTitle` renders `titleOf`; the
  path line becomes `subtitleOf`; a badge `2 of 4` (mono, muted) sits beside
  the title when `instances > 1`; `TargetChain` chips render
  `name ?? chainLabel(componentName)` with `title={componentName}`.
- `components/studio/inspect-overlay.tsx`: no change beyond the mount condition.

Tests (`lib/studio/tuning.test.ts`): `titleOf` with and without a name;
`subtitleOf` with an owner, without, and with no source. A rendering test for
`PropsPanel` (`components/studio/props-pane.test.tsx`, Testing Library) that
checks the title reads the name, the badge appears only for `instances > 1`,
and chips read names.

## Acceptance in the running app

The owner runs the app; the implementer lists these for them.

1. Open `remocn-vidrush-sponsor`, pause in scene 3 (frames 138-233), arm
   Inspect. Hover a claim line: the hover label reads `Pushed line · div`, not
   `<Interactive.Div>.div`.
2. Click "One brief in.": a solid box stays on that line while the pointer keeps
   moving over the canvas; the pane title reads `Pushed line`, the badge reads
   `1 of 4`, the subtitle names WordPush and its file:line.
3. Click "Publish-ready": the solid box moves, the badge reads `2 of 4`, the
   pane re-renders for the new line. Nothing is silently ignored.
4. Click "Publish-ready" again: the box pulses, nothing else changes.
5. Turn Inspect off: the solid box and any Add markers stay on screen.
6. In `remocn-test-props`, the `<Series>` chip no longer appears in the chain.

## Out of scope

Per-path resets, the "Shared by N" label, rebinding after remount, the toast on
switch (spec 02). Frame readout and replay (spec 03). Picker hit-testing (spec
04). Text and typography fields (spec 05).

## Verification

`bun run check`, `bun run typecheck`, `bun run test`. Then `bun run changeset`.
Update the CLAUDE.md paragraphs under "Pointing at an element, and commenting on
it" that describe `highlightTarget` painting `hovered ?? pinned` and the pane
title, since both change here.
