# Tuning what you pointed at

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`preview/properties-pane`](../../openspec/specs/preview/properties-pane/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Clicking an element that declares an `InteractivitySchema` — `Interactive.withSchema()`, its
`controls` passed to its own `<Sequence>` (REM-6) — opens a **properties pane** to the right of
the preview. Every supported field rerenders the preview as it changes; `Add` keeps that live
result on screen and hands the agent a `{path, from, to}` diff to write into the TSX.

- **It is a pane, not a card over the frame, and that reverses the design's own first
  answer.** #6 said "no fourth global panel" and grew the anchored comment card into an
  inspector instead; on a real project that card was too small to work in, needed scrolling for
  three fields, and covered the frame whose change you were judging. So the inspector is a
  fourth `ResizablePanel` beside chat and preview — full height, dragged to width, remembered
  by the layout store like the other two. `panelIdsOf` gains the combination rather than a
  flag, because the stored layout is keyed by the id list and a two-pane width must not be
  read back into a three-pane window.
- **The pane exists while there is something in it.** It is mounted by a selection carrying a
  schema and unmounted by Cancel, so it is never an empty rail taking a third of the window.
  Closing it *is* Cancel — the originals go back — which is why the × says so on its tooltip.
- **An element with no schema keeps the compact card over the frame.** Two surfaces for one
  selection is a real cost, and it buys the case that matters: a quick comment on something
  that has nothing to tune should not move the whole window.
- **It is shaped like a design tool's inspector, because that is what people already know
  how to use.** The row is two columns — the name outside the control, the value inside it
  and left-aligned — and every control is the same compact `h-7 rounded-md control-surface`
  field, so a section reads as a column of names beside a column of values rather than a
  stack of self-contained widgets. Sections carry a sentence-case heading in the foreground
  colour, separated by rules that run the full width of the pane, ordered the way an
  inspector orders them: Transform, Layer, Typography, Fill, Stroke, the component's own
  Parameters, then Entry/Exit/Effects and Timing last. `control-surface` and
  `--elevation-control` are lifted from remocn.dev's component customizer.
- **Every number is one control, and it takes all three gestures.** `Scrubber` is a Base UI
  `NumberField` whose whole surface is the scrub area: dragging anywhere changes the value,
  pointer-locked with a cursor of its own; arrows step, shift steps by ten (`largeStep`),
  alt steps finely (`smallStep`). A click that never moved drops into typing — Base UI
  focuses the input on pointerdown and re-dispatches the click that pointer lock swallowed,
  and the field answers by taking its overlay off the input until it blurs. A *bounded*
  number paints how far along it is as a fill behind the value (`fractionOf`), because "how
  far along is this" is a question a number alone cannot answer at a glance — the separate
  track beside the field was the first version, and it read as two controls for one value.
- **Easing is an interpolation editor, not a dropdown.** A field whose path ends in
  `easing`/`ease` gets a curve block: dialkit's `EasingVisualization`, a preset picker, a
  preview dot whose `animation-timing-function` *is* the value being edited, and the four
  numbers as scrubbers. `lib/studio/easing.ts` is what is left of ours — the name→bezier
  lookup (CSS names plus the Penner families in any casing), the preset table, and the
  dot's duration. What is editable follows what the component can hold: a **four-number
  array** is handed to dialkit with an `onChange`, so its two handles drag; an **enum** of
  names can hold one of its own options and nothing else, so it is handed none and dialkit
  draws the same handles disabled — the card must never show a grab target that does not
  move. That is why the conventions require the array and forbid the enum: the shape of the
  prop is what decides whether the curve is an instrument or a picture. A spring is
  deliberately not a tab here — it is ordinary damping/stiffness props, which already
  render as numbers.
  - **The four numbers and the two handles share dialkit's limits, not ours.** x is clamped
    to [0,1] as `cubic-bezier()` requires and y to [-1, 2] — read out of `clampY` in
    `easing-geometry` — so a handle dragged to an overshoot the scrubbers could not hold
    is impossible by construction.
  - **The preview dot is still ours, and it runs the element's own window.**
    `EasingConfig` takes a `duration` and, measured in 2.0, `EasingVisualization` draws
    nothing from it: there is no dot in dialkit's curve. `windowSeconds(window, fps)` is
    passed to both, so the number the dot animates over is the number dialkit is told, and
    a curve is judged at the speed it will really play rather than at a fixed 1.8s. With no
    window to read — the element has no timed sequence — it falls back to that 1.8s, and a
    window shorter than 0.15s is held there so the dot is an animation and not a strobe.
- **Telling the agent was not enough, because a bundled skill tells it the opposite.**
  `remotion-interactivity`'s own words are *"the output range, easing, extrapolation and
  `output` property should use hardcoded values"* — right for Remotion Studio, which
  rewrites the call site, and wrong here, where the panel edits props at runtime. Given
  both, an agent wrote a whole video of `easing: Easing.out(Easing.cubic)` and left a
  comment saying that was *"the only shape the panel can pick up and edit"*: confidently
  backwards. The vendored tree cannot be edited (`skills:check` reads any change as
  drift), so the conventions now name the disagreement and overrule it on that one line,
  and — because an instruction contradicting a loaded skill is a coin flip —
  `sidecar/tools/tunability.ts` scans the video's own source. It is **seven rules, not one
  regex**: a constant easing (error), a spring whose physics are nailed shut (info), a run
  of text in a plain `div`/`h1`/`p`/`span` with no `Interactive.` ancestor (warning), one
  literal `name` shared by every instance a `.map()` renders (error), a curve whose window
  defaults to zero and so is never sampled (info), a schema component that never forwards
  its `controls` (error), and a raw export of the component `withSchema` wraps (error).
  They are **merged into `design_check`'s own `findings` array**, with a `tunability_*`
  code and their severity counted into its `summary` — prose appended after the JSON could
  not be a finding, and the review stage's done-condition is "every mechanical finding
  fixed or explained". That gate was chosen over a new tool precisely
  because the conventions already require calling it before finishing: a tool the agent
  may forget is no gate at all. It reads only the turn's own video folder, never a
  sibling's, and a source it cannot read costs nothing — the design check the agent is
  waiting on must not fail over a courtesy.
- **The scanner is a mask plus a tag stack, never an AST.** An AST would cost the sidecar
  bundle megabytes to answer shapes a mask already answers: comments are blanked and string
  and template *bodies* replaced character-for-character with `x`, delimiters kept, so every
  index and line number still lines up with the file the agent wrote. Three corpus shapes are
  what it is written against and each is a test — a `>` inside `style={{ … }}`
  (`enterBlur > 0`) is not the end of an open tag, a `.map(…).join(", ")` that finished
  before an unrelated primitive is not an enclosing region, and an `Easing.bezier(` whose
  arguments are all identifiers or a spread is prop-fed rather than constant. Two more are
  the shapes a mask gets wrong if you let it: an open tag's children are sliced only to the
  next `<`, so a `{list.map(…)}` child leaves an unmatched `{` behind and the residue must
  be cut rather than read as a text run, and the literal-`name` test is anchored
  `(?<![\w-])` so `data-name` cannot stand in for the primitive's own `name`. Measured over
  the eleven videos of `remocn-news-videos`: **75 findings** — constant-easing 51,
  constant-spring 9, inert-easing 8, plain-text-element 6, mapped-primitive-name 1, and zero
  of the last two, because those videos were generated after the schema conventions landed.
- **A composite control is a stack, not a row, and it shares the pane's edge.** dialkit's
  convention is a self-contained pill — label inside, value inside, one surface — and the
  easing editor cannot be one: it is a canvas, a picker and four numbers. Forcing it into
  the old row grid reserved a label column the pills do not have, so the whole block sat
  in a narrower second column and the pane read as two competing alignments. It now uses
  `dialkit-composite-control`, which the X/Y pairs had already settled: the label on its
  own line, everything under it at the pane's own edge, and the reset action in the same
  slot every other control puts it in. Two supports: the row gap is wider than the gap a
  description keeps to its control, so the prose reads as belonging to the row above it
  rather than floating between two; and the `title` that gives a clipped label back lives
  on the pill, not on the row, or hovering the curve would raise a tooltip for a label
  that was never clipped.
- **A label is one clipped line; the sentence goes under the control.** A schema's
  `description` used to *be* the label, which was right for Remotion's own built-ins — they
  describe themselves in two words ("Font size", "Opacity") and read better than the path
  would — and wrong for everything an agent writes, which is prose: *"Frames per drift
  cycle — kept coprime with the ambient periods"* wrapped out of dialkit's 36px row and
  landed under the next control. `labelFor` takes the description only while it is short
  enough to be one (24 characters), and otherwise humanises the prop's own name; the
  description then renders as prose below the row, where it has the pane's width to wrap in.
  Two supports under that: `labelOf` is sentence case, because Remotion's descriptions are
  and the two share a column; and dialkit's labels are clipped in `app/globals.css` —
  `.dialkit-slider-label` is positioned absolutely with no width of its own, and
  `.dialkit-labeled-control-label` is a flex child that refuses to shrink, so both had to
  be told. Clipping never loses the text: the row carries the label as its `title`.
- **A value that is really two numbers is edited as two numbers.** `lib/studio/tuning.ts`
  parses `"−12px 8px"`, `"50% 50%"` and `[0.5, 0.5]` into labelled axes and writes the
  chosen one back in the shape it arrived in, unit and all. Two subtleties are pinned by
  tests: a one-token value (`translate: 10px`) means x-only and CSS reads the other half as
  zero, so the panel offers both; and a bare `0` may legally drop its unit where a non-zero
  may not, so writing takes the unit from whichever half declared one and from the type when
  neither did. A value it cannot parse — `calc(100% - 4px)` — falls back to a plain text
  field rather than being guessed at.
- **A position is one gesture, so a pair is a pad** (REM-356). `translate`,
  `transform-origin` and `uv-coordinate` are places on the frame, and two sliders make
  moving something diagonally two drags of numbers that are not numbers to anyone. `padOf`
  in `lib/studio/dialkit.ts` turns the axes `axisSliderOf` already computed into dialkit's
  `[default, min, max, step]` notation — the same ranges, per axis, because the pad is a
  different instrument over the same numbers and not a different reading of them. `scale`
  as a string is two independent factors and `rotation-css` is one number: both keep their
  sliders.
  - **Y is mirrored inside its range, not negated.** A pad's Y grows upward and all three
    of these measure it downward — CSS `translate` and `transform-origin` from the top
    edge, and Remotion's own `uv-coordinate`, whose `[0, 0]` is the top-left corner
    (`getBilinearUvHandlePosition` mixes the top and bottom edges by `uv[1]`, read out of
    `@remotion/studio`). So `padAxesFrom` applies `min + max - y`: on a symmetric translate
    span that *is* a sign flip, and it leaves an origin's 0–100 and a uv's 0–1 the right way
    up, where negating them would not. It is its own inverse, so one function reads the
    value and writes it back, and the pad's own default — where a double-click and Home
    land — is the original value mirrored the same way. Pinned by tests on all three types.
  - The units stay in `withAxes`; the pad knows nothing about `px` or `%`. `uv-coordinate`
    also carries a `visual: {type: "line" | "ellipse"}` hint about what to draw under the
    point, which this version ignores.
  - **The reset moves to the caption row.** A pad is as tall as it is wide, and the shared
    `.dialkit-control-action` centres on its control — which for a square drops the button
    into the middle of the plane. `data-align="top"` pins it half a `--dial-row-height` down
    instead, where every other row keeps it.
- **A picture is a field, and it was silently missing** (REM-356). Remotion 4.0.516 added an
  `asset` type — `<Interactive.Img src>`, `AnimatedImage`, `CanvasImage` — and it was not in
  `SUPPORTED`, so an element made of a picture opened a pane with the picture absent and
  nothing saying why. It is a `dialkit` `ImageControl` now, in the Fill group, because `src`
  matches none of the Fill patterns, which are about colour.
  - **The pane holds the name, not the URL.** What the runtime holds is whatever
    `staticFile()` returned: the page's static base — a per-host random path — plus the
    file's name, encoded segment by segment. That URL is relative to a page the app is not
    and has no business in a request to the agent, so `preview/assets.ts` reads the name out
    of it and `lib/studio/static-files.ts` builds an absolute URL back for the control,
    which draws the value it is given. A value naming no static file of ours — a remote
    https image — passes through both ways untouched.
  - **Writing goes through Remotion's own file token.** `assetValue` sends
    `remotion-file:<name>`, which `computeEffectiveSchemaValuesDotNotation` resolves against
    the static base for exactly the fields it knows to be assets. Setting the resolved URL
    would work equally well today; the token is what the runtime is written against.
  - **The options are the project's own `public/`,** served by the host at
    `/__remocn/static-files` (`sidecar/preview/statics.ts`) and carried on the `selection`
    message beside `fonts`, for the same reason: only the page knows either. The listing is
    read per request rather than at start-up, because the agent adds pictures mid-session,
    and the page forgets its copy on a rebuild — which is that turn having written.
  - **An asset always goes to the agent, never to the codemod.** The pane holds a name and
    the file holds the call that resolves it; writing the name over `staticFile(…)` would
    leave a string nothing serves. `src={staticFile(…)}` reads as `computed` anyway, so the
    rule in `shared/codemod.ts` only catches a literal `src="…"`.
  - **The library and upload are deliberately not in the picker.** Offering a library asset
    means copying a file into somebody's `public/library/` on a hover-pick — a write nobody
    asked for — and the library already reaches a project through `[Asset #N]`, after which
    the picker lists it like any other file. dialkit's upload is worse: it reads the file
    into a **data URL** and offers no seam to send it anywhere else, and a data URL is the
    one value this control must never produce. The button is hidden in `app/globals.css`,
    and `dialkit-contract.test.tsx` fails if a version bump moves the class or the
    `readAsDataURL` behind it.
- **A spring is three numbers and one movement, so the response leads them** (REM-356).
  `springsIn` in `lib/studio/spring.ts` finds a triple by the *shape* of its paths — any
  prefix ending in `damping` and `stiffness`, with `mass` optional at Remotion's own default
  of 1 — and `paneRows` inserts a `SpringVisualization` above the first of the three,
  wherever in the section the schema happened to declare them. The conventions ask for
  `spring.damping` / `spring.stiffness` / `spring.mass`, one group per spring and prefixed
  where a component has more than one; matching by shape rather than by that name is what
  keeps an existing component working, since it keeps whatever it has.
  - **It is a readout, not a control, and `SpringControl` is why.** The full control needs a
    panel registered in dialkit's `DialStore` — `updateTransitionMode` without
    `registerPanel` simply returns — and its Time mode parameterises Motion's
    `visualDuration`/`bounce`, which is a different solver from Remotion's. Physics maps one
    for one, so `isSimpleMode={false}` plots the real response. What does **not** map is the
    time axis: dialkit draws a fixed two seconds where Remotion runs the spring over the
    frames the component asks for. The curve is the shape, never the timing.
- **Sections fold, and the fold is remembered** (REM-356). An element on a real video opens
  with eight groups and Remotion puts Transform on every one of them, so the section a
  person came for is routinely below the fold of a 340px pane. The heading is a button; a
  folded one shows its row count, so a fold never hides that there is something in there.
  Three things about it are deliberate: the rows are **hidden, not unmounted**, or folding
  mid-edit would throw away what was being typed; `collapsedPropGroups` in `settings.json`
  holds the **collapsed** names rather than the open ones, so a group the pane gains later
  opens with everything else instead of arriving shut; and `usePropGroups` is called in
  `PropsPane`, outside the `PropsPanel` that is keyed on `instanceId`, or every pick would
  reset the fold.
- **Nothing the schema declares is dropped in silence any more, and two of the rules are
  coercions.** The pane whitelisted eleven field types and refused every value that did not
  match its declared type — which is how `fontWeight: 800` (a number, against 4.0.520's enum
  of *strings*) and `letterSpacing: "-0.03em"` (a unit string, against a number) vanished
  with nothing on screen to say so. The list gains `text-content` and `font-family`, and
  `readingOf` in `preview/tuning.ts` now answers for every value: a **number against an enum
  of strings** whose `String()` is one of the options becomes that option and stays editable;
  a **unit string against a number** keeps its row as a **read-only** one, so
  `Letter spacing  -0.03em` is visible and cannot be dragged; a `text-content` whose runtime
  value is not a string says *Text is built from parts — ask in words*; anything else keeps
  its row as *value in code*, printed through a guarded `JSON.stringify` — the catch-all is
  now on the path of every unreadable value, and a circular one (a React element carries
  `_owner` in development) throwing there would cost not its row but the whole `selection`
  message. The one thing still dropped is a key the runtime holds **no value for at all**: on
  4.0.520 a text element declares eight typography keys, and a component that sets none of
  them would otherwise draw eight rows reading `undefined`. `readOnly` rides the wire as an
  optional key (`field.readOnly === true`), like `TuningChange.sampled` and for the same
  reason — a decoding default would make it required in the decoded type.
- **Typography is grouped by what a key means, not by whether it is spelled `style.`.**
  `TYPOGRAPHY` matched `style.`-prefixed paths only, so a component's own
  `fontSize`/`fontWeight` — which is how every agent-written video writes them — landed under
  Parameters, one chip out from where anyone would look. Bare
  `color|fontFamily|fontSize|fontStyle|fontWeight|letterSpacing|lineHeight|textAlign` now
  group there too, `backgroundColor` falls to Fill, and a `children` field of the new
  `text-content` type leads that group.
- **Text is a field where the runtime has one, and a request where it does not.** Remotion
  4.0.513 adds `textSchema` and a `children` field of type `text-content`; 4.0.481 — what the
  template still pins — has no string field type at all, so nothing typographic can exist on
  a primitive there by anyone. So the selection carries the element's own words (`text`,
  non-null only when the innermost `Interactive`'s host node is one text node) and the loaded
  families (`fonts`, from `document.fonts`), and the pane opens a **Text** section above
  everything else labelled *sent to Claude, not previewed*. It changes no pixels and rides
  `tuningChanges` as `{path: "children"}` with the innermost component as its owner, so the
  agent is asked to change the words in the file. It exists **only** while the innermost
  target declares no live `children` field: on a Remotion that has one, the live field is the
  thing that moves the frame and a second textarea beside it would be a lie. Add rebases the
  draft exactly as it rebases the tuned values, and a stored selection chip carries `window`,
  `text` and `fonts` with it, so a reopened chip still has its time strip and its faces.
- **Opacity reads as a percentage and is stored as a fraction**, named by path rather than
  inferred from a 0–1 range, or every normalised parameter in a project would silently grow
  a percent sign.
- **`hiddenFromList` is honoured.** Remotion marks `from`, `durationInFrames`, `trimBefore`
  and `freeze` as belonging to a timeline rather than a property list; the panel is not a
  timeline, so it obeys, and those stay a sentence in the chat.
- **Colour is a text field beside a swatch that opens dialkit's own picker**, and a switch
  is the one control with no field behind it: it is already a surface, and a box inside a
  box is what that would be. Bare `<input type="number">` rows were the first version of
  all this and they read as a form rather than an instrument. Nothing coerces the value on
  the way in: 2.0 parses hex, rgb, hsl, oklch and Display P3, and writes back in the format
  it was given, so a `zColor()` default spelled `rgba(…)` survives a round trip instead of
  arriving as black.
- **Focus is an `outline`, never a `ring`.** `control-surface` *is* a `box-shadow`, and a
  Tailwind ring utility sets `box-shadow` in the utilities layer — it would replace the
  surface and take the elevation with it. The inputs inside a field carry `outline-none`, so
  the field itself shows `focus-within` instead; dropping that would have been the one real
  accessibility regression in this pass.
- **dialkit ships no changelog, so a bump is read out of its `dist`.** Neither npm nor
  GitHub Releases carries one; 1.4.3 → 2.0.0 was worked out by diffing `dist/index.d.ts`
  and `dist/styles.css`, and what it took back is three things the pane had been doing for
  itself — the slider's role and keyboard (`AccessibleDialSlider`, which in 2.0 would have
  been a slider inside a slider and a second tab stop), the colour hack in
  `app/globals.css`, and `colorValue()`'s coercion of anything that was not a hex to
  `#000000`. `components/studio/dialkit-contract.test.tsx` is where those readings live:
  a version that took one of them back again fails there rather than in the pane.
  Two more findings from the same pass, neither in the type diff:
  - **A `Toggle` is a segmented radiogroup now**, where 1.4.3 drew two plain buttons — so
    it is `getByRole("radio")` in the tests, and it carries the row's own label through
    `aria-labelledby`.
  - **`TextControl` forwards nothing to its `<textarea>`**, so the `text-content` field —
    the one whose words are written back into the person's TSX — keeps our own `Textarea`
    and its `VERBATIM_INPUT`. `DialPad`, `ImageControl` and `SpringVisualization` were taken
    up in REM-356 and are pinned in the same file. What is still not adopted: `Folder`
    instead of the section headings — the pane's sections are a design tool's inspector and
    `Folder` brings its own chrome — `ButtonGroup`/`Action`, since Replay and Reset already
    have their places, and `PresetManager`, `ShortcutsMenu` and `DialTimeline`, which all
    need `DialStore.registerPanel`; the timeline is besides a clip editor in seconds, which
    is not what frames and `interpolate()` are.
