## Context

The canvas selection is drawn by the preview runtime (`preview/inspect.ts`
`place()`): a box and a name label, `position: fixed` in viewport coordinates,
appended to the slot's overlay root. On the native canvas that root is a plain
div inside `native.overlays` — the webview's own light DOM, not the shadow root
the video renders into. For a managed object with explicit geometry the name
label is hidden and `preview/geometry.ts` draws its own frame and a size readout
("200 × 100") below the object instead.

The chat's working indicator is `Thinking` (`components/studio/thinking.tsx`): a
`DotmSquare11` dot-matrix mark with the `grad-prism` preset beside the task
phrase. `DotmSquare11` already honours reduced motion through
`usePrefersReducedMotion` (a still ring pattern instead of the ripple).

## Goals / Non-Goals

**Goals:** the same mark, not a copy; beside the label the selection shows; in
step with the label every frame; gone when the turn ends; no cost when no turn
runs.

**Non-Goals:** guessing which element the agent edits; any text next to the
mark; changing the label.

## Decisions

### The window draws the mark, the runtime only marks its labels

The runtime is compiled by the project's webpack and cannot import the app's
components, `lib/dotmatrix-core.tsx` or `components/dotmatrix-loader.css`; a
runtime-side mark would be a hand copy of 1,800 lines of dot matrix that drifts.
Because the labels already live in the webview's DOM, the window can find them
and read where they are. The runtime's only change is one attribute,
`data-remocn-selection-label`, on the selection label and on the geometry size
label — the same move that `data-remocn-selection-bounds` made for the rulers
and Zoom to selection. `lib/studio/preview-camera.ts` names it for the webview
(`SELECTION_LABEL_ATTR`), and `preview/inspect.test.ts` checks the runtime's
label against that constant so the two cannot part.

State: whether the turn is working is webview state (`useStudioTurn`); the label
is runtime DOM. Nothing crosses the wire: no host frame, no `shared/ipc.ts`
change, no protocol bump, no settings key, no migration.

### Beside the label, not inside it

A portal into the label was the first idea and was ruled out by the code: both
`place()` and the geometry editor write `label.textContent` on every paint,
which deletes any child, and React unmounting a portal child the runtime already
removed throws. Moving the name into a child span of two different labels, plus
a slot and a way to find it again after each rebuild recreates the labels, is
more runtime change than the feature. Inside the accent-coloured pill the
prism's cyan end (`#12c2e9`) would also vanish against the accent
(`oklch(0.715 0.143 215)`). The mark sits 4px after the label's right edge,
centred on it, which is also where Paper puts its indicator.

### Following the label: a MutationObserver, not a frame loop

`useCanvasWorking` observes the overlay root (`style` attribute, child list and
character data, subtree) only while the turn works. The runtime moves a label by
writing its style, and a mutation callback runs at the next microtask
checkpoint — after the runtime's writes and before the frame is painted — so the
mark is placed in the same frame as the label. A `requestAnimationFrame` loop
was rejected on ordering: the loop's callback, queued in the previous frame, runs
before the runtime's paint for this frame, which would leave the mark one frame
behind while panning. That is reasoned from rAF callback order, not measured.

Each callback does one `querySelectorAll` and one `getBoundingClientRect` on the
labels and writes the mark's `left`/`top` only when they changed; the mark is
`position: fixed` like the labels, inside a wrapper that carries the same
`clip-path: inset(0)` as `native.overlays`, so it is clipped to the canvas the
same way. When no label has a size, the mark is `hidden`.

### When it shows

Working is `isRunning && permission === null && source === null` on the open
chat's turn — the chat's own "waiting on the person" test. The chat also hides
its marker once assistant text streams, because the text shows progress; the
canvas shows no text, so its mark stays for the whole turn. The open chat is the
one the canvas plays (the open chat determines everything), so its turn is the
one working on what is on screen.

The mark follows the canvas selection, not the elements a message referenced:
`PromptElement` carries file, line, column and markup but no per-instance
anchor, and after a rebuild the markup is the agent's new markup, so matching a
reference to what is selected would be a guess. See Open Questions.

### One mark for both surfaces, cheap to keep

`ThinkingMark` is the `DotmSquare11` with the chat's props, exported from
`thinking.tsx`; `Thinking` renders it, so a change to the mark reaches both.
`CanvasWorking` is the only canvas component that reads `useStudioTurn`, whose
value changes on every streamed event; the mark it renders is memoised, so those
events re-render a boolean check, not the dot matrix, and never the canvas.

## Risks / Trade-offs

- A selection kept on an unrelated element shows the mark while the agent works
  elsewhere in the video. Accepted for now; the mark means "a turn is working on
  this video", placed where the person is looking.
- The observer fires once per runtime paint while a turn works, which during
  playback is once per frame: one query and one rect read. Nothing is observed
  when no turn runs.
- Failure direction: if the label cannot be found (hidden, removed, a runtime
  without the attribute) the mark is simply not drawn. That is silent by design
  — it is a decoration of the label, and the chat's marker still says the turn
  is working.

## Open Questions

- Should the mark appear only when the running turn's message referenced the
  selected element (`[Element #N]`)? That needs a per-instance anchor on
  `PromptElement`, which is a `shared/ipc.ts` change.
- Should it also show while another chat of the same video runs a turn, not only
  the open one?
