---
"remocn-studio": patch
---

Inspect now shows you what you picked, and knows which one of them it is.

The selection is a box of its own. It used to be the hover box — `hovered ??
pinned` — so what you had clicked was visible only while the pointer was off the
canvas, and a click the app then discarded made it disappear, which reads as a
deselect. There are two boxes now: a thin hover box that lives and dies with the
armed session, and a solid selection box that is module-level, set
synchronously on `pointerdown` before anything is awaited, and cleared only by a
rebuild. Turning Inspect off keeps it, along with any Add markers and the open
card: off means stop picking, not forget what I picked.

Identity is the picked DOM node, not Remotion's `overrideId`. Every
`Interactive.*` rendered from one JSX call site shares one id — the bundler
injects a `stack` prop and `with-interactivity-schema.js` keys the id on it in a
module-level map; measured, five instances, one id. So comparing that id made
four claim lines one element and threw away every click after the first.
`preview/anchor.ts` mints an anchor instead — the nearest `data-design-id` plus
`:nth-child` steps, falling back to the canvas — which is per instance and
survives a remount. The edit still lands on the call site, because one node path
per `overrideId` is the whole of Remotion's override model; what changes is that
the pane can say `2 of 4` about which instance was meant. A literal re-click on
the instance already open pulses the box and changes nothing else — but only
while a card is open, since Cancel never reaches the page and the next click on
that element would otherwise be a dead one.

The pane is titled by the name the agent wrote. Remotion already delivers it —
it appends a hidden `name` field to every schema and reads it into
`controls.currentRuntimeValueDotNotation` — and `preview/tuning.ts` was dropping
it with the rest of the hidden fields, which is why two clicks on two different
lines drew byte-identical panes. Under the title is where the link lives, `Div
in WordPush · src/components/WordPush.tsx:245`. A chain link whose whole schema
is `hidden` and `layout` — the `<Series>` chip, whose two controls hide the
whole film — is dropped unless it is the innermost.

The picker aims at what the person sees. An element whose computed `opacity` is
below 0.05, or whose `visibility` is not `visible`, paints nothing, so an
unrevealed word before its entry frame is no longer pickable; a masked element
paints only where it shows text, because a mask can hide any part of a surface
and text is the one thing it is known to show. The text test now walks every
descendant text node and widens each rect horizontally by 0.35 × its font size —
the word gap — so a click between two `inline-block` words lands on their line
rather than on the marker or the backdrop behind it, and a candidate covering
text beats one that merely paints a surface. A surface filling at least 80 % of
the container on both axes — a full-frame glow, a scene backdrop — loses to any
later candidate under the same point that covers less. Alt still picks the
literal topmost node.

Codegen writes for that pane, and `design_check` enforces it. The conventions
now say what shape a run of text takes: one named `Interactive.H1`/`P`/`Span`
whose direct child is the string, typography as literals in its own `style`, a
`name` unique in the frame and equal to its `data-design-id`, and a component
that splits a run into words keeping the split inside behind one `text` prop
(declared `type: "text-content"` from Remotion 4.0.513). The easing scan that
was one regex is seven rules — constant easing, a spring whose physics are
nailed shut, a text run in a plain element, one literal `name` shared by every
mapped instance, a curve whose window defaults to zero, a schema component that
never forwards its `controls`, and a raw export of the component `withSchema`
wraps — merged into `design_check`'s own `findings` array with a `tunability_*`
code and counted into its `summary`, because prose appended after the JSON is
not a finding and the review stage's done-condition is that every mechanical
finding is fixed or explained. Measured over the eleven videos of
`remocn-news-videos`: 75 findings, 51 of them constant easings.
`motion-design` gains `rules/tunable-text.md`, a worked `Headline` typechecked
against Remotion 4.0.481 and pinned as a fixture that scores zero, and the
shipped video template now exposes its spring's `damping` as a prop rather than
failing its own rule set. The conventions text grew by 879 characters
(+6.9 %); the prose that replaces paragraph 9 is simply longer than what it
replaced.
