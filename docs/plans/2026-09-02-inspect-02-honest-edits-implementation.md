# Spec 02: edits are honest and land where they say

Part of `docs/plans/2026-09-02-inspect-00-overview.md`; read its ground rules
first. Design record: `docs/plans/2026-09-02-inspect-usability-design.md`,
plan item 2. Effort M. Depends on spec 01 (anchors, `instanceId`, `name`,
`instances`).

## Goal

After this spec, a `tune.set` that answers `ok` has changed pixels, and one that
cannot says why. A component remounted by the Player (loop, scrub across a
scene boundary) keeps receiving the pane's overrides. Reverting one card can no
longer undo what another card already Added. A switch that reverts unsent edits
says so, with Undo. The block the agent receives names which component owns
each requested change. The pane says when an edit reaches several instances at
once.

Complaint addressed: 3, plus the "silently switches" half of 1.

## What is wrong today, with the code that does it

- **Stale ids answer `ok`.** `preview/interactivity.tsx:65-72` `controlsFor`
  falls back to the `seen` cache; `set` (`:129-158`) validates against it and
  replays onto `remocn.<id>` (`:74-89` `nodePathFor`). A `withSchema` component
  on Remotion 4.0.481 is not registered for stack injection (`node_modules/remotion/dist/cjs/Interactive.js:77`
  registers only `makeInteractiveElement` wrappers; `:88` exposes the bare
  `withInteractivitySchema`), so its `overrideId` is `String(Math.random())` per
  mount (`with-interactivity-schema.js:133-137`). `Series.Sequence` unmounts its
  children outside its window (`Sequence.js`), so playing through the loop or
  scrubbing away and back mints a new id that maps to nothing; Remotion reads
  `overrideIdToNodePathMappings[overrideId]` on every render
  (`with-interactivity-schema.js:146`) and finds no path. Nothing changes, no
  refusal.
- **One nodePath per shared id.** `Interactive.*` primitives from one JSX call
  site share one `overrideId`, so an override on one instance is read by every
  instance (`with-interactivity-schema.js:173` `getDragOverrides(nodePath)`).
  Remotion's model; the pane just has to say so.
- **Wholesale resets.** `hooks/use-inspect.ts:102-113` `abandon` and `:276-292`
  `resetTuning()` send `tuneResetCommand(target, [])` per target of the chain,
  and `preview/interactivity.tsx:170-171` deletes the whole draft for a target
  on `[]`. A `CameraRig` that frames every scene is in every chain, so cancelling
  card B undoes the camera change card A already Added.
- **Only one link is stored on Add.** `submitComment` (`:217-229`) sends
  `changesOf(open)` across all targets but stores `target: open.tuning` only;
  `resetSelection` (`:365-377`) resets only that link.
- **`openTarget` (`:325-333`) writes state but not `cardRef`**, while
  `changeTuning`/`resetTuning`/`submitComment` read `cardRef`.
- **`rebuilt` (`:145-150`) clears the card without resetting**, so overrides
  accumulate in the outer `SequenceManagerProvider` (`preview/entry.tsx:33-44`)
  for the page's life.
- **The comment textarea survives a switch** (`components/studio/props-pane.tsx:56-69`
  is not keyed; `hooks/use-comment.ts` keeps its own state).
- **The agent gets an unattributed list.** `shared/ipc.ts:219-223` `TuningChange`
  is `{from, path, to}`; `sidecar/agent/prompt.ts:40-46` prints one flat
  "Requested changes" under the clicked node's `component:`; the conventions
  (`sidecar/claude/conventions.ts:141-147`) say to edit that component.

## Step 0: measure before designing the ordinal

Log `controls.overrideId` per mounted `Interactive.Div` instance across a
Player loop and a seek-bar scrub in the running app (the owner runs it; write
the one-line `console.log` in `preview/interactivity.tsx` `selectedTargets`,
behind a `window.remocn_debug` flag, and ask). If ids for one call site diverge
between render passes, the registry below already tolerates several live ids
per anchor; spec 01's "2 of 4" must then count same-anchor-base instances by DOM
order rather than by id. Record the answer in the PR.

## Changes

### 1. `preview/timing.ts` (new): the element's window

`windowOf(node: Element): { from: number; until: number } | null`. Walk
`fiber.return` from the node (`preview/fiber.ts` `fiberOf`), summing every
finite numeric `memoizedProps.from` (that is what `useCurrentFrame()` inside
nested `<Sequence>`s is relative to: `Sequence.js` computes
`cumulatedFrom + from`); `until` is `from + min(firstFiniteDurationInFrames, 60)`
where the duration is the first finite `memoizedProps.durationInFrames` found
walking outward, or 60 when none is finite. Return `null` when no Sequence-like
fiber is found. Add the `tauri.conf.json` resource entry. Tests with fake fibers
(the shape `preview/fiber.test.ts` already uses): nested froms sum, an infinite
inner duration defers to the outer one, no Sequence gives `null`. Spec 03 posts
this on the selection; here it feeds the refusal sentence.

