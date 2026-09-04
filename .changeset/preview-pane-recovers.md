---
"remocn-studio": patch
---

The preview pane comes back, and says things in words.

- After a sidecar crash the pane showed the bare word `cancelled` and stayed
  dead until someone found the unlabelled Restart button. It now comes back on
  its own when the sidecar does, and the gap is worded.
- A failed Snapshot printed the renderer's raw error — a wall of percent-encoded
  URL, clipped where it ran off the pane, ending in Remotion's advice to buy more
  disk. It now names the asset that would not load, and nothing can overflow the
  pane again.
- The Inspect box no longer stays painted on the frame after Cancel: it belongs
  to the properties pane, not to the mode, so disarming still keeps it while the
  pane is open.
- An element chip is named the way the properties pane names it — the component
  the person saw, not the wrapped function behind it.