- **The slider is dialkit's own, role and keyboard included** — `role="slider"`, the tab
  stop, `aria-value*` and arrows/Shift/Home/End/Enter all live on `.dialkit-slider` since
  2.0. It draws its label inside its own track and names itself after it, which is the one
  thing it will not let us set separately: where the visible label has to stay short — a
  numbered array item, or the X/Y pair a `scale` string still uses — the field's name is
  carried by a `role="group"` around them instead. A `<fieldset>`, which is what biome's
  `useSemanticElements` asks for, is min-content wide by default, which is exactly what a
  two-column grid in that pane cannot afford.

- **Remotion's own interactivity runtime does the rendering, not a fiber-props mutation.**
  `preview/interactivity.tsx` provides three of the contexts the Studio would: a
  `RemotionEnvironment` claiming `isStudio` (which is the whole reason
  `withInteractivitySchema` hands a component its `controls` at all inside a Player), a
  synthetic `overrideId → nodePath` mapping, and the drag overrides themselves. The pixels
  stay the project's.
- **A drag override alone changes nothing, and that is the one thing to know here.**
  `computeEffectiveSchemaValuesDotNotation` reads `overrideValues[key]` only for a key that
  *also* carries a **prop status**; with `propStatus?.[key] ?? null` coming back null it takes
  `currentValue[key]` and the override is dropped on the floor. In the real Studio those
  statuses come from the server's analysis of the call site — inside a Player nothing
  publishes them, so the first version set overrides faithfully and moved nothing at all, in
  silence. `overridePlan` therefore publishes `{status: "static", codeValue}` for **exactly**
  the keys being overridden, and withdraws them with the override: a status left on a key
  with no override pins that prop to `codeValue` and freezes whatever animates it. It is a
  pure function so the pairing is a test rather than a thing to remember.
