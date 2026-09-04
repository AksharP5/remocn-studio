---
"remocn-studio": patch
---

Dragging the chat/preview divider to the window edge no longer strands the
preview. The panel collapsing inside react-resizable-panels was a different
state from the app's own "preview hidden", and the header renders the way back
off the latter — so one drag took the preview along with the toggle, Inspect,
Snapshot and Export, in a layout the studio then persisted across launches. A
collapse the panel reports now folds into the one flag, so the existing "Show
the preview" button is there, and a layout already stored collapsed heals on
the next launch.
