---
"remocn-studio": minor
---

Inspect can now tune a scene live, in a properties pane of its own. Clicking a
component that declares an `InteractivitySchema` (exported through
`Interactive.withSchema()`, with its `controls` passed to its own `<Sequence>`)
opens a resizable pane to the right of the preview: every supported field —
numbers, booleans, colors, enum variants, CSS transforms, UV coordinates and
constrained arrays — rerenders the Preview as it changes, coalesced to one
command per animation frame, and only the selected instance moves when the same
component is mounted twice. It is shaped like a design tool's inspector:
sections for Transform, Layer, Typography, Fill and Stroke ahead of the
component's own parameters, every number typed or stepped with the arrow keys
(shift for ten) through DialKit-backed tactile sliders, with safe unbounded
values retaining the scrub-capable numeric fallback. Two-value properties like
offset and transform origin split into editable X and Y that keep their units,
opacity is shown as a percentage, and colors use DialKit's swatch and editable
hex treatment. Remocn remains the owner of Preview state and AI diffs; DialKit
is the controlled presentation layer. Cancel and per-row Reset restore the
original values; Add keeps the live result on screen and hands the agent a
structured `Requested changes` diff — paths and values, never runtime target
ids. A rebuild clears the overrides and marks saved diffs `Preview changed`.
Elements with no schema keep the compact comment card over the frame, and raw
`TransitionSeries.Transition` factory arguments stay out of scope for this
version.

Inspect also picks elements it used to fall straight through: a scene that
puts `pointer-events: none` on an overlay layer — the usual way to keep a
title from eating `clickToPlay` — is hidden from `elementsFromPoint`, so
clicking the words selected the scene behind them. The canvas is forced
hit-testable while Inspect is armed.
