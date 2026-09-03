---
"remocn-studio": patch
---

An edit in the properties pane now says who it moves, what it took back, and why
it was refused.

A target is found again rather than remembered. The runtime used to cache the
controls of everything ever selected so a later edit could find its schema by id
— which is exactly wrong for a Player that unmounts a scene on every loop, since
the ids it held were dead by the time the next edit used them. The registry is
keyed on the anchor instead and `rebind` re-resolves every live target on every
registration: the anchor back to a node, then that node's `refForOutline`
owners, then the fiber chain when none of them claim it. `sameMappings` keeps it
idempotent, republishing the synthetic `overrideId → nodePath` map only when it
really changed. A `targetId` is now `anchor::componentName` while an
`instanceId` stays the bare anchor, because `controlsChain` routinely returns
two links whose host is the same DOM node — an `Interactive.Div` and the
`withSchema` wrapper around it — and a bare anchor would merge those two into
one card, losing the author's own schema behind Remotion's built-in style one.

A reset names paths, never a target. The preview reads an empty path list as
"drop this target's whole draft", and a `CameraRig` framing the scene is in
every chain — so letting go of one card used to take a camera change another
card had already Added. `changedPaths` is the one door every reset goes through
now: Cancel, Reset all, picking elsewhere, a rebuild, and removing a chip from
the composer each send only the paths that card actually moved. `byTarget`'s
empty-list branch, the last thing that could still emit `[]`, is gone.

Reverting unsent edits says so, with Undo. Picking elsewhere with pending
changes raises `Reverted 2 changes on Pushed line`, whose Undo is a fiber
interrupt on an `Effect.sleep` window and re-sends every value it took back,
reopening that card — the shape a deleted asset already uses, and the same ten
seconds. Undo abandons whatever card is open before it restores, or edits made
on the element you had moved to would be left live in the preview with nothing
listing them.

A refusal belongs to a row. `tuningRefusal` carries `{message, path, targetId}`
and renders under the control that asked for it; only a refusal naming no path —
a reset, or a runtime that named no field — keeps the footer line. A later `ok`
clears it for that same target and path and nothing else, and an `ok` for a
request nothing recorded clears nothing at all, since `abandon`, a rebuild and
removing a chip all mint request ids without registering them. An element off
screen at the playhead is refused with the frame it would appear on: *This
element is not on screen at frame 42. Title runs from frame 30 to 120.* That
window is read from Remotion's own `SequenceContext` value — `cumulatedFrom +
relativeFrom` — because summing `memoizedProps.from` up the fiber chain
triple-counts an `Interactive.Div`, which is three fibers deep, reading
`from={30}` as 90; and the end is the sequence's real duration, with 60 frames
kept only as the fallback when there is no finite one, since a cap would report
a 300-frame scene as ending 60 frames in and make the sentence lie.

The pane says when an edit is shared: `Shared by 4 · a change here moves all of
them` under the title, because one nodePath per `overrideId` is Remotion's model
and there is no per-instance key to publish an override against through the
contexts a Player exposes. `PropsPanel` is keyed on the innermost target's
`instanceId`, so a comment typed for one line does not follow you to the next. A
stored selection now keeps the whole chain rather than the one link that was
edited, so reopening a chip lands on the link the message was written from and
removing one resets every link it carried. And the agent's block groups the
changes by owner — `Requested changes on Title ‹headline›
(src/videos/intro/Title.tsx:24):` — because a flat list of paths taken off a
three-link chain read as one component's props and sent it editing the wrong
file.