- **A runtime that cannot do it says so.** `setPropStatuses` missing means an override that
  merges nowhere, so `set` answers with a sentence instead of a cheerful `ok`, and a refused
  change now prints its reason on the card — reverting the row in silence is the same failure
  wearing a different coat.
- **`overrideId` is per call site, not per element.** `withInteractivitySchema` keys it off
  the JSX `stack` through a module-level map, so two `<Title>` in a file are two instances
  and two ids, while one `<Title>` inside a `.map()` is one id for every row it renders. That
  is Remotion's model and it is the right one: the edit is ultimately going to be written
  back into that one call site.
- **The pane says when an edit is shared.** One nodePath per `overrideId` is that model seen
  from the other side, so an edit on a primitive rendered from one call site genuinely moves
  every sibling — and it cannot be made per-instance through the contexts a Player exposes,
  because there is no per-instance key to publish an override against. `Shared by
  ${instances} · a change here moves all of them` under the title is the pane saying so
  rather than the person discovering it on the third line. `PropsPanel` is keyed on the
  innermost target's `instanceId`, so the comment draft and the focus effect restart per
  element instead of carrying a sentence typed for one line into the next.
- **A reset names paths, never a target.** The preview reads an empty path list as "drop this
  target's whole draft", and a `CameraRig` framing the scene is in *every* chain — so a card
  let go of used to take a camera change another card had already Added. `changedPaths` in
  `lib/studio/tuning.ts` is the one door every reset goes through: Cancel, Reset all, picking
  elsewhere, a rebuild, and removing a chip from the composer all send only the paths that
  card actually moved. `byTarget`'s empty-list branch — the last thing that could still emit
  `[]` — is deleted rather than left for a future caller to find: a reset naming no paths now
  sends nothing at all, which is the failure direction that keeps somebody else's work.
