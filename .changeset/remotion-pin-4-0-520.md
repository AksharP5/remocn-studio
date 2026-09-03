---
"remocn-studio": patch
---

New projects scaffold on Remotion 4.0.520, so their text and type are editable.

Below 4.0.513 `Interactive.js` builds an element's schema from `baseSchema +
transformSchema` alone — origin, translate, scale, rotate, opacity, hidden. There
is no string field type, so no primitive anywhere can carry a font size, a weight
or a colour, and no amount of work in the pane could have added one. That is why
clicking a line of text in a real 4.0.481 video opened a pane with a Text row that
could only be sent to the agent and nothing typographic beside it.

The six pins in `templates/remotion/package.json` move together, and
`sidecar/scaffold/template.test.ts` now asserts a floor of 4.0.513 next to the
existing one-version rule. The template's title becomes an `Interactive.H1`
carrying `name` and a matching `data-design-id`, the shape the conventions ask of
every agent-written text run; `RisingText` takes that name as a prop rather than
borrowing the one its `<Sequence>` already had. The text tags exist on 4.0.481
too, so that part typechecks on both versions — what 4.0.520 adds is the schema
behind them.

What was measured before moving, against a real 4.0.520 installed in a scratch
copy of the videos project: `textSchema` and `textContentSchema` are spread onto
every text tag; the controls object still carries exactly the four fields
`SequenceControls` declares, so `asControls` needed none of the optional fields it
was expected to grow; every override seam the runtime drives is present; and
`SUPPORTED` covers every field type 4.0.520 emits except `remotion-captions`,
which has no control behind it. The video template typechecks against those types
with a `tsc` run whose `node_modules` is that copy's.

What was not measured is the running app: that `controls` is non-null on an
`Interactive.Div`, that a `style.fontSize` drag moves pixels, that typing in
`Text` moves the frame, and that a snapshot still stays byte-identical to
`npx remotion still` from the same copy. The pin moved on the owner's call rather
than on that gate, and existing projects are untouched — moving one is still the
Upgrade button in the environment checklist, never silent.

A `text-content` field never takes its schema default. Remotion answers
`undefined` for `children` when the runtime value is not a string — a component
that split its line into word spans, which is what `WordPush` and every
staggered-text component in the corpus does — and that `undefined` *is* the
signal. `textContentSchema` declares `default: ''`, so defaulting it turned the
signal into an empty string, which is a perfectly good `text-content` value: the
pane drew an editable, empty Text box over a line whose text it could never
write. It now reads *Text is built from parts — ask in words*, read-only, as it
was meant to. The test that covered this passed either way, because its fixture
declared the field with no `default` at all where the real schema has one.
