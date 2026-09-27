## Context

The canvas (`components/studio/canvas-preview.tsx`) draws the video in a stage
div whose inline `transform` is the camera: `translate(x, y) scale(zoom)` from the
viewport's top-left, so the frame's top-left corner on screen is `(camera.x,
camera.y)`. `usePreviewCamera` writes that transform itself on every camera step
(`show()`), without a React render, and then calls the listeners of its
`view.subscribe`; the surround and the pixel grid follow the camera through
`useCameraView`, which re-renders only their own small component. Chrome that
covers the canvas's edges carries `data-canvas-occludes` (the top ruler and the
toolbar band on top, the left ruler, the inspector on the right, the playback
panel at the bottom), and `insetsOf` turns those into viewport insets for Fit.

The first version of this change put the chat's `ThinkingMark` beside the
selected element's label, found through a `data-remocn-selection-label` attribute
the runtime set and followed through a MutationObserver on the overlay root. The
user's verdict in the running app: the animation must be on the scene regardless
of selection. With nothing selected, nothing showed.

## Goals / Non-Goals

**Goals:** a frame label as Paper and Figma draw one — the video's name above the
frame's top-left corner — carrying the same mark while a turn works; exactly in
step with the camera; constant screen size; never over the video; no React render
per camera frame and none of the canvas per streamed turn event.

**Non-Goals:** marking elements; text beside the mark; a clickable label; a
label in the full-screen view.

## Decisions

### One place: the frame label, and the selection mark goes

The user's words ask for the mark "regardless of selection", which the frame
label satisfies alone. Keeping the selection mark too would show two animations
for one turn whenever something is selected, one of them on an element the agent
may not be touching (the first version's own recorded risk). So the selection
mark, its MutationObserver and the runtime's `data-remocn-selection-label` are
removed; nothing else used that attribute (`grep` over `app components hooks lib
preview sidecar shared`). The runtime files are restored byte for byte to their
state before the first version.

### Placed by the camera's own subscription, not by React

`useFrameLabel` subscribes to `view.subscribe` in a layout effect and, on every
camera step, computes the place with the pure `frameLabelOf` and writes the
label's `transform` and `max-width` directly, only when they changed. `show()`
calls its listeners synchronously right after it writes the stage's transform, so
the label moves in the same task as the video — the same frame, not one behind —
and nothing re-renders. `useCameraView` was the other candidate; it re-renders a
component per camera frame through `useSyncExternalStore`, acceptable for the
surround's four rects but not needed for one element with two style writes.
Positions are rounded to whole pixels so the text is not resampled mid-pixel.

The label is outside the stage's transform, so it keeps its size at any zoom, and
it sits above the frame (`y = camera.y − 6 − 16`), so it never covers the video.
Its stacking is `z-[7]`: above the surround (5) and pixel grid (6) that dim or hide
what lies outside the frame, below the runtime's overlays (10), the rulers (15)
and the toolbar and inspector (20).

### Where it hides, and why there

`frameLabelOf` returns nothing — and the label is `hidden` — when:

- the label's box would start above the top inset. The top inset is the bottom
  of the toolbar band (with the top ruler above it when rulers are on). The toolbar
  is opaque buttons over a transparent band, so a label under it would show in
  pieces between the buttons: hiding it whole reads better than half a name.
  Fit already leaves 24px between that band and the frame, and the label needs
  22px, so after Fit the label is always shown;
- its bottom would fall below the bottom inset (under the playback panel) — the
  frame's top edge is then at the bottom of the canvas or past it;
- less than 32px of the frame's top edge is on the unobscured canvas, too little
  for the mark and a letter.

Horizontally, the label starts at `max(frameLeft, leftInset)` and is capped at the
shown part of the top edge (`min(frameRight, width − rightInset)`), truncated
with an ellipsis; the mark is `shrink-0`, so the name gives way first. Clamping
the left end differs from Figma, which lets the label slide off with the frame;
without it, zooming into the frame's top edge would hide the indicator exactly
when the person is looking closely at the video.

### Measuring the chrome once per change, not per frame

The insets are measured when the effect runs — on mount, on a viewport resize
(`bounds`), a new video size, and when the rulers or the inspector are shown or
hidden (passed in as `chrome`, since those change the insets without moving the
camera) — and the per-frame placement is arithmetic only. Measuring inside the
listener would read three or four rects right after the stage's transform write,
forcing a style recalculation per camera frame while the canvas is being panned.
The toolbar band's height is fixed (`pt-2` + the `h-10` header), so nothing else
moves the insets.

### When the mark shows, and what re-renders

Working is `isRunning && permission === null && source === null` on the open
chat's turn — the chat's own "waiting on the person" test, now the exported
`isTurnWorking`. The open chat is the one the canvas plays, so its turn is the one
working on what is on screen. `FrameWorking` is the only component under the label
that reads `useStudioTurn`, whose value changes on every streamed event; it
re-renders a boolean check and returns the memoised `ThinkingMark`, so a streamed
event neither re-renders the canvas nor the label's placement, and never the dot
matrix. `DotmSquare11` already draws a still pattern under reduced motion.

State: the name and the working test are webview state (`useStudio`,
`useStudioTurn`); the camera is webview state. Nothing crosses the wire: no host
frame, no `shared/ipc.ts` change, no protocol bump, no settings key, no migration.

## Risks / Trade-offs

- The label's text is the video's name as the inspector shows it; a long name is
  cut at the frame's width, which at a low zoom is short. The inspector still
  shows it in full.
- The label is drawn over the dimmed surround, where content outside the frame
  can show through in dim mode; the label is muted text on that, readable against
  the 72% background mix. Measured only by eye in the design, to be checked in the
  running app.
- Failure direction: if the camera cannot be measured (zero bounds, invalid
  camera) the label is simply not drawn; the chat's marker still says the turn is
  working. It is a decoration of the frame and fails silent by design.

## Open Questions

- Should the label also show while another chat of the same video runs a turn, not
  only the open one?