- **Reverting unsent edits says so, with Undo.** Picking elsewhere with pending changes raises
  a toast — `Reverted 2 changes on Pushed line` — whose Undo is a fiber interrupt on an
  `Effect.sleep` window and re-sends every value it took back, reopening that card. Same shape
  `hooks/use-library.ts` uses for a deleted asset, and the same ten seconds. Undo **abandons
  whatever card is open before it restores**: without that, edits made on the element you had
  moved to would be left live in the preview with nothing listing them — the exact failure
  `abandon` exists to prevent, arriving by the back door. Cancel raises no toast, because the
  × already says on its tooltip that it restores the originals.
- **A refusal belongs to a row, not to the pane.** `tuningRefusal` carries
  `{message, path, targetId}` and renders under the control that asked for it; only a refusal
  with no path of its own — a reset, or a runtime that named no field — keeps the footer line.
  A later `ok` clears it for that same target and path and nothing else, and an `ok` for a
  request nothing recorded clears nothing at all: `abandon`, a rebuild and removing a chip all
  mint request ids without registering them, so treating an untracked answer as good news let
  an unrelated reset wipe a refusal the row was still showing.
- **A refusal names the frame, and the window is read from Remotion rather than summed.** An
  element off screen at the playhead cannot take an override, so the sentence is *This element
  is not on screen at frame 42. Title runs from frame 30 to 120.* Two things in
  `preview/timing.ts` are measured corrections to the obvious implementation. Summing
  `memoizedProps.from` up the fiber chain **triple-counts** — an `Interactive.Div` is three
  fibers deep (`withInteractivitySchema`, the inner `forwardRef`, the `Sequence`), so a
  `from={30}` reads as 90 — which is why the window comes from Remotion's own
  `SequenceContext` value, `cumulatedFrom + relativeFrom`, already absolute and counted once.
  And capping the end at `min(duration, 60)` would report a 300-frame scene as ending 60
  frames in, making the sentence lie about the one thing it exists to say; 60 survives only as
  the fallback for a sequence with no finite duration.
- **A stored selection keeps the whole chain**, not the one link that was edited:
  `SelectionTuning` is `{open, originals: Record<targetId, Record<path, TuningValue>>,
  targets}`, so reopening a chip lands on the link the message was written from, and removing
  one resets every link it carried rather than only the one that happened to be on screen.
- **The agent's block groups the changes by who owns them.** `TuningChange.owner` carries the
  component, its `name`, and its file and line, and `sidecar/agent/prompt.ts` heads each run
  with `Requested changes on Title ‹headline› (src/videos/intro/Title.tsx:24):`. A flat list
  of paths taken off a three-link chain read as one component's props and sent the agent
  editing the wrong file; the heading is what makes a chain's diff writable. `owner` is
  `Schema.optionalKey`, so a turn stored before it existed still decodes.