### 2. `preview/interactivity.tsx`: a registry keyed by anchor, rebound on every registration

Replace `mappings` state, `nodePathFor`, `seen` and `controlsFor` with:

- `targets: Map<string, TargetEntry>` (a ref), where
  `TargetEntry = { anchor: string; componentName: string; live: Set<string>; nodePath: NodePath; window: { from: number; until: number } | null }`.
  `nodePath` is minted once per anchor (`remocn.<n>`).
- `selectedTargets(element)` (spec 01 already computes `instanceId` = anchor
  per link) creates or reuses the entry per link, sets `live` to the link's
  current `overrideId`, and records `windowOf(link.node ?? element)`.
- **Rebind effect**: `useEffect` on `interactive` (the `sequences` array from
  `Internals.SequenceManager`, already read at `:51`). For each entry:
  `node = resolveAnchor(entry.anchor, canvas)` (cache the node per anchor and
  re-resolve only when `!node.isConnected`); if `null`, `live` becomes empty.
  Otherwise candidates are sequences with `controls` whose
  `controls.componentName === entry.componentName` and whose
  `refForOutline?.current` is `node` or contains `node`; when every candidate's
  ref is `null`, fall back to `controlsChain(node)` and take the link whose
  `componentName` matches. Pick the deepest candidate (its ref node is contained
  by every other candidate's). `live` becomes that id (plus any other candidate
  that also contains the node and shares the name, for the step-0 case). Then
  rebuild the mapping object `{ [overrideId]: nodePath }` from every entry's
  `live`; call `setMappings` only when the set of keys or their paths changed
  (`sequences` re-registers every frame while a primitive animates, so this
  effect must not churn renders). When a `live` set gained an id and the entry
  has a draft, `replay(entry)` so the remounted instance reads the draft on its
  next render.
- `controlsFor(anchor)`: the first registered sequence whose `overrideId` is in
  `live`, else `null`. No cache.
- `set`/`reset` take the anchor as `targetId`. When `controlsFor` is `null`,
  answer `{ ok: false, error }` with
  `This element is not on screen at frame ${frame()}.` followed by
  ` ${componentName} runs from frame ${from} to ${until}.` when the window is
  known. `InteractivityRuntime` gets a `frame: () => number` prop from
  `preview/entry.tsx` (`player.current?.getCurrentFrame() ?? 0`).
- `drafts` keyed by anchor. Validation uses the live controls' schema and the
  clicked link's own values (`valuesFor(controls)` as today).
