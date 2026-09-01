# REM-6 props panel implementation plan

## 1. Lock the interactivity contract

- Update the bundled Remotion authoring guidance so nested tunable scenes and
  transition wrappers use `InteractivitySchema`, `Interactive.withSchema()`, and
  pass `controls` to their `<Sequence>`; keep Zod for composition input props.
- Add one template fixture with two instances of the same interactive component
  and fields covering primitives, enum variants, transforms, coordinates, and
  arrays. Use it for unit and browser smoke coverage.
- Run the skill/template synchronization checks before touching runtime code so
  the new convention cannot drift between bundled copies.

## 2. Define serializable tuning contracts

- Add shared tuning field descriptors and structured `{path, from, to}` changes
  in `shared/ipc.ts`. Keep mounted-target identity in Preview-only message types,
  separate from `PromptElement` and persisted agent data.
- Extend `lib/studio/preview.ts` and `preview/bridge.ts` with Effect Schema-backed
  selection metadata, `tune.set`, `tune.reset`, and `tune.result` messages.
- Add constructors and decoders for the commands, exhaustive type narrowing, and
  tests in `lib/studio/preview.test.ts` and `shared/ipc.test.ts` for malformed
  fields, invalid values, and stripping ephemeral identity.

## 3. Build field normalization and codecs

- Add a pure Preview-safe module that flattens the active enum variant and
  converts Remotion `InteractivitySchema` fields into serializable groups.
- Implement value validation and round-trip codecs for numbers, booleans,
  colors, enum discriminants, CSS/degrees rotation, translate, scale,
  transform-origin, UV coordinates, and supported primitive arrays.
- Preserve units and original scalar-versus-pair representations. Enforce
  number bounds/steps and array length constraints without silently clamping an
  invalid draft.
- Unit-test every supported field, active-variant changes, dot paths, defaults,
  unknown future types, and stable diff generation.

## 4. Enable Remotion interactivity inside the Player

- Add a small adapter used by `preview/entry.tsx` that preserves the Player
  environment while enabling the Studio branch used by
  `Interactive.withSchema()`.
- Supply synthetic override-ID-to-node-path mappings and bridge updates to the
  sequence manager's drag override setter. Keep the adapter behind a capability
  check for the pinned Remotion runtime.
- Track mounted interactive Sequences and their outline refs. Resolve the
  closest registered sequence for the DOM element selected in
  `preview/inspect.ts`, including nested sequences.
- Clear the registry and overrides on unmount/rebuild. Return explicit stale or
  unsupported acknowledgements instead of throwing across `postMessage`.
- Add jsdom tests for registration, nearest-sequence resolution, duplicate
  component instances, nested controls, set/reset, unmount, and stale IDs.

## 5. Connect Inspect state to live Preview updates

- Extend `hooks/use-inspect.ts` to open a tunable draft when the selection event
  contains tuning metadata and preserve today's comment-only path otherwise.
- Add a request coordinator that coalesces slider/drag traffic to one command
  per animation frame, correlates acknowledgements, and ignores obsolete
  responses.
- Extend `hooks/use-selections.ts` with persistent structured changes plus local
  runtime target state. Add update/reopen/reset operations and strip target IDs
  during restore or conversation serialization.
- On rebuild, retain structured diffs, mark their runtime targets stale, and
  remove runtime-only references. On send, keep the visible override until the
  rebuild replaces it with code.

## 6. Implement the contextual inspector UI

- Refactor `components/studio/inspect-overlay.tsx` into the existing compact
  comment card and an expanded 320–360 pixel tunable card rather than adding a
  global panel.
- Add accessible field components for all supported descriptors: bounded and
  unbounded number input, switch, color input, select, transform pair/unit
  controls, UV pair, and constrained primitive array rows.
- Group fields using schema/source metadata; show changed rows, per-row reset,
  Reset all, validation messages, and stale/unsupported notices.
- Make `Cancel` restore originals and close; make `Add` preserve the runtime
  result and add the structured diff. Disable `Add` while any field is invalid
  or a required acknowledgement failed.
- Update `components/studio/selection-row.tsx` so a tuned selection shows the
  component and change count, can reopen its inspector, and displays
  `Preview changed` after rebuild. Removing it sends a best-effort reset.
- Cover keyboard operation, focus restoration, small Preview layout, array
  limits, enum-dependent fields, live feedback, reset, cancel, add, and reopen
  with Testing Library.

## 7. Send structured changes to the agent

- Extend the persistent selection shape used by the composer with tuning changes
  while retaining backwards compatibility for plain `PromptElement` entries.
- Update `sidecar/agent/prompt.ts` to append component/call-site context and a
  deterministic `Requested changes` block containing each path, original value,
  and requested value.
- Ensure queueing, history restore, retries, and prompt construction retain the
  structured changes but never serialize request IDs or runtime target IDs.
- Add focused prompt and IPC tests for mixed plain/tuned selections, nested dot
  paths, arrays, colors, and empty diffs.

## 8. Verify end to end

- Run focused Vitest suites after each layer, then `bun run test`,
  `bun run typecheck`, `bun run sidecar:build`, `bun run skills:check`, and
  `bun run check`.
- In the browser fixture, select one of two identical component instances and
  verify every supported control rerenders only that instance. Exercise Cancel,
  Add, reopen, chip removal, stale state after rebuild, and the no-schema
  comment-only fallback.
- Submit a tuned selection to the agent, verify the generated TSX changes the
  intended call site, and confirm the rebuilt Preview matches the last live
  override before clearing it.
- Add a changeset describing live schema-driven Preview tuning and note that raw
  `TransitionSeries.Transition` factory arguments remain outside version one.
