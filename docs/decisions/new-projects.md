# New projects

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`projects/project-lifecycle`](../../openspec/specs/projects/project-lifecycle/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`templates/remotion/` is a real Remotion project checked in here and mapped into the
bundle by `tauri.conf.json`; Rust resolves it the same way it resolves the preview entry
(source tree in debug, resource dir in release) and passes it as
`REMOCN_STUDIO_TEMPLATE_DIR`. The template declares nothing about which compositions
exist — see *Registering a video without touching `Root.tsx`*.

- **Two methods, because they fail differently.** `project.create` makes the folder and
  the row; `project.scaffold` streams `template` and `install`. The second is where the
  network is, so the chat is usable while `bun install` runs, and a failure leaves the
  project in place with a Retry.
- **Expansion never overwrites.** A file that already exists is skipped, which is what
  makes Retry safe once Claude has edited the scene. `package.json` is the one file the
  copy rewrites, to name the package after the folder — slugified, since npm names cannot
  hold spaces or capitals.
- **The linter has one exception for the template.** `useFilenamingConvention` is off
  under `templates/**`: every Remotion project has `src/Root.tsx`, and a scaffolded
  project spelled `root.tsx` would look wrong to anyone who has seen another one.
- **The pin is 4.0.520, and it moved on the owner's call rather than on the gate.** The
  properties pane needs 4.0.513 for text and type: below it, `Interactive.js` builds an
  element's schema from `baseSchema + transformSchema` alone, so no primitive anywhere can
  carry a font size, a weight or a colour — measured, and the reason a click on a real
  video's text opened a pane with nothing typographic in it. What the move is *not* backed
  by is a running Player: the four runtime claims — `controls` non-null on an
  `Interactive.Div`, a `style.fontSize` drag moving pixels, typing in `Text` moving the
  frame, a snapshot still staying byte-identical to `npx remotion still` — are still the
  owner's to confirm in the app, and until they are, a new project scaffolds onto a
  Remotion this studio has previewed only in pieces. What *was* checked first, against the
  real 4.0.520 installed in a scratch copy of the videos project: `textSchema` and
  `textContentSchema` are spread onto every text tag (`Interactive.js:75-82`); the controls
  object still carries exactly the four fields `SequenceControls` declares, so `asControls`
  needed no optional fields after all; every override seam the runtime drives
  (`setPropStatuses`, `clearDragOverrides`, `setDragOverrides`,
  `overrideIdToNodePathMappings`, `getDragOverrides`,
  `computeEffectiveSchemaValuesDotNotation`) is present; and `SUPPORTED` covers every field
  type 4.0.520 emits except `remotion-captions`, which has no control behind it. The video
  template typechecks against those real types — verified with a `tsc` run whose
  `node_modules` is that copy's.
- **`Interactive.H1` is not what the pin buys, and that is worth knowing.** The text tags
  exist on 4.0.481 too, so the template's `<h1>` could have been one all along and the
  change typechecks on both versions; what 4.0.520 adds is the *schema* behind them. The
  template's title therefore carries `name` and a matching `data-design-id` — the shape the
  conventions now ask of every agent-written text run — and `RisingText` takes the name as
  a prop rather than reaching for the one the `<Sequence>` already had.
