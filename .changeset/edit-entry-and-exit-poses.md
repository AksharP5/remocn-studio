---
"remocn-studio": patch
---

Edit where an object enters from and leaves to by dragging it on the canvas.
The new `geometryBetween` helper in studio-objects-v5 moves an object between
two field-backed poses; early in the move a drag edits the start pose, late in
it the resting or end pose. The canvas names the edited pose and draws the other
one as an outline with the path between them. Objects outside the frame can now
be selected.
