# Spec 05: text and type become real fields

Part of `docs/plans/2026-09-02-inspect-00-overview.md`; read its ground rules
first. Design record: `docs/plans/2026-09-02-inspect-usability-design.md`,
plan item 5 and the "Text and type" decision. Effort M in two halves: 05a
(the pane) S, 05b (the pin and the Upgrade row) M with one live gate. 05a
depends on spec 01 (for the request-only row's owner); 05b depends on spec 02.

## Goal

On a project running Remotion 4.0.513 or newer, clicking a text element shows
Typography (size, weight, colour, letter spacing, line height, family, align)
and a Text field, every one of them live. On an older Remotion the same click
shows a Text row that is honest about not being previewed and still reaches
the agent. New projects scaffold on 4.0.520. An existing project gets an
Upgrade button in the environment checklist and is never upgraded silently.

Complaint addressed: 4.

## Facts the implementer needs

- Remotion 4.0.481 (`node_modules/remotion/dist/cjs/Interactive.js:43-46` in
  the videos project) registers every `Interactive.*` element with
  `baseSchema + transformSchema` only, and `interactivity-schema.d.ts` has no
  string field type. Nothing typographic can exist on a primitive there.
- Remotion 4.0.513 and later add `textSchema` (`style.color`, `style.fontFamily`
  as `font-family`, `style.fontSize`, `style.lineHeight`, `style.fontWeight` as
  an **enum of strings** `'100'…'900'`, `style.fontStyle`, `style.textAlign`,
  `style.letterSpacing` as a **number**) and `textContentSchema` (a `children`
  field of type `text-content`) to every text tag (`Interactive.Div`, `Span`,
  `P`, `H1`…). Verified in the packed 4.0.520 (`Interactive.js:73-77,
  145-202`, `interactivity-schema.js:50-126`). Field types added: `text-content`,
  `font-family`, `asset`, `remotion-captions`. The `children` override reaches
  the pixels through the same drag-override path the studio runtime already
  drives; `mergeValues` writes one-part keys straight onto props.
- 4.0.520 also registers `withSchema` components for stack injection
  (`Interactive.js:104-108`) and keys ids on `studio-original://file:line:col`
  (`@remotion/bundler` `setup-sequence-stack-traces.js:49-60`), so the agent's
  own components become per-call-site keyed after an upgrade. Spec 02's
  registry is what makes that safe.
- The pane whitelists eleven field types (`preview/tuning.ts:200-212`) and
  drops the rest in silence (`:368-374`); `isFieldValue` (`:282-300`) also
  drops a value that does not match its declared type, which is how
  `fontWeight: 800` (a number the agent writes) and `letterSpacing: "-0.03em"`
  would vanish against 4.0.520's declarations. `TYPOGRAPHY` (`:223-224`)
  matches `style.`-prefixed paths only, so a component's bare `fontSize` lands
  under Parameters.
- The template pins 4.0.481 (`templates/remotion/package.json`). The
  environment checklist's `remotion` row (`sidecar/environment.ts:72-103`)
  only says the project is a Remotion project; `EnvironmentFix`
  (`shared/ipc.ts:576-590`) has `install`, `node`, `command`, `provider`.
  `project.install` (`sidecar/handlers.ts:564`) streams `installDependencies`
  from `sidecar/scaffold/install.ts`; the package manager comes from
  `pmOf(root)` (`sidecar/package-manager.ts`).

## 05a: the pane learns the fields

### 1. `preview/tuning.ts`

- `FieldType` and `SUPPORTED` gain `"text-content"` and `"font-family"`.
- `TuningField` gains `readOnly: boolean` (default `false`).
- `isFieldValue`: `text-content` and `font-family` accept a string.
- `descriptorOf` coerces instead of dropping:
  - An `enum` field whose value is a number: when `String(value)` is one of
    the options, the descriptor's `value` becomes that string (the override
    sent back is the string, which is what the schema declares).
  - A `number` field whose value is a unit string (`/^-?\d+(\.\d+)?[a-z%]+$/i`,
    the agent's `"-0.03em"`): a `readOnly` descriptor of type `text-content`
    carrying the string, labelled by the field, so the row reads
    `Letter spacing  -0.03em` and cannot be dragged. The codegen rule in spec
    06 asks for numbers here; this keeps the row visible until then.
  - A `text-content` field whose runtime value is not a string (4.0.520's
    `getRuntimeValueForSchemaKey` yields `undefined` for split children): a
    `readOnly` descriptor whose value is `""` and whose description is
    `Text is built from parts — ask in words`.
  - Any other value that fails `isFieldValue`: a `readOnly` descriptor of type
    `text-content` with `JSON.stringify(value)` as the value and description
    `value in code`.
- `groupOf`: `TYPOGRAPHY` also matches bare
  `^(color|fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|textAlign|fontStyle)$`;
  `FILL` also matches `backgroundColor`; `children` of type `text-content`
  groups under `Typography` and sorts first inside it.

Tests (`preview/tuning.test.ts`): each coercion; the split-children case; the
new groups.

### 2. `lib/studio/preview.ts` and `preview/bridge.ts`

- `TuningFieldType` gains the two literals; `TuningField` gains
  `readOnly: Schema.Boolean` with decoding default `false`.
- The `selection` message gains `fonts: Schema.Array(Schema.String)` (default
  `[]`) and `text: Schema.NullOr(Schema.String)` (default `null`).

Tests (`lib/studio/preview.test.ts`): older selections decode; a field with
`readOnly` decodes.

### 3. `preview/inspect.ts`

- On selection, post `fonts`: the unique `family` values of `document.fonts`
  (`[...document.fonts].map((face) => face.family)`), and `text`: when the
  innermost link's host node has exactly one child node and it is a non-empty
  text node, its `data`, else `null`.

### 4. Controls

- `components/studio/tuning-controls.tsx`: `text-content` renders a
  `Textarea` (the shadcn/Base UI one already used by the pane) with two rows,
  every change through `onChange(path, value)` (the hook already coalesces
  per animation frame); `font-family` renders an `Input` with a `<datalist>`
  of the selection's `fonts` (pass them down from the card); a `readOnly`
  descriptor renders the value as text in the field's surface with no control
  and the description under it. Keep `noJsxPropsBind`: handlers read the
  path from `data-path` on the element, as the existing rows do.
- Add `fonts` to `PendingComment` in `hooks/use-inspect.ts` from the selection.

Tests: `components/studio/tuning-controls.test.tsx` (create if absent):
typing in the Text control calls `onChange` with the path; the read-only row
renders no input.

### 5. The request-only Text row

- `hooks/use-inspect.ts`: `PendingComment` gains
  `text: { draft: string; from: string } | null`, filled from the selection's
  `text` **only when** the innermost target has no live field whose path is
  `children` and type `text-content`. `changeText(value)` updates the draft
  without any `tune.set`. `changesOf` appends
  `{ from, path: "children", to: draft, owner }` when the draft differs.
  `originals` are rebased on Add as for every other field.
- `components/studio/props-pane.tsx`: when `card.text !== null`, a `Text`
  section above Typography with a textarea and the muted line
  `sent to Claude, not previewed`; hidden when the live field exists.

Tests (`hooks/use-inspect.test.tsx`): the row exists only without a live
`children` field; the change rides `tuningChanges` with `path: "children"`;
Add rebases it.

## 05b: the pin and the Upgrade row

### 6. Gate: see it work before moving the pin

The implementer cannot run the app; the owner does. Prepare a scratch copy
of the videos project bumped to 4.0.520 (`cp -R` into the scratchpad, edit
`package.json`, `bun install`), then ask the owner to open it in the running
studio and confirm, in this order: the preview compiles; `controls` is
non-null on an `Interactive.Div` (a click opens a pane with a Typography
group); dragging `style.fontSize` on an `Interactive.Div` changes pixels;
typing in `Text` changes the frame; a snapshot still is byte-identical to
`npx remotion still` on the same frame from the same copy. The `preview/interactivity.tsx`
`SequenceControls` type gains the optional fields 4.0.520 adds so
`asControls` keeps accepting both versions. The pin does not move until every
line above is confirmed; record the result in the PR.

### 7. The template

- `templates/remotion/package.json`: `remotion` and every `@remotion/*` to
  `4.0.520`. If a lockfile is vendored beside it, regenerate it the way the
  scaffold's install does; otherwise leave the scaffold to produce one.
- `sidecar/scaffold/template.test.ts`: pin that every `@remotion/*` and
  `remotion` in the template manifest share one version and that it is at
  least `4.0.513`.

### 8. The environment row and its fix

- `shared/ipc.ts`: `EnvironmentFix` gains
  `{ packages: Schema.Array(Schema.NonEmptyString), type: Schema.Literal("upgrade"), version: Schema.NonEmptyString }`.
  Add a sidecar method `project.upgrade` to `SIDECAR_METHODS`: params
  `{ packages, projectId, version }`, stream chunk the same `install` line
  shape `project.install` streams, result `{}`. Mirror in `src-tauri/src/ipc.rs`
  only if the Rust mirror enumerates fix types or methods (check; the frame
  envelope keeps `method` a plain string). Bump `SIDECAR_PROTOCOL`.
- `sidecar/environment.ts` `remotionRow`: parse the declared range (strip a
  leading `^`, `~`, `>=`; give up on anything else and stay `ok`). Below
  `4.0.513`: `state: "warn"`, title
  `Text and type editing needs Remotion 4.0.513 or newer`, detail naming the
  version found and that the properties pane cannot edit text, weight, size or
  colour on it, `fix: { packages: [every @remotion/* the manifest declares, plus remotion], type: "upgrade", version: "4.0.520" }`.
  `warn` does not lock the composer (only a failed login does).
- `sidecar/scaffold/install.ts`: `upgradeDependencies(root, packages, version, onLine)`
  running the manager `pmOf(root)` names: `bun add`, `npm install`, `pnpm add`,
  `yarn add`, each with `name@version` arguments, in the lockfile's directory
  the way `installDependencies` does, streaming lines.
- `sidecar/handlers.ts`: `project.upgrade` resolves the project, runs
  `upgradeDependencies`, then answers; the webview rechecks afterwards the way
  it does after `project.install`.
- `hooks/use-environment.ts` and `components/studio/environment-checklist.tsx`:
  render an `Upgrade Remotion` button for `fix.type === "upgrade"`, run the
  method with the same progress surface the Install button uses, recheck on
  completion. The button never runs without a click.

Tests: `sidecar/environment.test.ts` (row states for `4.0.481`, `^4.0.513`,
`4.0.520`, an unparseable range); a new `sidecar/scaffold/install.test.ts` for the
argument shapes per manager (inject the spawn function so the test asserts on
the command and arguments without running anything; no such test exists yet);
`shared/ipc.test.ts` decodes the new fix; a checklist rendering test for the
button.

## Acceptance in the running app

1. On the scratch 4.0.520 copy of the videos project: click the AskScene
   headline in `remocn-need-sponsor`. Typography shows Font size 104, Weight
   800 (an enum select), Colour; typing in Text changes the frame; Font
   family offers the loaded faces.
2. On the untouched 4.0.481 videos project: the same click shows a `Text` row
   labelled `sent to Claude, not previewed`; Add produces a `children:
   "…" → "…"` change in the element block.
3. The environment checklist for the 4.0.481 project shows the warning row with
   an `Upgrade Remotion` button; nothing happens until it is pressed; after
   it, the row turns green and step 1 holds on the real project.
4. `New project…` scaffolds on 4.0.520 and its first video opens with the
   Typography group on the title.

## Out of scope

A studio-owned CSS override layer for pre-4.0.513 projects (rejected for v1,
recorded in the design record). Silent upgrades. Writing typography into agent
schemas (spec 06).

## Verification

`bun run check`, `bun run typecheck`, `bun run test`, `bun run changeset`.
Update CLAUDE.md: the template pin sentence under "New projects", the field
list under "Tuning what you pointed at", and the environment checklist section
for the new row.
