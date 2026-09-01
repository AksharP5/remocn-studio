# DialKit props panel UI design

## Goal

Replace the visual controls in the completed Remocn props panel with DialKit's
controls and interaction design without replacing Remocn's tuning model. The
result should feel like DialKit while preserving element selection, immediate
Remotion Preview updates, reset and cancel behavior, structured AI changes, and
the existing Studio panel layout.

DialKit is a presentation dependency in this design. `InteractivitySchema`, the
Preview bridge, and `card.tuning.fields` remain the sources of truth.

## Integration boundary

Use the individual React controls exported by the pinned DialKit package for
advanced usage. Do not mount `DialRoot`, call `useDialKit`, or make `DialStore`
the owner of tuned values. A full inline `DialRoot` would introduce a second
state model, its own panel chrome and toolbar, and synchronization problems
across the Preview iframe boundary.

The existing `PropsPane` continues to own:

- the component title and source location;
- grouping and scrolling;
- per-field reset and Reset all;
- the optional AI comment;
- Add, Cancel, and Save to library actions;
- preview error and stale-target feedback.

DialKit supplies:

- slider, toggle, color, select, and text controls;
- spring and easing editing where the Remocn field can be converted without
  losing information;
- control interaction behavior, focus states, typography, and theme styling;
- folder styling where it improves a nested control without duplicating the
  existing top-level group structure.

Pin the DialKit version because the individual component exports are an
advanced API rather than the primary `DialRoot` integration. Add DialKit's
required Motion peer dependency at a compatible pinned range.

## Component architecture

Add a small `DialKitSurface` inside the existing props pane. It supplies the
scoped `.dialkit-root` class and current Studio light or dark theme, and it is
the only place where DialKit's stylesheet is allowed to affect the Studio UI.
It does not create a portal.

Replace the rendering internals of `TuningRow` with a set of controlled
adapters. Every adapter receives the current `TuningField` value and emits a
normal Remocn `onChange(path, value)` callback. DialKit may keep transient
pointer, focus, and popover state, but a field's committed value always comes
back from `card.tuning.fields`.

Use these mappings:

- `number` and `rotation-degrees` use a DialKit slider when a useful range is
  present and retain a numeric fallback when it is not;
- `boolean` uses DialKit's toggle;
- `color` uses DialKit's color control;
- `enum` uses DialKit's select control;
- plain strings and unsupported CSS-shaped values use DialKit's text control;
- scalar scale values use a slider;
- translate, pair scale, transform origin, and UV coordinates use a Remocn
  composite wrapper containing DialKit scalar controls for each axis;
- primitive arrays use a Remocn list wrapper with DialKit controls for their
  items and existing add/remove constraints;
- supported easing and spring values are converted to DialKit transition
  controls and converted back losslessly.

If a DialKit component requires internal store state for presentation, such as
a transition editor mode, isolate an ephemeral UI-only store behind the
adapter. It must not persist values, register a global panel, or drive Preview
updates independently.

Keep the current control as an explicit fallback whenever a field cannot be
represented safely. Unsupported fields must never disappear silently.

## State and Preview flow

The data flow remains:

```text
Preview selection
  -> TuningField[]
  -> controlled DialKit adapter
  -> inspect.changeTuning(path, value)
  -> existing animation-frame coalescing
  -> tune.set over Preview IPC
  -> Remotion override and rerender
```

Key the control surface by the selected tuning target identity so transient
DialKit state cannot leak when the user selects another component instance.
Nested targets remain represented as the merged field list already produced by
the Preview runtime.

Existing behavior remains unchanged:

- per-field reset and Reset all send `tune.reset` to the owning targets;
- Cancel restores original values and closes the panel;
- Add preserves the live Preview result and attaches only the structured diff
  to the composer selection;
- a rejected `tune.set` restores the last accepted value and shows
  `tuningRefusal`;
- Preview rebuilds mark runtime targets stale while retaining the AI diff;
- switching between selected instances never shares live values.

DialKit presets, persistence, Copy, keyboard shortcuts, `DialRoot`, and DialKit
Timeline are outside this change. They can be evaluated separately after the
control replacement is stable.

## Styling and accessibility

Import the DialKit stylesheet once and scope its visual environment through the
`DialKitSurface` wrapper. Verify that selectors do not alter elements outside
`.dialkit-root`. Feed the current Studio theme into the wrapper rather than
allowing DialKit to maintain an independent theme preference.

Preserve the existing pane width, header, footer, scrolling, and focus order.
DialKit popovers must stay usable inside the right pane and must not be clipped
by the pane's scroll container. A composite field remains one labeled property
row even when it contains multiple scalar controls.

All controls keep programmatic labels, keyboard operation, visible focus, and
the existing reset button hit targets. A fallback control must meet the same
requirements.

## Error handling

- Treat value conversion as a total operation with an explicit fallback,
  never a best-effort cast.
- Reject and retain locally any DialKit value that cannot round-trip to the
  original Remocn field representation.
- Let the existing acknowledgement path handle stale targets and rejected
  Preview updates.
- Remount the DialKit surface when target identity changes to clear transient
  editors and popovers.
- Keep the current field renderer available until every supported mapping has
  regression coverage.

## Verification

1. Unit-test forward and reverse adapters for every field type, including CSS
   units, scalar-versus-pair scale, UV tuples, array limits, enum options,
   easing, and unsupported values.
2. Component-test DialKit-backed number, toggle, color, select, text,
   composite, array, and transition controls. Verify reset and fallback paths.
3. Retain the existing integration tests for animation-frame batching,
   negative acknowledgements, Cancel, Add, HMR/stale state, and changing the
   selected component instance.
4. Visually smoke-test light and dark themes, the narrow right pane, long
   labels, control popovers, scrolling, focus order, and isolation from the
   rest of the Studio UI.
5. Run formatting and lint checks, TypeScript, the complete test suite, and a
   production build.

The old controls are removed only after the new adapters cover their supported
paths; until then they remain the intentional fallback.
