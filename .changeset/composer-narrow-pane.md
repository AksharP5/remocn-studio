---
"remocn-studio": patch
---

The composer's control row now adapts to a narrow chat pane instead of pushing
the Send button out of the box. `buttonVariants` carries `shrink-0` in its base,
so the row could not give: dragged past roughly 500px the chips simply overflowed
the rounded container and Send was clipped by the pane's edge.

The row is a container of its own, because the pane is resized independently of
the window — a viewport breakpoint would measure the wrong thing. Two things
share the work. The model chip is the elastic one, `min-w-0 shrink` with a
truncating label, so no combination of labels can overflow the box; and the
labels collapse in the order of what is worth reading, Effort first (its labels
are the longest and it is the value changed least), Mode last, each chip keeping
its icon, its chevron and now a `title` carrying what the hidden label said. The
Queue button that appears during a running turn collapses with Effort, since
Queue beside Stop is the widest arrangement the row ever holds.

Collapse is decided by width alone, never by which mode or model happens to be
selected, so dragging the splitter moves through the same two steps every time.
