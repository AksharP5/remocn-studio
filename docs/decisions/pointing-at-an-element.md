# Pointing at an element, and commenting on it

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`preview/inspect`](../../openspec/specs/preview/inspect/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Inspect mode: hover the frame, click the thing you mean, write what should change, and the
selection lands in the composer as `[Element #N]` — the second kind of composer reference,
alongside `[Image #N]` (#18). The message is still sent by hand.

- **Source resolution is React Grab, driven headlessly.** `grab`'s global build is served
  by the preview host at `/__remocn/grab.js` from a Tauri resource, resolved the way the
  template and the agent plugin are, and it goes in the page **before the project bundle**
  — bippy's `Object.defineProperty` patch has to be in place before React defines the
  DevTools hook. Measured: the hook is installed at script evaluation, so `init()` may be
  called later, which is what lets the container be the player's canvas. Keeping it out of
  the project's webpack is the point: that compile costs seconds and peaks over a
  gigabyte, and this is 380 KB it would otherwise carry.
- **Nothing reaches a third party.** `__REACT_GRAB_DISABLED__` is set in the page's globals
  so the bundle does not self-initialise, `init` is called with `telemetry: false`, and the
  `@import` of a Google-hosted font inside grab's shadow-DOM stylesheet is stripped by
  `withoutWebFonts` **when the file is served**. `sidecar/preview/grab.test.ts` reads the
  installed bundle and fails if a version bump reintroduces one — the alternative, a CSP on
  the preview page, would also block fonts the *project* legitimately loads.
- **`init({ enabled: false })` returns a stub, not a disabled API.** Read out of the bundle:
  that branch hands back `{ getSource: () => Promise.resolve(null), getStackContext: () =>
  Promise.resolve(""), … }`, `getPlugins()` is `[]`, and `setEnabled(true)` does not revive
  any of it. So `enabled: false` would resolve every source location to `null` and look
  exactly like a project whose sourcemaps are broken. `init` is always called with
  `enabled: true`; it is lazy, running on the first arm rather than at page load.
- **`init` does not take a `theme` — only plugins do.** The options `init` defaults are
  `{activationMode, keyHoldDuration, allowActivationInsideInput, activationKey, getContent,
  maxContextLines, freezeReactUpdates}`, and `Options` has no `theme` field either, so a
  theme passed to `init` is silently dropped — which is how the toolbar, the label and
  grab's default hue all survived being "turned off". The theme rides on
  `registerPlugin({ name, theme })`.
- **`theme.enabled` is a trap: turn the sections off, one by one.** It reads as the global
  switch, but the bundle only consults it *once, synchronously inside `init`*, to decide
  whether to mount the renderer at all — and a theme cannot be handed to `init`. A plugin
  registered afterwards is always too late for it. The per-section flags
  (`toolbar`, `selectionBox`, `elementLabel`, `dragBox`, `grabbedBoxes`) are reactive
  getters, so those *do* take effect from a plugin. Measured in the shipped bundle by
  counting nodes in grab's shadow root: control 25 nodes / 4 buttons, `theme.enabled: false`
  25 / 4 — unchanged — and `theme.toolbar.enabled: false` 4 / 0.
- **The container is `.__remotion-player`**, which is the Player's canvas div and not its
  outer container — `getContainerNode()` returns the outer one, which holds the transport
  controls too. That class name is `playerCssClassname`'s default and Remotion injects its
  own preview CSS against it, so it is load-bearing for Remotion rather than incidental.
- **`preview/` duplicates the message shape rather than importing it**, as it already
  duplicates the hot-reload path: it is compiled by the project's webpack and has no access
  to the app's alias. `lib/studio/preview.test.ts` decodes both directions, and that test is
  the only thing keeping the two in step. Every file under `preview/` needs its own entry in
  `tauri.conf.json`'s resources.
- **The channel is two-way and typed.** Page → app is a union discriminated by `type`
  (`composition`, `selection`, `rebuilt`); app → page is `inspect`, `freeze`, `seek`,
  addressed to the preview origin rather than `*`. Incoming messages are checked against
  the origin `preview.start` reported **before** decoding, because these payloads carry file
  paths that end up in a prompt; with no origin yet, nothing is accepted.
- **`getSource` gives the component, the stack gives the parents.** Grab's display-name
  accessor returns a Remotion wrapper; the source lookup returns the real scene, so the
  component name comes from there. `projectFrames` keeps only frames inside the Remotion
  root and outside `node_modules`, and drops the `apply` frame Remotion's dev-mode JSX proxy
  leaves in every stack. Sourcemap paths are relative to the Remotion root, which is not
  necessarily the opened folder, so the page carries `window.remocn_root` next to
  `remocn_preferred` and `absolutise` joins against it.
- **The scene comes from the fiber, its file does not.** Walking `fiber.return` for props
  that look like a `Sequence` (finite `from` *and* `durationInFrames`) gives the scene's
  identity and timing cheaply. Its own file and line are *not* available that way — for a
  transition series the inner sequence element is created by Remotion, so the nearest
  injected stack resolves into Remotion's code. The scene component's location is already
  correct in the element's own stack, which is where it comes from.
- **The schema comes from the fiber too, and `refForOutline` was the wrong door.** An
  element's `Interactive` is found by walking `fiber.return` for a `controls` prop
  (`controlsAt` in `preview/tuning.ts`, over the one `preview/fiber.ts` walk that
  `sceneOf` and the label share). It used to be found by DOM containment against the
  sequence's `refForOutline` — and **Remotion resolves that to `null` for a
  `<Sequence layout="none">` unless the author passed `outlineRef` themselves**
  (measured in `Sequence.js`: the `wrapperRefForOutline` fallback exists only for the
  other layouts). Our template passes it; an agent-written component that declares a
  schema, passes its `controls` and animates correctly does not — so the properties
  pane silently never opened for it, which is exactly the shape of "the agent says it
  added easing and inspect selects a bare div". `controls` is a prop, so it is on the
  fiber whatever the author remembered to wire. `nearestInteractive` stays as the
  fallback, and a component selectable without having registered a sequence carrying its
  controls is **found again** rather than remembered: `rebind` in `preview/tuning.ts` walks
  every live target on *every* registration, resolving its anchor back to a node, then that
  node's `refForOutline` owners, and falling back to the fiber chain when none of them
  claim it. A cache of the controls of everything ever selected was the first version, and
  it is exactly wrong for a Player that unmounts a scene on every loop — the ids it held
  were dead by the time the next edit used them. `sameMappings` is what keeps rebinding
  idempotent: the synthetic `overrideId → nodePath` map is republished only when it really
  changed, or every registration would restart the render.
- **A `targetId` is `anchor::componentName`; an `instanceId` is the bare anchor.** They look
  redundant and are not. `controlsChain` routinely returns two links whose `hostOf` is the
  *same* DOM node — an `Interactive.Div` and the `withSchema` wrapper immediately around it
  render one element — so keying a target on the bare anchor would merge them into one card
  and lose the author's own schema behind Remotion's built-in style one; the component name
  is what separates them, with a positional `::<index>` behind that for the case where even
  that collides. `instanceId` stays the bare anchor because its job is the opposite question
  — *which instance of this element* — which is what the ordinal and the `PropsPanel` key
  are about.
- **The pane opens on what you pointed at, and offers its `Interactive` ancestors.** The
  studio's own conventions ask for `Interactive.Div` and its siblings around the markup
  (so styles are editable) **and** `Interactive.withSchema` around the component (so its
  own parameters are), so every agent-written component nests at least two. Selecting the
  nearest alone gave Remotion's element primitive every time — its built-in style schema
  is the Transform / Layer / Typography / Fill / Stroke groups — while the author's
  schema, one level out, covered the same pixels and could never be pointed at. Folding
  the chain into one list was the first fix and it was **wrong**: pointing at a word then
  showed the parameters of every component above it, up to the `CameraRig` framing the
  whole scene, and titled the pane after it. So `controlsChain` collects them
  innermost-first, the selection carries all of them (`tuning` is an array), and the pane
  renders one at a time with a switcher — `TargetChain`. It renders only when there is
  more than one, so the ordinary case gains no chrome. A link whose whole schema is
  `hidden` and `layout` — the `<Series>` chip, whose two controls hide the whole film —
  is dropped from the chain unless it is the innermost (`isPlumbing` in
  `preview/tuning.ts`).
  - **The agent's own name is what the pane is titled by, not the component's.** Remotion
    already delivers it: `withInteractivitySchema` appends a hidden `name` field to every
    schema and reads it into `controls.currentRuntimeValueDotNotation`, and
    `preview/tuning.ts` used to drop it with the rest of the hidden fields — which is why
    two clicks on two different claim lines drew byte-identical panes. `titleOf` is that
    `name`; `subtitleOf` is the line under it, `Div in WordPush ·
    src/components/WordPush.tsx:245`, reading the *link's* own location rather than the
    picked element's. The chips read `name ?? chainLabel(componentName)` and carry the raw
    component name as their `title`, `chainLabel` still stripping Remotion's
    `<Interactive.…>` spelling down to `Div`.
  - **Switching is a read, not a commit.** The whole chain arrives with the selection, so
    changing target is a local index move with no round trip. Consequently everything that
    spans the selection has to span the chain: `originals` is keyed per target (two of them
    may declare `style.opacity`), the Add count and the `tuningChanges` sent to the agent
    walk every target, and `resetTuning()` with no paths fans out one command per target —
    an edit made before the switch is still an edit. A per-row reset stays on the open one.
  - A `TuningField` therefore carries its own `targetId`, and `byTarget` routes a reset to
    the component that owns each path. `tune.set`/`tune.reset` already took a `targetId`,
    so the protocol did not move.
  - **Switching points at the thing on screen.** `<Series>` and `CameraRig` are names, not
    places, so the open link is boxed in the preview: `highlightTarget` paints **inside the
    preview document**, beside the hover box and for the same reason — it shares a document
    with the pixels, so it cannot drift from them, and no rectangle has to cross the wire.
    The nodes come from `hostOf`, the first DOM element each `Interactive`'s fiber renders,
    captured at pick time because the page is frozen for exactly as long as the card is
    open. The `highlight` command is keyed on the open link's **anchor** where it has one
    and its `overrideId` otherwise, so editing a value does not repaint the box; a key the
    chain does not know puts the box back on the node that was clicked, and only a rebuild
    clears the selection (`clearSelection()`, called from the hot-reload path in
    `preview/entry.tsx`). Disarming keeps it: turning Inspect off means stop picking, not
    forget what I picked.
- **The hover label names what you could tune, not what is holding it.** Grab's display
  name is the nearest fiber's, which inside a Remotion tree is routinely
  `RegularSequenceRefForwardingFunction` — true, and useless to read. `componentAt`
  answers with the interactive component's own `componentName` when there is one, and
  otherwise the nearest fiber whose name is neither a `WRAPPERS` entry nor Remotion
  plumbing (`*RefForwardingFunction`, `withInteractivitySchema(…)`).
- **Hit-testing and the hover box are ours; grab is only a source resolver.** Grab's overlay
  is taken down wholesale (`theme.enabled: false`) and `activate()` is never called, so what
  is left of it is `getSource`, `getStack` and `getDisplayName`. `preview/picker.ts` picks
  the element and `preview/inspect.ts` draws **two** boxes, **inside the preview document**,
  so the highlight still shares a document with the cursor and cannot lag: a thin hover box
  that lives and dies with the armed session, and a solid selection box that is module-level,
  made once and never taken down. `paint()` draws both, always. The selection box used to
  *be* the hover box (`hovered ?? pinned`), so what you had picked was visible only while the
  pointer was off the canvas, and a click the app then discarded made it vanish — which reads
  as a deselect. `onDown` sets the selection synchronously, before `report()` is awaited, and
  `report()` never nulls it. Grab's own hit-test could not be steered: `Options` exposes no
  filter, its `ElementAtPointOptions.filter` is internal, and its arrow keys are *spatial*
  navigation between neighbours, not a climb to the parent.
- **Selection identity is the picked DOM node, not Remotion's `overrideId`.** Every
  `Interactive.*` rendered from one JSX call site shares one id in this preview — the bundler
  injects a `stack` prop and `with-interactivity-schema.js` keys the id on it in a
  module-level map; measured, five instances, one id. So `sameElement` comparing `targetId`
  made four claim lines one element and threw away every click after the first.
  `preview/anchor.ts` mints an anchor instead — the nearest `data-design-id` plus `:nth-child`
  steps, falling back to the canvas — which is per instance and survives a remount of the same
  tree. The **edit** still lands on the call site, because one node path per `overrideId` is
  the whole of Remotion's override model; what changes is that the pane can say `2 of 4` about
  which instance was meant. `countedIn` orders same-id instances by their index into
  `container.querySelectorAll("*")` rather than by `compareDocumentPosition`, which biome's
  `noBitwiseOperators` forbids, and an instance whose `refForOutline` is null — the normal
  case for a `<Sequence layout="none">` — sorts after every placeable one on a single total
  key, because a comparator that switched between DOM order and registration order was
  non-transitive and let the engine decide the ordinal.
- **A re-click on the instance already open is not a new selection.** It posts `repeat: true`,
  which pulses the box (a class the selection stylesheet defines, and which
  `prefers-reduced-motion` turns off) and changes nothing else — reverting what had been
  tuned and reopening the chain at the innermost link is a punishing answer to a stray second
  click. But only while a card is open. Cancel never reaches the page, so the node it last
  picked is still what it compares against and the very next click on that element arrives as
  a repeat; with no card open that has to reopen, or the pane could never be brought back on
  the element it was closed on.
- **The picker answers three questions grab got wrong.** First, *what is actually under the
  cursor*: it walks `elementsFromPoint` and takes the first element that **paints something
  at that point** — a background, a border, a shadow, a replaced element, or text near the
  point — instead of the topmost transparent wrapper, where painting now excludes what the
  frame does not show. An element whose computed `opacity` is below 0.05, or whose
  `visibility` is not `visible`, paints nothing, so an unrevealed word before its entry frame
  is not pickable; a **masked** element (`maskImage`/`webkitMaskImage` other than `none`)
  paints only where it shows text, because a mask can hide any part of a surface and text is
  the one thing it is known to show. Grab already drops `display:none`,
  `visibility:hidden` and `opacity:0`, and transparent overlays — but only ones covering
  ≥90% of the viewport on both axes, which a mid-sized animated wrapper sails past, so
  those three tests are ours now, at our own thresholds (0.05 alpha, 80% of the container).
  Second, *how much of a click a surface deserves*: a candidate covering text beats one that
  merely paints a surface, and a surface whose box covers at least 80% of the container on
  **both** axes — a full-frame glow, a scene backdrop — loses to any later candidate under
  the same point that paints and covers less. The text test decides first and returns, so an
  ordinary hover pays no whole-scene text walk twice. Third, *how much of it you meant*:
  `climb` walks up while the element is an **inline wrapper** — inline-level and painting no
  surface of its own — and stops at the first block-level element, which is the line. That is
  deliberately *not* "a short element with siblings sharing its tag": that earlier rule
  missed the two commonest shapes a text animation actually has — a word wrapped in a
  wrapper of its own
  (`<span class=word><span>mind</span></span>`, where the inner span has no siblings) and a
  line that is one word long. Painting its own surface is what stops the climb at a
  highlighted chip inside a sentence, and block-level is what keeps a grid of cards from
  collapsing into the grid. Holding **Alt** turns every rule off and picks the literal
  topmost node. The rules are pure over the DOM and tested in happy-dom.
- **The text test is not element-own, and the widening is the word gap.** `nearText` walks
  every descendant text node with a `TreeWalker`, skipping text hidden by its own element or
  by an ancestor up to the candidate, and widens each text rect *horizontally* by 0.35 × the
  font size of its parent — so a click between two `inline-block` words lands on their line
  rather than on the marker or the backdrop behind it. `coversText` remains as `nearText`
  with an allowance of 0. The 0.35 is calibrated against WordPush's `0.22em` word margin;
  whether it is generous enough for looser trackings is a judgement to make on real scenes,
  not a measurement.
- **Tags are compared by `localName`, never `tagName`, because of SVG.** `tagName` upper-cases
  HTML elements but leaves SVG ones as authored, so `<svg>` reports `"svg"` and a set of
  upper-cased names misses every icon in the project. That single mistake broke both halves
  at once: an icon counted as painting nothing, so the hit test walked past it, and it
  computed to `display: inline`, so `climb` stepped straight over it. Anything in the SVG
  namespace is now **a drawing**: it always paints once it is on screen — the visibility test
  above runs first, so an `<svg>` at `opacity: 0` is no more pickable than a faded word — and
  the browser's own SVG hit-testing is
  `visiblePainted`, so being returned by `elementsFromPoint` already proves the point is on
  drawn geometry, and `fill` would never show up as a `background-color` anyway — it is never
  an inline wrapper, and `climb` folds any shape inside it up to the outermost `<svg>`,
  because what you pointed at is the icon and not one of its paths. Alt still picks the path.
  HTML inside a `foreignObject` falls out of this by itself, being in the XHTML namespace.
- **Pointer events are swallowed while armed.** `pointerdown`, `pointerup` and `click` are
  captured on `window` and stopped inside the canvas — otherwise Remotion's `clickToPlay`
  would toggle playback under every pick. Hover is recomputed on a `requestAnimationFrame`
  tick rather than per event.
- **Arming forces the canvas hit-testable, and without that a real project is unpickable.**
  `elementsFromPoint` skips a whole `pointer-events: none` subtree, and scenes routinely put
  that on an overlay layer so a title cannot eat `clickToPlay` — so a click on the words
  fell *through* them and picked the scene underneath, with nothing on screen to say why.
  `armInspect` therefore injects `.__remotion-player, .__remotion-player * { pointer-events:
  auto !important }` for the life of the session and removes it on disarm. It costs the page
  nothing, because every pointer event over the canvas is already swallowed by the rule
  above; a picker that reads the DOM cannot see what the DOM refuses to hit-test.
- **Markers and the comment card render in the app window**, over the iframe, in an
  `inset-0 pointer-events-none` overlay so hover and click still reach the page. Marker
  geometry is **normalised to the preview page's viewport**, which is exactly the iframe
  element's box, so a resize keeps markers on their elements; `cardPlacement` is a pure
  function over three rectangles and is tested without rendering anything.
- **Nothing freezes the frame any more, and picking is a mode rather than a modal.**
  The card used to send `freeze`, which stopped the picker tracking "so the frame does not
  flicker with highlights while you type" — reasoning written when the card floated *over*
  the frame. With a pane beside it the premise is gone: the pointer does not move while
  someone types, and the highlight under the cursor is the only thing that says what the
  next click would take. It also took the click with it, so the only way to reach the next
  element was to close the pane and arm again. The command is deleted rather than left
  unsent — a mechanism nothing sends is worse than no mechanism. What remains: a click
  *on the frame itself* is swallowed either way, or it would reach Remotion's
  `clickToPlay` underneath — and only on the frame itself. The swallow used to test the
  canvas **rectangle**, which is also the rectangle the Player's transport bar is drawn
  over: the bar appeared on hover and did nothing when clicked, because every one of its
  clicks and drags was eaten by a picker that never wanted them. `overCanvas` now asks
  `document.elementsFromPoint` what is actually under the point and stops the event only
  when the canvas contains it, which costs picking nothing — the overlays are
  `pointer-events: none` — and hands the transport bar back. A document that cannot
  hit-test at all falls back to the rectangle, which is what happy-dom does.
  - **Picking elsewhere abandons what was pending, exactly as Cancel does.** The drafts
    live in the preview keyed by target, so a card dropped without reverting would leave
    the frame showing values the pane no longer lists and the agent will never be told
    about. Picking the *same* element again is a no-op rather than a revert, since a stray
    second click must not cost the work.
  - **The card outlives both the mode and the message.** Turning Inspect off means "stop
    picking", and Add means "send this" — neither means "close the pane", and closing it
    would silently revert work nobody asked to undo. Only Cancel closes, and its tooltip
    already says it restores the originals. Add therefore **rebases the baseline** to the
    values it just sent: without that a second Add would ask for the first one's change
    all over again. It reads the card through the ref rather than through state, so an Add
    made in the same tick as the last drag still carries it, and the comment field empties
    itself, since it is no longer unmounted between messages.
  - **Abandoning is only for what was never sent.** Picking elsewhere reverts a card that
    still has changes; a card whose changes have been added is left alone, because those
    values are what its message asks for and reverting them would leave the frame
    contradicting the request.
  - The chain strip takes a wheel sideways (`useWheelScroll` over the pure `wheelScroll`),
    because it scrolls only that way and carries no scrollbar to grab — a plain mouse would
    otherwise never reach the chips clipped off the edge. It declines the gesture when it
    cannot move, so a row two chips wide never swallows the wheel of the pane beneath it.
- **The card is not a Popover on purpose.** A popover brings Esc-to-close, outside-click-to-
  close and a focus trap, and outside-click in this mode means "select the next element".
  While it is open the page is sent `freeze`, which stops the picker tracking and ignores
  clicks, so the frame does not flicker with highlights while you type.
- **The prompt keeps the token in the sentence and appends a block per selection at the end.**
  Unlike an image, an element's payload is dozens of lines, and splicing it inline would tear
  the sentence apart. There is one block per entry in the list, not per mention, so two
  selections of the same element stay separate and a repeated mention does not duplicate the
  payload. With no selections the content is byte-for-byte what it was.
- **Availability is narrow, and the reasons differ.** Inspect is off while the composer is
  locked, while the preview is not serving, and while the preview's project differs from the
  open session's — the preview follows the *selected* project and the chat follows the *open
  session's*, and those can diverge. Element references are dropped when the open session
  moves to another project; text and images are left alone. That drop fires only on a real
  switch, never on the first `null →` resolve at boot.
- **A rebuild clears the markers and disarms**, because a box drawn over the old render lies
  about the new one, and the page that comes back has forgotten it was armed. Unsent
  references and whatever was being typed are untouched — an agent saving a file must not
  delete your draft. Marking references *stale* per changed file is deliberately deferred.
  **Disarming does not.** Add's markers and the open card both outlive the mode, so
  `InspectOverlay` is mounted whenever there is a card or a marker rather than only while
  armed; the overlay is `pointer-events-none`, so clicks are unaffected.
- **The selection box belongs to the card, not to the mode** (REM-330). Disarming keeps it —
  turning Inspect off means stop picking, not forget what I picked — but *Cancel* closes the
  pane, and a box left on the frame then refers to nothing on screen. It was worse than
  left: `highlight` carried `targetId: null` for two different things, a card with no chain
  (which wants the picked element boxed) and no card at all (which wants nothing drawn), so
  Cancel moved the box back onto the picked element and the effect, guarded on `isArmed`,
  never got to take it down. The command carries `open` now and the effect is not guarded,
  so closing the pane clears the box whether or not the mode is still on. The hover box was
  never the culprit — `stop()` removes it and its label on disarm — but both boxes draw the
  same `Name · tag` label, which is what made them look alike.
- **The chip names what the pane named** (REM-336). It read grab's source resolution, which
  answers with the function React rendered — `TitleBase`, an implementation detail that is
  not exported and never appears anywhere the person looked — while the pane honours the
  `componentName` declared on `withSchema` in three places. The chip is the only thing left
  on screen once the pane closes, so it reads `titleOf` on the link that was open when Add
  was pressed, falling back to the resolved component for a selection with no schema.
  `TuningChange.owner` was already right: `ownerOf` has always taken the target's declared
  name, so the block the agent gets never said `TitleBase`.
- **A selection with no source is still usable**, travelling with markup, component name and
  frame, and says so on its chip. Failing closed would make the feature intermittently and
  silently useless.
- **Arming is acknowledged, so the button cannot lie.** The page answers every `inspect`
  command with a status — `armed`, `disarmed`, `inert`, `no-canvas`, `no-grab` — and whether
  it held a player ref to pause. The pane prints anything that is not a clean arm, including
  "the preview never answered" once the silence outlasts `PATIENCE`, which is what a stale
  compiled page looks like from the app's side. A disabled button carries the reason it is
  disabled on its tooltip. Both exist because the first version of this failed silently in
  three different places at once and none of them were distinguishable from the outside.
- `PromptElement` carries `fps` as well as `frame`, which the prototype's shape did not: it is
  what lets the chip read `0:01.4` rather than a frame number, and it makes the block's frame
  counts interpretable. `file` is nullable for the same reason the chip needs to say "no
  source".
- **The first resolution after a rebuild costs ~210 ms** — the sourcemap fetch and parse —
  and every one after it is 0 ms, so arming warms it up with a throwaway `getStack`.
- **A curve is inert at a settled frame, so the pane moves the frame.** Every generated
  `interpolate` clamps both sides, so outside an element's own window every bezier yields the
  same constant — which is why dragging an easing looked like nothing happening, and why the
  agent itself wrote *"Set from the preview. Still inert"* into
  `need-sponsor/scenes/AskScene.tsx`. The selection now carries `window`, the element's own
  sequence span from `preview/timing.ts`, and the pane leads with a time strip: the frozen
  frame in mono, a range over `[from, until]` that seeks, and Replay. An edit to a field in
  Entry, Exit, Effects or Timing, or to anything whose path ends in `easing`, schedules **one**
  replay 250 ms after the last flush — a forked `Effect.sleep` each flush interrupts and
  re-forks, never a `setTimeout` — and is skipped outright while the preview is already
  playing. **Picking still does not seek**: the paused frame is the one being judged.
- **The playhead crosses the wire, and the boxes repaint with it.** The entry subscribes to the
  Player's own `frameupdate`/`play`/`pause` and posts `playhead` at most once per animation
  frame while playing, immediately on play, pause and seek; every `frameupdate` also calls
  `repaint()`, so the selection box tracks an element that is moving instead of lying about
  where it was. While armed the canvas wears a crosshair, restored on disarm, and the status
  slot under the frame reads `Inspect on · f 412` whenever nothing more urgent is using it.
  - **The live frame is deliberately not in the context value.** `usePreview` used to hold it
    in React state, which was free while it moved only on `selection`, `capture` and `rebuilt`
    — and cost the whole application once a `playhead` arrived every animation frame: `frame`
    is in `PreviewControl`'s memo, `PreviewControl` is in `tools`, `tools` is in the studio
    context, and ten components read that context, so playing the preview re-rendered the
    transcript, the sidebar and the composer sixty times a second. It is a ref with its own
    listener set now, read through `usePreviewFrame` (a `useSyncExternalStore`) by exactly the
    two things that draw it — the time strip and the armed readout — while the turn's
    `playing` frame is a stable getter called at send time, which is also the more correct
    moment to read it. The readout carries **no** `role="status"`: a number that changes every
    frame must never be handed to a screen reader, the same rule the pane's running-time
    ticker already follows.
- **A static override on an animated key replaces the animation with a constant, and the pane
  says so before you do it.** While a card is open and the playhead has moved off the frame it
  was picked at, the app asks the runtime what it is really holding — `tuning.read`, throttled
  to once per 250 ms with one trailing read when the frame settles, answered with
  `tuning.values` off `currentRuntimeValueDotNotation`. That reading is the component's own
  *incoming props* (`readValuesFromProps` in `with-interactivity-schema.js`), taken before
  Remotion merges the drag overrides in, which is exactly what makes it an animation detector:
  a key the code animates reports a different value at a different frame. A field whose reading
  has moved off its `originals` entry is `animated` — its row wears that badge and the hint *a
  fixed value here replaces the animation*, and the control stays editable. **The mark is
  sticky**, because a key does not stop animating in code when somebody overrides it; making
  it the latest read's answer instead cleared the badge the moment the field was edited, and
  took `sampled` off the change with it.
  - **What that reading cannot answer is whether an override bound**, and the first version
    tried: a field with a draft whose reading differed from the draft was reported as *the
    preview is no longer applying this value*. It differs **by construction** — the reading is
    pre-override — so the refusal fired on every edited field the moment the playhead moved.
    There is no merged reading to ask for: `computeEffectiveSchemaValuesDotNotation`'s result
    stays inside the wrapper and `controls` carries only the pre-override values. The
    detector is gone rather than left firing; a runtime that genuinely refuses an override
    already says so in `tune.set`'s own answer, which is where the per-row refusal comes from.
  - Because the `from` of an animated key is a runtime sample rather than a line of source, its
    `TuningChange` carries `sampled: true` and reaches the agent as
    `from (runtime value at frame N, animated in code; change the landing value, not the
    frame)`.
