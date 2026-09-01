# DialKit props panel UI implementation plan

## 1. Lock the DialKit dependency contract

- Add exact, compatible `dialkit` and `motion` versions to `package.json` and
  regenerate `bun.lock`. Do not depend on an unpinned advanced-component API.
- Import `dialkit/styles.css` once from `app/globals.css`, after the existing
  third-party style imports and before Remocn's overrides.
- Add a focused contract test that imports and renders the individual DialKit
  controls used by the adapter under React 19. Cover at least `Slider`,
  `Toggle`, `ColorControl`, `SelectControl`, `TextControl`, and
  `EasingVisualization`.
- Confirm that the package builds in Next.js 16 and that importing its client
  components does not enter the server component graph.

## 2. Add an isolated DialKit surface

- Add `components/studio/dialkit-surface.tsx`. Render a normal wrapper rather
  than `DialRoot`, supply `.dialkit-root`, and set `data-theme` from the current
  resolved Studio theme.
- Keep the wrapper inside `PropsPane` so DialKit CSS variables and descendant
  selectors cannot affect the composer, Preview, timeline, or app chrome.
- Key the surface by the selected tuning target identity. Changing selection
  must dispose of hover, editable-value, drag, and popover state from the
  previous component instance.
- Add a component test for light/dark theme propagation, remount on target
  change, and the absence of a DialKit portal or floating launcher.

## 3. Build pure value adapters

- Add `lib/studio/dialkit.ts` with pure, dependency-light conversion helpers.
  Keep representation conversion out of React event handlers.
- Define forward and reverse adapters for bounded numbers, percentages,
  booleans, colors, enum values, text, and numeric display units.
- Reuse `compositeOf`, `withAxis`, `bezierOfValue`, and the existing array
  metadata instead of adding a second parser for Remotion field values.
- Define stable ranges for structured values that have no schema bounds:
  rotation, translation, scale, transform origin, and UV coordinates. Base the
  range on the field type and original value, not the changing draft, so a
  slider does not rescale while it is being dragged.
- Every reverse adapter returns either an exact `TuningValue` or an explicit
  unsupported result. Never clamp or coerce a value into a different Remotion
  representation without surfacing it.
- Unit-test round trips, CSS units, zero and negative values, opacity percent
  display, scalar-versus-pair scale, UV tuples, enum options, invalid colors,
  bezier arrays, and unsupported future field types.

## 4. Replace scalar field controls

- Add `components/studio/dialkit-controls.tsx` as the presentation adapter.
  It receives a `TuningField`, its original value, and the existing `onChange`
  and `onReset` callbacks.
- Map bounded numeric fields and rotation degrees to DialKit `Slider`. Preserve
  the current unbounded numeric input as the fallback when no safe stable range
  can be derived.
- Map boolean, color, enum, and string fields to DialKit `Toggle`,
  `ColorControl`, `SelectControl`, and `TextControl` respectively.
- Preserve opacity's percent display while emitting its original 0–1 fraction.
- Keep the Remocn reset action adjacent to the DialKit row and retain its
  accessible label and hit area. Do not introduce DialKit presets or reset
  state.
- Route all committed values directly to `onChange(field.path, value)` so the
  existing animation-frame batching and preview acknowledgements remain
  unchanged.
- Update `components/studio/props-pane.test.tsx` to verify the new controls,
  callbacks, change count, per-row reset, Reset all, and rejected-value
  behavior.

## 5. Adapt composite and array fields

- Render translate, pair scale, transform origin, and UV values through a
  Remocn composite wrapper whose axis controls use DialKit's scalar visual
  treatment. Keep one parent field label and distinguish axes with accessible
  X/Y/W/H labels.
- Preserve each value's original unit and scalar-versus-pair shape through
  edits and resets. Fall back to the current text field if a CSS value cannot
  be parsed losslessly.
- Render primitive array items with DialKit scalar, toggle, color, select, or
  text controls as appropriate. Retain Remocn's Add/Remove actions and enforce
  `minLength`, `maxLength`, and `newItemDefault` before emitting a value.
- Test mixed positive and negative axes, percent and pixel units, one-value CSS
  forms, UV arrays, array item edits, and disabled Add/Remove boundaries.

## 6. Integrate easing without broadening the schema

- Use DialKit's easing visual language only where the current Remocn field can
  round-trip exactly. A cubic-bezier array may expose its four existing
  numbers and a DialKit curve visualization; an easing enum may show its known
  curve while still emitting only an allowed enum value.
- Do not expose DialKit's spring/easing mode switch or duration fields for a
  Remocn field that stores only a bezier or enum. Changing the data type would
  create a Preview value that `InteractivitySchema` rejects.
- Keep the existing interactive bezier handles as a fallback if DialKit's
  exported visualization is read-only. Restyle only the containing surface;
  do not sacrifice editing capability for visual similarity.
- Add a compatibility test that fails clearly if a future DialKit update
  changes the advanced easing component contract.

## 7. Finish the panel integration and CSS containment

- Replace `TuningRow` usage in `components/studio/props-pane.tsx` with the new
  DialKit-backed adapter while preserving the current group ordering, source
  line, scroll area, refusal message, comment editor, and footer actions.
- Add the smallest Remocn override layer required to make DialKit fit the
  existing right-pane width. Scope every override beneath a dedicated wrapper
  class; do not patch generic `button`, `input`, or root tokens.
- Verify DialKit popovers are not clipped by `ScrollArea` and do not render
  over the Preview unexpectedly. Preserve the current pane's layout when a
  long array or easing editor expands.
- Verify keyboard access, focus visibility, long and localized labels,
  reduced-motion behavior, and both Studio themes.

## 8. Regression and release verification

- Keep the existing `useInspect` and Preview protocol tests unchanged where
  possible; the UI replacement must not alter tune batching, acknowledgements,
  reset, Cancel, Add, stale targets, or structured AI diffs.
- Run focused tests for `lib/studio/dialkit.ts`, the DialKit surface and
  controls, `props-pane`, and `use-inspect` during development.
- Run `bun run check`, `bun run typecheck`, `bun run test`,
  `bun run sidecar:build`, and `bun run build` before completion.
- Perform a browser smoke test with two instances of the same interactive
  component. Tune each supported field, verify that only the selected instance
  changes, then exercise reset, Cancel, Add, selection switching, and rebuild.
- Update the existing props-panel changeset to mention the DialKit-backed UI
  without claiming DialKit presets, persistence, shortcuts, or Timeline.
- Remove an old control implementation only when no supported or fallback path
  imports it and its behavior is covered by the new tests.
