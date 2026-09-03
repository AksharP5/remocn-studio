---
"remocn-studio": patch
---

The pane now moves the frame, marks what animates, and edits text and type.

A curve is inert at a settled frame. Every generated `interpolate` clamps both
sides, so outside an element's own window every bezier yields the same constant
— which is why dragging an easing looked like nothing happening, and why the
agent itself wrote *"Set from the preview. Still inert"* into an AskScene. The
selection carries `window`, the element's own sequence span, and the pane leads
with a time strip: the frozen frame in mono, a range over `[from, until]` that
seeks, and Replay. An edit to Entry, Exit, Effects or Timing, or to anything
whose path ends in `easing`, schedules **one** replay 250 ms after the last
flush — a forked `Effect.sleep` each flush interrupts and re-forks — skipped
while the preview is already playing. Picking still does not seek: the paused
frame is the one being judged.

The playhead crosses the wire, and it is deliberately not React state. The
entry subscribes to the Player's own `frameupdate`/`play`/`pause` and posts
`playhead` at most once per animation frame; every `frameupdate` also repaints
the selection box, so it tracks an element that is moving instead of lying
about where it was. Holding that frame in `usePreview`'s state was free while
it moved only on `selection`, `capture` and `rebuilt` and cost the whole
application the moment it moved sixty times a second — `frame` is in
`PreviewControl`'s memo, which is in `tools`, which is in the studio context
that ten components read, so playing the preview re-rendered the transcript,
the sidebar and the composer every frame. It is a ref with its own listener set
now, read through `useSyncExternalStore` by the only two things that draw it,
while the turn's `playing` frame is a stable getter called at send time. The
armed readout carries no `role="status"`, the same rule the running-time ticker
already follows.

The Player's transport bar works while Inspect is armed. The swallow used to
test the canvas *rectangle*, which is also the rectangle the transport bar is
drawn over, so the bar appeared on hover and did nothing when clicked;
`overCanvas` asks `elementsFromPoint` what is actually under the point and
stops the event only when the canvas contains it, falling back to the rectangle
where nothing can be hit-tested.

A field the code animates is marked, because a static override replaces the
animation with a constant. `tuning.read` is throttled to once per 250 ms with
one trailing read when the frame settles, and the answer is
`currentRuntimeValueDotNotation` — the component's own incoming props, taken
before Remotion merges the drag overrides in, which is exactly what makes it an
animation detector. The mark is sticky: a key does not stop animating in code
because somebody overrode it, and recomputing it per read cleared the badge the
moment the field was edited and took `sampled` off the change with it. The
first version also tried to report *the preview is no longer applying this
value* from the same reading, which differs from a draft **by construction** —
so it fired on every edited field as soon as the playhead moved. There is no
merged reading to ask for; that detector is gone rather than left firing, and a
runtime that genuinely refuses an override already says so in `tune.set`'s own
answer. `sampled: true` rides the change and reaches the agent as `from
(runtime value at frame N, animated in code; change the landing value, not the
frame)`.

Nothing the schema declares is dropped in silence. `fontWeight: 800` (a number
against 4.0.520's enum of strings) and `letterSpacing: "-0.03em"` (a unit
string against a number) used to vanish with nothing on screen to say so.
`readingOf` now answers for every value: the enum case coerces and stays
editable, the unit string keeps a read-only row, a `text-content` built from
parts says so, and anything else keeps its row as *value in code* through a
guarded stringify — a circular value throwing there would have cost not its row
but the whole selection. Only a key the runtime holds no value for is still
dropped, or a text element on 4.0.520 would draw eight rows reading
`undefined`. `TYPOGRAPHY` matches bare `fontSize`/`fontWeight`/… as well as
`style.`-prefixed paths, which is how every agent-written video writes them.

Text is a field where the runtime has one and a request where it does not. On
4.0.481 the selection carries the element's own words and the loaded families,
and the pane opens a **Text** section labelled *sent to Claude, not previewed*
that rides `tuningChanges` as `{path: "children"}`; it exists only while the
innermost target declares no live `children` field. A stored selection chip now
carries `window`, `text` and `fonts`, so a reopened chip keeps its time strip
and its faces.

The environment checklist warns below Remotion 4.0.513 and never upgrades
silently. The row reads what is *installed* — `node_modules/remotion`'s own
version, with the declared range only as the fallback — so `^4.0.481` resolved
to 4.0.520 is not accused, and a range that cannot be read stays `ok` rather
than being guessed at. *Upgrade Remotion* runs `pmOf`'s manager with
`name@4.0.520`, in the manifest the row read rather than the lockfile's
directory: for a workspace member those differ, adding at the root would write
the pin somewhere the row never looks, and `yarn add` at a workspace root
refuses outright. `warn` does not lock the composer and no longer claims the
project is broken — the card reads *This project has one thing worth fixing*
until something has actually failed.

**The template pin does not move in this wave.** The six packages stay on
4.0.481 until the gate in the running app is run against the prepared 4.0.520
copy of the videos project: the preview compiles, a click opens a pane with a
Typography group, dragging `style.fontSize` changes pixels, typing in Text
changes the frame, and a snapshot still stays byte-identical to `npx remotion
still` on the same frame from the same copy. The mechanism is complete and
pressable; moving the pin on a packed-source reading rather than a running
Player would ship every new project onto a Remotion this studio has never
previewed.
