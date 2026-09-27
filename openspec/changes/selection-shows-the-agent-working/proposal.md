## Why

In Paper, while the AI is building or changing a part of the design, the canvas
shows a live working indicator next to that part's name. In the studio the only
sign that a turn is working is the "Thinking…" marker in the chat: a person who
selected an element on the canvas, asked for a change to it and kept their eyes
on the canvas sees nothing move until the rebuild lands. The request (from the
user, no ticket): "make a building animation like in Paper — use our animation,
the one in thinking, and render it on the canvas next to the name when you
select an element."

## What Changes

- While the open chat's turn is running and nothing is waiting on the person
  (no permission card, no source question), the selected element's label on the
  canvas carries the chat's thinking animation — the same dot-matrix mark, not a
  copy — just after the label.
- It follows the label wherever the label goes (pan, zoom, playback, a rebuild
  that re-picks the element) and goes away with it: nothing selected, the label
  hidden while text is edited inline, or the turn finished, failed or stopped.
- For a managed object with explicit geometry, whose label is its size readout,
  the mark sits beside that label.
- Reduced motion shows the mark still, exactly as the chat does.
- The mark is extracted from `Thinking` into a shared `ThinkingMark`, so the
  chat and the canvas cannot drift apart.

## Capabilities

### Modified Capabilities

- `preview/inspect`: the selected element's label shows that a turn is working.

## Non-goals

- Deciding which element the agent is actually changing. The turn does not say
  which element it edits, and the `[Element #N]` references a message carries
  have no per-instance identity to match against the canvas, so the mark follows
  the canvas selection, not a guess at the target.
- A mark on unselected elements, on the object list rows or on the seek bar.
- Any text beside the mark ("Working…", the task phrase, a timer): the chat
  already says what the turn is doing.
- Changing the label itself, its colour or where the runtime puts it.

## Impact

- Preview runtime (`preview/geometry.ts`, `preview/inspect.ts`): the selection
  label and the geometry size label carry a `data-remocn-selection-label`
  attribute, the same way the selection box already carries
  `data-remocn-selection-bounds`. Nothing else in the runtime changes.
- Webview: `hooks/use-canvas-working.ts` (new) decides when the mark shows and
  keeps it beside the label; `components/studio/canvas-working.tsx` (new)
  renders it; `components/studio/thinking.tsx` exports `ThinkingMark`;
  `components/studio/canvas-preview.tsx` mounts it;
  `lib/studio/preview-camera.ts` names the attribute.
- No IPC, sidecar, Rust, settings or history change.
