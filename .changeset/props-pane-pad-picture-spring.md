---
"remocn-studio": patch
---

The properties pane picks up the rest of dialkit's controls. A pair of numbers
that is really a place on the frame — an offset, a transform origin, a UV
coordinate — is one pad now instead of two sliders, with its Y the way up a pad
has it rather than the way down CSS writes it. A picture is a field at last:
Remotion's `asset` type was not in the pane's list at all, so an element made of
an image opened with the image missing and nothing saying why; it is a picker
over the project's own `public/` now, and changing it changes the preview. The
three numbers of a `spring()` are drawn as one response above them rather than
three unrelated dials, and the conventions ask the agent to name them so. And
the pane's sections fold, remembered between elements, because an element on a
real video opens with eight of them.
