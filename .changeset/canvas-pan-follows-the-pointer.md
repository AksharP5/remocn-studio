---
"remocn-studio": patch
---

Panning the canvas follows the pointer: drag, wheel and pinch updates are
applied once per frame, and the inspector no longer re-renders while the view
moves, so Space-drag no longer lags behind the mouse or moves in jerks.