- `clear()`: exported through `TuningRuntime` (`preview/tuning-runtime.ts`);
  deletes every draft, calls `setters.clearDragOverrides(nodePath)` and
  `setters.setPropStatuses(nodePath, () => emptyStatuses)` for every entry, and
  empties the registry. `preview/entry.tsx` calls it from the hot-reload path
  (beside spec 01's `clearSelection()`).
- Delete `nearestInteractive` usage only if nothing else reads it; keep the
  function and its tests otherwise.

Tests: a new `preview/interactivity.test.tsx` (jsdom, React Testing Library,
rendering `InteractivityRuntime` inside fake `SequenceManager` and setters
contexts) that: registers a target, swaps the sequence's `overrideId`, and
asserts the mapping follows and the draft is replayed onto the same nodePath;
answers `ok: false` with the frame sentence when the anchor no longer resolves;
`clear()` empties overrides. If the contexts prove too heavy to fake, extract
the rebinding into a pure `rebind(entries, sequences, resolve)` in
`preview/tuning.ts` and test that instead; the effect then only wires it.

### 3. `lib/studio/preview.ts` and `preview/bridge.ts`

- `TuningTarget.targetId` is now the anchor (documented in the schema comment
  that exists for `TuningField.targetId`). No shape change on the wire beyond
  what spec 01 added; `highlight`, `tune.set` and `tune.reset` carry the anchor.

### 4. `hooks/use-inspect.ts`

- `changedPaths(card): Map<targetId, string[]>` (pure, in `lib/studio/tuning.ts`
  beside `byTarget`), derived from `changesOf`.
- `abandon(card)`: for each target with changed paths, `tuneResetCommand(target, paths)`;
  never `[]`. When at least one path was reverted, raise a toast
  `Reverted ${n} changes on ${titleOf(card.targets[card.open])}` with an
  **Undo** action, following the `toastManager` pattern in
  `hooks/use-library.ts:493-509`. Undo re-sends `tuneSetCommand` for every
  reverted `{target, path, value}` (values from the abandoned card's fields) and
  restores that card as the open card. The toast belongs in the hook (a
  `useToastUndo` helper if the library's pattern is reusable; otherwise inline
  in `useInspect`).
- `resetTuning()` with no paths and `cancelComment`: per target, its changed
  paths only.
- `openTarget(index)`: compute `next` from `cardRef.current`, write
  `cardRef.current = next`, then `setCard(next)`.
- `submitComment`: store the whole chain. `hooks/use-selections.ts`
  `SelectionTuning` becomes `{ open: number; originals: Record<targetId, Record<path, TuningValue>>; targets: readonly TuningTarget[] }`.
  `resetSelection(index)` resets, per stored target, the paths whose stored
  field value differs from the stored original; `openSelection(index)` reopens
  the whole chain at `open`.
- `rebuilt`: before clearing, send `tuneResetCommand(target, changedPaths)` for
  every target of the open card, then clear as today.
- Refusal per row: `requests.current` stores `{ before, path, targetId }`; a
  failed `tune.result` sets `tuningRefusal` to `{ message, path, targetId }`
  (type changes from `string | null`). Any later `ok` for the same target and
  path clears it; an `ok` for a different path does not.

Tests (`hooks/use-inspect.test.tsx`): "reverts what was pending on the element
it left" becomes "reverts only the paths this card changed, and offers Undo";
add "keeps a change Added from another card on a shared ancestor when this card
is cancelled" (two chains sharing a `CameraRig` target: Add on A, edit and
Cancel on B, assert no reset reached the camera's Added path); "Undo restores
the reverted card and re-sends its values"; "a refusal names its row and
survives an ok on another row"; "removing a chip resets every link the message
carried"; "a rebuild resets what was live before closing". Rename `:311`
"resets every target, not only the one on screen" to "resets every changed path
in the chain" and adjust its assertions.

### 5. The pane

- `components/studio/props-pane.tsx`: under the title, when
  `card.tuning.instances > 1`, a muted xs line
  `Shared by ${instances} · a change here moves all of them`.
- `PropsPane` keys `PropsPanel` on `card.targets.at(0)?.instanceId`, so the
  comment draft and the focus effect restart per element.
- `TuningRow` (`components/studio/tuning-controls.tsx`) takes
  `refusal: string | null` and renders it under the row in `text-destructive`
  xs with `role="alert"`; the footer line stays only for a refusal with no path.

Tests: `components/studio/props-pane.test.tsx` gains the shared line and the
per-row refusal.

### 6. The agent block

- `shared/ipc.ts`: `TuningChange` gains
  `owner: Schema.optionalKey(Schema.Struct({ component: Schema.NonEmptyString, file: Schema.NullOr(Schema.NonEmptyString), line: Schema.NullOr(Schema.Int), name: Schema.NullOr(Schema.String) }))`.
  Optional so stored turns decode.
- `hooks/use-inspect.ts` `changesOf` fills `owner` from the target's
  `componentName`, `name` and `where` (spec 01).
- `sidecar/agent/prompt.ts` `describe`: group changes by owner, in chain order:
  `Requested changes on WordPush ‹Pushed line› (components/WordPush.tsx:243):`
  then `- path: from → to` lines; changes without an owner print under the
  existing flat heading.
- `sidecar/claude/conventions.ts` element paragraph (`:141-147`): append
  "Requested changes are grouped by the component that owns each one, with its
  file and line; edit that file, not the element the token names, when they
  differ." Update `sidecar/claude/conventions.test.ts` if it pins that
  paragraph.

Tests: `sidecar/agent/prompt.test.ts` grouping and the no-owner fallback;
`shared/ipc.test.ts` decodes a change without `owner`.

## Acceptance in the running app

1. `remocn-vidrush-sponsor`: pick a claim line, open the WordPush chip, scrub
   into scene 4 and back (the scene remounts), drag Drive easing. Either the
   line re-times when scene 3 plays, or the pane says
   `This element is not on screen at frame N. WordPush runs from frame 138 to 198.`
   Never a silent `ok`.
2. Pick the same line, edit the CameraRig chip's zoom, Add. Pick another line,
   edit anything, Cancel. The camera stays zoomed.
3. Edit two fields on a line, click another line: a toast says
   `Reverted 2 changes on Pushed line`; Undo puts them back and reopens the
   first line.
4. `remocn-test-props`: pick one readout, the pane says `Shared by 3 · a change
   here moves all of them`; dragging Opacity dims all three, as the line says.
5. Add with a change on the ClaimScene chip; in the composer's chip, the
   element block reads `Requested changes on ClaimScene (…ClaimScene.tsx:…)`.

## Out of scope

Frame readout, replay and the animated-field marker (spec 03). Pending rows
instead of a toast (deferred; the toast is v1). Per-instance overrides of a
shared primitive: impossible through Remotion's contexts, which is why the
"Shared by N" line exists.

## Verification

`bun run check`, `bun run typecheck`, `bun run test`, `bun run changeset`.
Update CLAUDE.md "Tuning what you pointed at": the paragraph about
`nearestInteractive`/`refForOutline` and "the runtime remembers the controls of
everything selected" describes the `seen` cache this spec deletes.
