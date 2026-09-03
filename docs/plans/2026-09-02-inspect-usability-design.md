# Inspect and the properties pane: why it is unusable, and what to change

## The complaint

Four things, reported after building eleven videos in `remocn-news-videos`:

1. No feedback on a click. With the pane open, clicking another element either
   does nothing or silently switches.
2. The wrong element gets selected. Click on text, get "some div".
3. Editing a prop changes nothing visible. An easing appears, it is dragged, the
   frame stays the same.
4. No text controls. No way to change the text itself, its weight, colour or size.

## How this was measured

Seven readers, each over one subsystem (the picker, the pane's state machine, the
Remotion override runtime, the eleven generated videos, the conventions and skills,
Remotion Studio's own implementation, and a cold walkthrough of the UI), then a
skeptic per report that tried to refute every claim by re-reading the code, then
three independent solution sets from different lenses, then one synthesis. 118
claims survived; none were refuted outright, 24 were narrowed. Remotion 4.0.520 was
packed from npm and diffed against the project's 4.0.481. Where a mechanism could
be measured rather than read, it was: five `Interactive.Div` instances from one
call site were confirmed to share one `overrideId`, the hook was exercised in a
scratch Vitest suite, and the extended tunability scan was run over all eleven
videos.

The cutoff between "before" and "after" is `bb12ad9fe` (2026-09-01 17:18), the
commit that shipped the pane and its conventions. Before: saas-typography,
rush-led, test-animation, polish-landing, test-props, test-easing. After:
need-sponsor, tutorial, tutorial-2, sponsors, vidrush-sponsor.

## Root causes

Tags: **[ours]** studio code, **[structural]** the project's Remotion 4.0.481 cannot
express it, **[generation]** what the agent wrote.

### 1. No feedback on a click

- **[ours] A click on any sibling instance is discarded.** `hooks/use-inspect.ts:126`
  returns when `sameElement` matches, and `:444` compares only the innermost
  target's `targetId`, which is Remotion's `overrideId`. In the studio's preview
  (`sidecar/preview/host.ts:237` compiles with `environment: "development"`, which
  puts `@remotion/bundler`'s `setup-sequence-stack-traces` into the entry) every
  `Interactive.*` element rendered from one JSX call site shares one id:
  `with-interactivity-schema.js:138-143` keys it on the injected `stack` in a
  module-level map. Measured: 5 instances, 1 id. Every line rendered by a reused
  component (`RevealText`, `FadeLine`, `WordPush`) and every element inside a
  `.map()` is "the same element". Repro: remocn-test-props, click the "size"
  readout, then the "focus" readout (`SpecimenPanel.tsx:73-75`, one call site at
  `:96`). Nothing happens.
- **[ours] The selection box is the hover box.** `preview/inspect.ts:314` paints
  `hovered ?? pinned`, so the selected box is visible only while the pointer is
  off the canvas. `report()` at `:377-382` rebuilds the chain and nulls `pinned`
  on every pick, including one the hook then discards, and `use-inspect.ts:200-204`
  re-sends `highlight` only when the open target id changes. So a discarded click
  makes the previous box vanish, which reads as a deselect.
- **[ours] The pane cannot name what it holds.** The title is the raw
  `componentName` (`components/studio/props-pane.tsx:61,103`), which is the literal
  string `<Interactive.Div>` for every text in every video. The hover label is the
  same string plus the tag (`inspect.ts:337-343`). The `name="Headline"` the agent
  writes is already delivered: Remotion appends a hidden `name` field to every
  schema and reads it into `controls.currentRuntimeValueDotNotation`
  (`with-interactivity-schema.js:151-155`); `preview/tuning.ts:340` drops it as a
  hidden field. Two clicks on two different lines draw byte-identical panes.
- **[ours] An accepted switch reverts unsent edits and says nothing.**
  `use-inspect.ts:134` `abandon(open)` sends a whole-target reset per link, which
  also undoes a CameraRig change that an earlier card already Added, because the
  camera is in every chain. The comment textarea is not keyed on the card, so a
  sentence typed for A goes out with B.

### 2. The wrong element gets selected

- **[generation] The innermost `controls` carrier is always the primitive around
  the line.** 200 `<Interactive.Div`, one `H1`, zero `Span`/`P` across eleven
  videos; words are plain `inline-block` spans (`WordPush.tsx:256-271`). The
  picker climbs surface-less inline wrappers to the first block
  (`preview/picker.ts:148`), the fiber walk (`tuning.ts:155-168`) lands on
  `<Interactive.Div name="Pushed line">` (`WordPush.tsx:245`), and the pane opens on
  it. This is the element Remotion Studio would pick too. It reads as "some div"
  because the pane calls it `<Interactive.Div>` and lists six transform rows.
- **[ours] `paints()` ignores opacity and masks, and a line owns no gaps between
  its words.** `picker.ts:52` reads only the element's own text nodes, and `:79`
  counts any `backgroundImage` as painting everywhere. A click in WordPush's
  `marginRight: 0.22em` gap, or on a word that has not entered yet (`opacity: 0`),
  falls through to the first surface behind it: the Highlight marker, the vidrush
  Backdrop's masked ghost box, need-sponsor's full-frame accent glow.
- **[generation] Pre-pane videos climb to the frame.** saas-typography renders the
  registry components in `src/shared/remocn/typography` (inline spans in an
  `inset: 0` flex root) under a `SceneShell` whose only Interactive is `inset: 0`.
  The hover box there is the whole frame.

### 3. Editing a prop changes nothing visible

- **[structural + ours] A curve is inert at a settled frame, and the pane never
  moves the frame.** Arming only pauses (`preview/entry.tsx:180`); nothing seeks
  on pick; every generated `interpolate` clamps both sides (`WordPush.tsx`,
  `RevealText.tsx`, test-props `Title.tsx:57-62` over frames 6-25). Past the
  window every bezier yields the same constant. The only motion is the dot inside
  the easing card. The Player's transport bar is inert while armed, because the
  swallow tests the canvas rectangle rather than the element under the pointer.
  The agent hit this itself: `need-sponsor/scenes/AskScene.tsx:80` reads "Set from
  the preview. Still inert".
- **[ours] A remounted component keeps answering `ok: true`.** On 4.0.481 only
  the built-in `Interactive.*` elements are registered for stack injection
  (`Interactive.js:77`); an agent component exported through `Interactive.withSchema`
  (`Interactive.js:88`) has no `stack`, so its id is `String(Math.random())` per
  mount (`with-interactivity-schema.js:136`). A `Series.Sequence` unmounts its
  scene outside its window, so playing through the loop or scrubbing away and
  back mints a new id. `preview/interactivity.tsx:69` falls back to the `seen`
  cache, `:154` replays the override onto `remocn.<oldId>`, and no live instance
  maps that path. Nothing changes, no refusal. Repro: vidrush, pick a claim line,
  open the WordPush chip, scrub into scene 4 and back, drag Drive easing.
- **[ours] An edit on the primitive moves every sibling.** One node path per
  `overrideId` (`interactivity.tsx:74-89`), and every instance sharing the id reads
  it. Repro: test-props, drag Opacity on one readout, all three dim. This is
  Remotion's model (an override is a call-site edit) and cannot be made
  per-instance through Remotion's contexts on any version; what is wrong is that
  the pane does not say so.
- **[generation] Exposed curves that are never sampled.** The conventions say
  "always expose an easing" without "only where it is sampled", so the agent
  exposes `exitEasing` on a `SceneStage` whose `exitAt` defaults to 0 (nine uses),
  camera curves on a vidrush `CameraRig` with `pushTo={1}`, `CountFigure.easing`
  with `countFrames={0}`. Dragging them changes nothing at any frame.
- **[ours] The agent is told the wrong owner.** `TuningChange` is `{from, path, to}`
  (`shared/ipc.ts:219`); `sidecar/agent/prompt.ts:40-42` prints one flat list under
  the clicked node's `component:`; the conventions (`conventions.ts:141-147`) then
  say to edit that component. A `claimSize` change made on the ClaimScene chip is
  sent to WordPush. And `from` for an animated style key is the runtime value at
  the paused frame, which maps to no line of source.
- **[generation] The two test beds cannot show what they were built to test.**
  remocn-test-easing has no schema at all and 25 constant easings, with a header
  (`CurveLanes.tsx:3-8`) asserting Remotion Studio's rule as fact; remocn-test-props
  declares `easing` as an enum of five names, which the pane can only draw as a
  picture with a preset picker. Both predate the commit that overruled the skill.

### 4. No text controls, no typography

- **[structural] 4.0.481 has neither.** `Interactive.js:43` builds the element
  schema from `baseSchema + transformSchema`: origin, translate, scale, rotate,
  opacity, hidden. The field-type union has no string type, so text content cannot
  be declared by anyone. Remotion 4.0.513 adds `textSchema` (color, fontFamily,
  fontSize, lineHeight, fontWeight, fontStyle, textAlign, letterSpacing) and a
  `children` field of the new type `text-content` on every `Interactive.*` text
  tag, plus `font-family` and `asset` types; Studio 4.0.520 edits text through an
  inspector textarea that pushes the same drag override the studio's runtime
  already drives. The vendored `remotion-interactivity` skill is stamped 4.0.513
  and promises the agent that inline text "stays editable"; the template pins
  4.0.481, where it is not.
- **[ours] The pane would still drop them after an upgrade.** `preview/tuning.ts:200`
  whitelists eleven field types without `text-content` or `font-family`, and
  `:371` drops the rest in silence. `isFieldValue` also drops the values the agent
  actually writes: `fontWeight: 800` against 4.0.520's enum of strings,
  `letterSpacing: "-0.03em"` against a number. `TYPOGRAPHY` (`:223`) matches only
  `style.`-prefixed paths, so WordPush's bare `fontSize`/`fontWeight` land under
  Parameters, one chip out.
- **[generation] Typography lives in an untyped `style` bag, text in a plain prop
  or in Zod.** Zero `style.*` schema keys in any agent-written video outside
  remocn-tutorial, which is a copy of the template. The conventions ask for
  "texts as typed props" in a schema language with no string type and never name
  a typography key; the agent's own review (`video/review.md:70`) tells the person
  to change words "in the props panel", which does not exist.

### Before and after the 2026-09-01 conventions

Improved: `withSchema` exports 0 to 65, every one passing `controls` and
`outlineRef`; 118 spread easing arrays against 7 constants (all in tutorial-2);
enum easings gone; no raw export ever rendered. The agent obeys the letter of what
it is told.

Not improved, because the letter was wrong or silent: the innermost link is still
a nameless primitive around every text run (the two-wrapper rule made it so);
typography stayed inline in `style`; text stayed a prop; inert curves appeared;
`name` literals repeat inside reused components; the registry components were
forked per video (three near-identical `WordPush`, `SqueezeIn`,
`OutlineFillTrackText`) because the shared ones are untunable.

## Ruled out

- The tune path is broken: no. A static status plus a static override resolves,
  arrays included, and `mergeValues` writes the value into the component's real
  props. When an edit reaches a mounted instance at a sampled frame, it shows.
- Refusals fire silently: no. The curve editor's clamps match every schema's item
  bounds, so `ok: false` never fires for an easing.
- `CLIMB_LIMIT` is reached: no chain in the corpus exceeds one inline level.
- `withSchema` components lack `outlineRef`: 65 of 65 wire it.
- The `...style` spread hides typography from the runtime: no. The missing schema
  key is the cause.
- Remotion Studio would pick a different element: no. It has no DOM hit test, and
  its deepest outline is the same primitive; it differs in showing the name.
- Bumping the pin alone fixes complaint 4: no (whitelist, value types, and 4.0.520
  makes `withSchema` components call-site keyed as well, `Interactive.js:104-108`
  in the packed 4.0.520).

## Decisions

Three points where the lenses disagreed, settled here.

**Identity: the DOM instance selects, the call site edits, and both are said.**
Selection identity moves off `overrideId` onto the picked node (an anchor
selector built from the nearest `data-design-id` plus nth-child steps), so two
claim lines are two selections and a second click is a new pick. Edit scope for a
Remotion-schema field stays the call site, because one node path per id is the
whole of Remotion's override model; the pane says "Shared by 4" and the agent is
told which instance was meant. Rejected: minting per-instance ids by salting the
injected stack (per-mount ids that die on remount, unbounded growth of Remotion's
module-level map, and an override the agent could not write back).

**Text and type: ride Remotion's own text schema, not a studio-owned CSS layer.**
The runtime lens proposed an element layer applying `!important` rules per anchor
and mutating text nodes, which would work on 4.0.481 for any node. It is rejected
for v1: a second override mechanism beside Remotion's, it pins animated
properties exactly as a static status does, its text mutation lies the moment a
run is split into spans, and the values it reports have to be reconciled with the
schema path. Instead: the template pin moves to 4.0.520, the pane learns the two
new field types and coerces the value shapes the agent writes, an existing project
gets an Upgrade row in the environment checklist (never a silent upgrade), and on
an older Remotion the Text row exists as request-only, labelled "sent to Claude,
not previewed". If upgrading a real project turns out to be a problem, the layer
is the fallback and its design is in the workflow transcript.

**Markup: keep the `Interactive.*` text element, fix its name and its scope.** The
codegen lens proposed reversing the two-wrapper rule: every text run a `withSchema`
component rendering a plain `<h1>`, typography declared as `style.*` keys, never
`Interactive.*` around text. On 4.0.481 that puts typography on the opening view,
but it depends on the per-mount random id for instance identity (which dies on
remount and disappears on 4.0.520), and after the pin bump it makes Remotion's
built-in live text and typography unreachable, since a plain `<h1>` is not a text
element. Remotion is converging on exactly the feature this complaint asks for, so
the markup follows Remotion: one text run is one `Interactive.H1/P/Span` with the
string as its direct child and a unique `name`; a component that splits a run into
words keeps the split inside and declares `text` as a `text-content` field so the
string still reaches the pane (verify, open question 3). The nameless-innermost
problem is solved by showing the name, not by removing the element.

## The plan

Ranked by impact on the four complaints over effort. Each item names the files it
touches.

**1. A selection you can see, named by the agent, identified per instance.**
Complaints 1, 2, 3. Effort M. Depends on nothing.

- `preview/inspect.ts`: a second box pair (solid selected box with a name tag,
  thin dashed hover box), both painted always; `onDown` sets the selection
  synchronously before `report()`, which never nulls it; `close()` keeps it;
  `onDown` ignores `button !== 0`; the label reads the link's `name` first.
- `preview/tuning.ts`: `TuningTarget` gains `name` (from
  `currentRuntimeValueDotNotation.name`), `instanceId` (a `WeakMap` over
  `hostOf(fiber)`), `ordinal`/`instances` (same-id sequences ordered by DOM
  position), and per-link `where` from grab. Drop links whose only fields are
  `hidden`/`layout` unless innermost (kills the `<Series>` chip).
- `hooks/use-inspect.ts`: `sameElement` compares `instanceId`; a literal re-click
  pulses the box and changes nothing else. `hooks/use-inspect.test.tsx:409`
  becomes "on the same instance", plus a sibling-instance case.
- `components/studio/props-pane.tsx`: title is `name ?? chainLabel`, subtitle
  `Div in WordPush · components/WordPush.tsx:243`, badge `2 of 4`; chips are names.

**2. Edits are honest and land where they say.** Complaint 3, and the switch half
of 1. Effort M. Depends on 1.

- `preview/interactivity.tsx`: replace `mappings` + `seen` with a registry keyed
  by the anchor; a `useEffect` on `sequences` rebinds every live `overrideId` for
  that anchor to its node path on each registration, which is how Remotion Studio
  itself survives remounts; `set`/`reset` refuse with "not on screen at frame N,
  RevealText runs 432-448" when nothing is bound; drafts reset on `rebuilt`.
- `hooks/use-inspect.ts`: resets are per changed path, never the whole target, so
  leaving card B cannot undo what card A Added; `openTarget` writes `cardRef`; a
  switch that reverts raises a toast with Undo (the session-delete pattern); the
  textarea is keyed per instance.
- Pane: "Shared by 4 · a change here moves all of them" under the title when
  `instances > 1`; a refusal renders beside its row.
- `shared/ipc.ts`: `TuningChange` gains `owner {component, name, file, line}` and
  `sampled`; `sidecar/agent/prompt.ts` groups changes by owner and marks a `from`
  that was read off the frame rather than the code; the conventions say "edit the
  component the change names".

**3. Time in the pane.** Complaint 3. Effort M. Depends on 2 (a loop crosses scene
boundaries).

- `preview/entry.tsx`: post `playhead {frame, playing}` per animation frame; handle
  `replay {from, until}` (seek, play, pause at `until`).
- `preview/inspect.ts`: post the element's window (sum of finite `from` up the
  fiber chain, `until = from + min(duration, 60)`); swallow pointer events only
  when the topmost element under the point is inside the canvas, so the Player's
  transport works while armed.
- Pane header: `frame 412 · enters 408-424`, a scrubber over the window, Replay;
  `flushTuning` auto-replays once, debounced, after a curve or timing edit. The
  preview's status slot says "Inspect on · f 412" while armed. No seek on pick:
  the paused frame is the one the person is judging.

**4. The picker aims at what the person sees.** Complaint 2. Effort S. Depends on
nothing.

- `preview/picker.ts`: `paints()` is false for opacity below 0.05 and for masked
  elements unless they cover text; `coversText` walks descendant text nodes with a
  word-gap allowance; a text-covering candidate beats a surface; a surface covering
  most of the canvas loses to any smaller painter under the point; Alt keeps the
  literal node. Fixtures shaped like WordPush, Highlight, Backdrop, AmbientField.

**5. Text and type become real fields.** Complaint 4. Effort M (pane S, pin M
with one live gate). Depends on 2 for the pin.

- `preview/tuning.ts`, `lib/studio/preview.ts`, `components/studio/tuning-controls.tsx`:
  add `text-content` (a small textarea, every keystroke a `tune.set`) and
  `font-family` (a text field with a datalist of `document.fonts`); `descriptorOf`
  coerces instead of dropping (number to enum string, unit string to a text
  control, anything else read-only "value in code"); `TYPOGRAPHY` also matches
  bare `fontSize|fontWeight|color|fontFamily|lineHeight|letterSpacing`.
- Request-only Text row when the innermost link's host has one text child and the
  project's Remotion is below 4.0.513: it lands in `tuningChanges` and says it is
  not previewed.
- `templates/remotion/package.json`: `remotion` and every `@remotion/*` to 4.0.520
  (floor 4.0.513). Environment checklist: a `remotion` row that warns below
  4.0.513 with an Upgrade button through `installDependencies`. Gate before
  merging: open remocn-news-videos on 4.0.520 in the running app and confirm a
  `style.fontSize` override on an `Interactive.Div` changes pixels.

**6. Codegen writes for this pane, and `design_check` enforces it.** Complaints
2, 3, 4 for new videos. Effort M. Depends on 1 (names shown) and 5 (the text
field).

- `sidecar/claude/conventions.ts`: replace paragraph 9 and the `INTERACTIVITY`
  block (about 3.2k characters) with one shorter block: one text run is one
  `Interactive.H1/P/Span` with the string as its direct child and a unique
  hardcoded `name` equal to its `data-design-id` (inside a `.map()` the name
  carries the index or the content); a component that splits a run declares
  `text` as `text-content`; typography is literals on that element (the pane
  edits them there) and `style.*` keys in a component schema only for values the
  component derives; an easing is exposed only where it is sampled, with its window
  named beside it and off-by-default movement under an enum variant; a spring
  exposes `damping`/`stiffness` as numbers and is not a finding; arrays carry
  `newItemDefault: 0` and item bounds [-0.5, 1.5]. Drop the false "cannot be
  selected in the preview at all" and the Studio-only "no spreads, constants or
  math". Name all three disagreements with the bundled skills in one sentence.
- `sidecar/tools/tunability.ts`: from one regex to a rule set emitted as error
  findings inside `design_check`'s JSON (`execute.ts:178`), which the review stage
  already gates on: constant-easing (reading across a wrapped line), constant
  spring, text not in an Interactive text element, typography missing where a
  component derives it, a primitive with a literal `name` inside `.map()`, an
  easing beside a `*At`/`*Frames` defaulting to 0, `controls` not forwarded, a raw
  export rendered. Measured on the prototype: 14 findings on vidrush, 0 on the
  worked component.
- `agent/skills/motion-design`: a `rules/tunable-text.md` page with the worked,
  typechecked component; the skill's three primitive-around-text examples and the
  easing table move to the tunable shape.
- `templates/remotion/video-template/index.tsx`: add `style.fontWeight`,
  `lineHeight`, `letterSpacing`, `newItemDefault: 0`, X travel instead of
  `transform: translateY`; a template test pins the shape, since the file is
  outside `tsconfig.json`.

## Order of work

Each milestone leaves the feature strictly more usable than before.

1. **See what you picked.** Items 1 and 4. Acceptance: in remocn-vidrush-sponsor
   scene 3, click "One brief in." then "Publish-ready"; the solid box moves to
   the second line and the pane reads "Pushed line · 2 of 4".
2. **Edits land where they say.** Item 2. Acceptance: pick a claim line, open the
   WordPush chip, scrub into scene 4 and back, drag Drive easing; either the line
   re-times on replay or the pane says "not on screen at frame N". Add a CameraRig
   change from one card, cancel another card, the camera change stays.
3. **See the change move.** Item 3. Acceptance: in remocn-need-sponsor AskScene
   paused at frame 500, drag RevealText's easing; the pane replays 408-424 and
   the URL lands on the new curve; dragging the Player's seek bar while armed
   moves the frame.
4. **Text and type, and code that feeds them.** Items 5 and 6. Acceptance: after
   pressing Upgrade on remocn-news-videos, click the AskScene headline; Typography
   shows Font size 104, Weight 800, Color, and typing in Text changes the frame.
   On a 4.0.481 project the Text row is labelled request-only. `design_check` on a
   regenerated vidrush reports zero tunability findings.

## Open questions

Each one changes the plan, and each is a measurement.

1. Is JavaScriptCore's `new Error().stack` identical for one call site across
   render passes (a mount flushed from a seek-bar click versus one from the
   scheduler)? Log `controls.overrideId` per instance across a loop and a scrub.
   If ids diverge per pass, item 2's live set must hold several ids per instance
   (designed for) and item 1's "2 of 4" must count by DOM order, not by id.
2. Does the studio's `InteractivityRuntime` work against 4.0.520 in the real
   webpack host? Bump a scratch copy of remocn-news-videos and open it. The 4.0.520
   wrapper gates on `CanUseRemotionHooks`, which the 4.0.520 Player provides, and
   reads `_remotionInternalStack`, which the bundler injects; neither is touched by
   the runtime. Decides whether milestone 4's pin ships.
3. Can a `withSchema` component declare a `text-content` field on 4.0.520 and
   receive the override through `mergeValues`? One component in the same scratch
   copy. Decides whether the text rule says "a split run keeps a `text` field" or
   "text is always a direct string child".
4. Does the Player's transport bar overlap the canvas rect in the running app?
   Arm and drag once. Decides whether item 3's passthrough predicate is needed.
