# REM-6 props panel design

## Goal

Let a user select one rendered scene or transition-related component in the
Preview, tune its declared parameters with immediate visual feedback, and add
the resulting structured diff to the existing agent composer. The agent remains
the only code writer in version one.

The feature is useful only when every valid edit rerenders the Preview. Merely
collecting values for a later prompt is not an acceptable fallback.

## Component contract

Nested tunable components use Remotion's public interactivity contract:

- declare an `InteractivitySchema`;
- export the component through `Interactive.withSchema()`;
- accept the generated `controls` value and forward it to the component's
  `<Sequence>`;
- keep editable values in typed props and use inline literals at call sites.

This replaces the previous proposal to attach a Zod schema to a component and
inspect `fiber.memoizedProps`. Zod remains appropriate for top-level composition
input props. `InteractivitySchema` is the source of truth for nested scene,
timing, transition, and effect controls.

Components that do not follow the contract remain selectable through ordinary
Inspect comments. Version one does not guess parameter semantics from React
fiber props.

## Runtime architecture

The current Preview renders a Remotion `<Player>`, whose environment normally
sets `isStudio` to false. In that mode `Interactive.withSchema()` deliberately
passes clean props and does not register interactive controls. Add a Preview
adapter around the rendered composition that supplies the minimum Studio
environment and mapping contexts required by Remotion interactivity while
preserving Player playback semantics.

The existing outer `Internals.RemotionRootContexts` already supplies the
sequence manager. The adapter supplies a synthetic node path for each
`overrideId` and bridges parameter updates to
`VisualModeSettersContext.setDragOverrides`. Remotion then merges the override
into the selected component's props and rerenders it through its normal React
path.

Selection resolves the closest registered interactive `<Sequence>` from the
clicked DOM element. Its `controls` provide the schema, current runtime values,
component name, component identity, and unique `overrideId`. The unique ID is
what makes two renders of the same component independently editable: only the
selected instance changes.

Do not import private Remotion Studio components. Use public `remotion` exports
and `Internals` already present in the pinned runtime. If the required runtime
contexts are unavailable, Inspect still works but tuning is disabled with an
explicit reason.

## UI

Extend the existing Inspect comment card inside the Preview instead of adding a
fourth global panel. When the selected element has interactive controls, the
card expands to a scrollable inspector about 320–360 pixels wide. On a small
Preview it remains a docked overlay inside the Preview boundary.

The card contains:

- component name and source location;
- optional comment textarea;
- grouped parameter rows such as Parameters, Timing, Transform, Entry, Exit,
  and Effects;
- a changed-state highlight, per-row reset, and Reset all;
- `Cancel` and `Add` actions.

There is no separate Apply button. A valid edit updates the Preview immediately.
`Cancel` restores the original runtime values. `Add` keeps the current Preview
state and stores the structured diff in the composer. The resulting selection
chip summarizes the component and change count, for example
`HeroScene · 3 changes`; selecting it reopens the inspector. A selection with no
schema keeps today's compact comment card.

## Supported fields

Support the visible field types declared by `InteractivitySchema` in the pinned
Remotion version:

- `number`, `boolean`, `color`, and `enum`;
- `rotation-css`, `rotation-degrees`, `translate`, `scale`, and
  `transform-origin`;
- `uv-coordinate`;
- `array` of the primitive item types permitted by `InteractivitySchema`, with
  add/remove constrained by `minLength`, `maxLength`, and `newItemDefault`.

For enums, flatten and show the active variant schema and update the visible
fields when the discriminant changes. Number fields use a slider when bounded
by useful `min` and `max` values and a number input otherwise. Transform fields
get structured controls that preserve Remotion's documented value format and
units.

Unknown future field types are omitted without breaking the inspector. If no
editable field remains, the element falls back to the comment-only card.

## Preview protocol and state

Extend a Preview selection with an optional ephemeral tuning descriptor:

```text
{
  targetId,
  componentName,
  groups,
  originalValues
}
```

`targetId` identifies the mounted interactive instance and never enters the
agent prompt or persisted conversation history. The Studio card owns its draft,
original values, and computed diff; the Preview owns the mounted target registry
and runtime overrides.

Parameter commands use acknowledgement messages:

```text
studio -> preview: tune.set { requestId, targetId, path, value }
preview -> studio: tune.result { requestId, ok, error? }
studio -> preview: tune.reset { requestId, targetId, paths? }
```

Continuous controls coalesce updates to at most one command per animation
frame. Invalid input remains local and is not sent. Responses for an obsolete
request or target are ignored.

`Add` stores persistent change data on the selection:

```text
{
  path,
  from,
  to
}
```

The local selection may retain `targetId` so it can be reopened or reset before
a rebuild, but serialization to queue/history strips it. Sending the composer
clears the draft while leaving Preview overrides in place until the code
rebuilds, avoiding a visual snap-back.

The agent trailer includes the component, source/call-site context, and a
`Requested changes` section generated from the structured diff. It describes
data rather than prose so a later mechanical codemod can reuse the same shape.

## Rebuild and stale targets

A Preview rebuild clears the interactive registry and all runtime overrides.
Existing composer diffs remain valid agent instructions but their chips are
marked `Preview changed`; version one does not automatically rebind them to a
new instance. Attempts to update an unmounted or stale target return a negative
acknowledgement and keep the draft intact.

Canceling a card or removing a selection chip sends a best-effort reset while
the target remains mounted. A failed reset caused by a rebuild is harmless
because the rebuild already removed the override.

## Transition scope

Raw `TransitionSeries.Transition` timing and presentation factory arguments are
not exposed as runtime controls by the pinned Remotion version. Version one
therefore supports transition tuning when the values are represented by:

- a custom `Interactive.withSchema()` component with its own `<Sequence>`;
- a schema-backed custom effect;
- transition props declared on an interactive scene wrapper, such as
  `transitionIn.blur`.

The inspector may group these fields as Entry, Exit, Timing, or Effects, but it
does not pretend that every raw `TransitionSeries` value is editable. Universal
editing of those factory arguments is separate codemod/runtime work.

## Failure handling

- Skip unknown schema fields and report the omission in development logs.
- Never send an invalid value to the Preview.
- Treat an unmounted target as stale and preserve the user's structured diff.
- Degrade to ordinary Inspect when Remotion interactivity is unavailable.
- Clear all runtime-only identity and overrides on Preview rebuild.

## Verification

1. Unit-test schema normalization, active enum variants, supported transform
   codecs, arrays, validation, and diff generation.
2. Test the Preview adapter in jsdom: nearest interactive Sequence, nested
   sequences, duplicate component instances, unmount, stale IDs, set, and reset.
3. Test both directions of the Effect Schema postMessage bridge, including
   malformed messages and acknowledgements.
4. Test inspector controls, live updates, per-row reset, Reset all, Cancel, Add,
   array limits, conditional fields, and reopening a chip.
5. Test that structured changes survive composer queue/history while
   `targetId` never does.
6. Test generation of the `Requested changes` agent trailer with source and
   call-site context.
7. Run a browser smoke fixture with two instances of one component: tune one,
   verify only it changes, add the diff, let the agent edit code, and verify the
   runtime override disappears after rebuild without changing the result.
