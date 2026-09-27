## Why

In Paper, while the AI is building or changing a design, the canvas shows a live
working indicator next to the artboard's name. In the studio the only sign that a
turn is working was the "Thinking…" marker in the chat. The first answer (from the
user, no ticket: "make a building animation like in Paper — use our animation, the
one in thinking, and render it on the canvas next to the name when you select an
element") put the chat's mark beside the selected element's label. Seen in the
running app, that was the wrong place: "the animation must render above the scene
regardless of whether something is selected." With nothing selected — the common
case while the agent builds a video from a message — the canvas showed nothing.

Paper and Figma both name a frame with a small label just above its top-left
corner, and that is where the indicator belongs: one place, always there while the
frame is.

## What Changes

- The canvas names the video frame: the open video's name in small muted text just
  above the frame's top-left corner, as Paper and Figma label an artboard. It
  follows the camera exactly, keeps its screen size at any zoom, is cut short at
  the frame's right edge, and is hidden when its place is off the canvas or under
  the toolbar or rulers.
- While the open chat's turn is running and nothing waits on the person (no
  permission card, no source question), the chat's thinking mark — the same
  dot-matrix mark, not a copy — sits just after that name, with or without a
  selection. It leaves when the turn ends.
- The mark beside the selected element's label is removed, and with it the
  `data-remocn-selection-label` attribute the preview runtime set so the window
  could find that label: one place for the indicator, not two.
- Reduced motion shows the mark still, exactly as the chat does.
- `ThinkingMark` stays extracted from `Thinking`, so the chat and the canvas cannot
  drift apart.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: the frame carries the video's name and shows a turn
  working.

## Non-goals

- Deciding which element the agent is changing, or marking elements. The turn
  does not say which element it edits; the frame is what the turn works on.
- Any text beside the mark ("Working…", the task phrase, a timer): the chat says
  what the turn is doing.
- Selecting the video by clicking its name, or renaming it there, as Figma
  allows. The label is a name tag, not a control.
- A label in the full-screen view, which shows the video and nothing else.
- Keeping the label on screen when the frame's top edge is not: it belongs to that
  edge, as a frame label does in Figma and Paper.

## Impact

- Preview runtime (`preview/geometry.ts`, `preview/inspect.ts`): the
  `data-remocn-selection-label` attribute added by the first version is removed;
  the runtime is back to what it was before this change.
- Webview: `lib/studio/preview-camera.ts` gains `frameLabelOf`, the pure placement;
  `hooks/use-frame-label.ts` (new) places the label from the camera and decides
  when a turn is working; `components/studio/canvas-frame-label.tsx` (new) renders
  the name and the memoised mark; `components/studio/canvas-preview.tsx` mounts it
  in place of the selection mark; `hooks/use-preview-camera.ts` exports its
  `insetsOf` measure. `hooks/use-canvas-working.ts` and
  `components/studio/canvas-working.tsx` are deleted.
- No IPC, sidecar, Rust, settings or history change.
