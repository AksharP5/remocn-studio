---
"remocn-studio": minor
---

Edit managed geometry on paused animation frames through explicit invertible pose mappings. Account for local scale and rotated, uniformly scaled ancestors, preserve the opposite resize anchor, cancel unfinished gestures when the playhead changes, and save base values with one Undo. Ship the opt-in v5 runtime without replacing authored runtimes.
