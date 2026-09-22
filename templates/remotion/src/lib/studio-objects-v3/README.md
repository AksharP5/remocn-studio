# Studio objects v3 runtime

A managed video keeps editable property data in `src/videos/<video>/studio.json`.
React owns scene structure, layout, animation and rendering. The document is not a
second scene renderer. Preview and export import the same document.

## Authoring

Import `StudioObjects` and `useStudioObject` from `../../lib/studio-objects-v3` in
a video entry. Keep one provider mounted around the whole video, outside sequences
and conditions. Pass the imported document as its `document` prop.

```tsx
import { StudioObjects, useStudioObject } from "../../lib/studio-objects-v3";
import document from "./studio.json";

function Title({ id }: { id: string }) {
  const object = useStudioObject(id);
  return (
    <h1 {...object.bind} {...object.bindText("text")} style={{ fontSize: object.number("size") }}>
      {object.text("text")}
    </h1>
  );
}

export default function Video() {
  return (
    <StudioObjects document={document}>
      <Title id="opening-title" />
    </StudioObjects>
  );
}
```

```json
{
  "version": 1,
  "video": "intro",
  "definitions": [{
    "id": "title",
    "version": 1,
    "fields": [
      { "id": "text", "label": "Text", "type": "text", "default": "" },
      { "id": "size", "label": "Size", "type": "number", "default": 48, "min": 1, "max": 300, "step": 1, "unit": "px" }
    ]
  }],
  "objects": [{
    "id": "opening-title",
    "definition": "title",
    "label": "Opening title",
    "parentId": null,
    "values": { "text": "Hello", "size": 48 }
  }],
  "operations": []
}
```

`video` must equal the containing video folder's slug. Definition, object and field
IDs begin with an ASCII letter or digit and otherwise contain letters, digits,
underscores or hyphens. IDs are local to this document. Preserve them across label
changes and reorder; never derive them from array indices or editable text, and
never reuse a deleted object's ID. A duplicate gets a new ID and copied values.

Each independent card in a mapped list needs its own record, ID and React key.
Rendering the same object in multiple places intentionally shares values; pass a
stable occurrence name to `useStudioObject(id, occurrence)` for each root. The
catalogue shows one object, and the selection outline currently shows its first
mounted nonzero-width root. For independent edits, use different object IDs.

Spread `object.bind` onto one existing semantic DOM or SVG root. Components must
forward the attributes to that root. Do not add layout wrappers just for picking.
A heading split into words/letters stays one object; put its text binding on the
whole text region, not on individual letter spans. Nested editable roots select the innermost object. A fragment needs a
real root or separate objects. Canvas/WebGL internals require explicit DOM proxies;
v1 does not perform pixel-level picking. Use the catalogue to edit hidden,
unmounted or fully occluded objects. `parentId` groups identity and must reference
an existing object without cycles; it does not imply inherited values or transforms.

## Properties

### Text regions in the preview

Bind each plain-text region to its declared `text` field. The nearest ancestor
with `object.bind` owns the field, so a card can expose several independent texts:

```tsx
<article {...object.bind}>
  <h2 {...object.bindText("title")}>{object.text("title")}</h2>
  <span {...object.bindText("status")}>{object.text("status")}</span>
  <p {...object.bindText("footer")}>{object.text("footer")}</p>
</article>
```

The binding adds only a DOM attribute and validates the field's type. It adds no
layout wrappers and does not change export rendering. A text region must represent
one whole field, including when its contents animate as individual letters. Colors,
enums, rich text and strings assembled from several fields are not text regions.

Double-click opens a plain-text input at that region. Enter inserts a newline;
Cmd/Ctrl+Enter or a click outside saves; Escape cancels. Input height follows the
content. One completed edit produces one normal property operation and one Undo.
Draft typing stays in the input until saved; then all occurrences receive the
saved value through the existing preview draft protocol. Save failures retain the
property draft in the inspector for Retry or Discard.

Older v1/v2 scenes continue to render unchanged. Without an explicit binding,
inline editing is offered only when a plain visible text region matches exactly
one declared text field. Ambiguous strings, SVG, rotated/skewed/perspective text,
vertical writing and rich text remain editable through the properties panel.
Explicit bindings also disambiguate two fields with identical current text.

To adopt bindings in an existing managed scene, change its provider and hook
imports to v3 and add `bindText` to its text regions. Keep its document, stable IDs,
values and operation history. Do not replace an authored v1/v2 runtime file.

Every object stores exactly the fields declared by its definition, including all
defaults. Defaults describe new objects; changing one never changes existing values.
Fields are flat literal IDs, not paths into arbitrary JavaScript objects.

| Type | Stored value | Reader |
| --- | --- | --- |
| `number` | Finite number; optional `min`, `max`, positive `step` | `number(id)` |
| `text` | String, including empty strings and Unicode | `text(id)` |
| `color` | Six- or eight-digit hex string, including `#` | `text(id)` |
| `boolean` | Boolean | `flag(id)` |
| `enum` | String from nonempty, unique `options` | `text(id)` |
| `easing` | Four finite Bezier coordinates; X in 0–1 | `easing(id)` |

All fields require `id`, `label`, `type`, `default`. Optional `unit` and `group`
carry presentation metadata. DialKit renders collapsible sections using `group`
(for example Typography, Fill, Layout, Motion), preserving declaration order
inside each section. Fields without a group appear under Properties. `step` is an
input increment, not a divisibility restriction. Use matching units in rendering;
do not label a normalized 0–1 value as a percentage without conversion.

Read every declared field in the component that owns its behavior. Declaring a
property does not automatically make CSS consume it. Animate from the base value
or expose a named motion parameter (duration, distance, damping). A computed
per-frame CSS value is not a writable base property. Keep transforms and their
coordinate systems in scene code. The provider never reads browser geometry to
produce frames, and the saved document renders without the editor.

Version one has no asset references, expression editing, shared tokens, rich text,
general arrays/objects, variant-dependent schemas or keyframe tracks. Do not disguise these
as scalar controls. Rich typography and complex animation can remain ordinary
React code while supported base parameters are exposed. Extend the versioned
contract before exposing additional field types.

## Saves, conflicts and Undo

The panel previews valid drafts and commits text on blur, continuous slider/color/curve
gestures on release, and switches/enums immediately. A completed gesture is one
Undo operation. Color controls normalize CSS color input to sRGB hex with alpha. Switching objects commits completed drafts. Incomplete numeric/color
values stay unsaved. Failed writes stay visible; Retry sends the identical operation
ID and contents. Discard reloads current disk values. Unsaved changes block export
of that video. After saving, export waits for the rebuilt runtime to acknowledge
the saved operation receipt. Drafts survive selection/video changes in the current app session;
they are not a crash-recovery journal and are lost when the app exits.

Each saved operation includes its ID, object, field, definition snapshot and before/
after values. The sidecar checks the target value and schema, merges independent
field changes, and atomically records the operation with its value. Repeated
requests are idempotent. Undo uses a checked inverse: it cannot overwrite a newer
value on that field. Undo history is shared for the video, persists in `operations`,
and currently has no compaction or redo. Never edit or delete operation receipts.

Change a definition's version when its meaning or fields change; explicitly migrate
all affected values together. Unknown document versions, extra properties, duplicate
IDs, missing definitions, invalid defaults/values and invalid parent graphs are
rejected without rewriting the file. Renaming a video requires updating its
`video` field too. Identity must never be recycled after deletion, because external
file edits cannot provide tombstone enforcement.

Source editors and agents must preserve unrelated values and history. They do not
share Studio's file lock: Studio checks for concurrent file changes immediately
before replacement, but this is not an atomic compare-and-swap against arbitrary
external writers. Coordinate whole-document changes with the panel. There are no
multi-file transaction guarantees. The existing renderer pins its compiled input;
external asset files are not newly snapshotted by this format.

## Existing projects

New videos use this contract. Existing registered Studio projects remain available
and receive this versioned runtime without overwriting authored copies. Legacy
videos retain their previous inspector. Convert a legacy video only as an explicit
code change: inventory editable objects, assign permanent IDs, materialize every
current value, wrap its entry, replace readers and bind semantic roots, then check
representative frames and export. Never auto-convert arbitrary JSX with guesses.
New folder imports must have Studio project identity or already be registered.

`design_check` validates the managed document and recognizes bound semantic text
roots. It is a diagnostic heuristic for source bindings, not a proof that arbitrary
React code consumes every value. Verify repeated instances, start/middle/end frames,
rebuilds, reload, independent edits, conflict reporting and Undo for each new
component family.

## Animation controls

Expose durations and delays as numeric seconds (`unit: "s"`), then multiply by
`useVideoConfig().fps` at the Remotion animation boundary. Existing numeric fields
with `unit: "frames"` display in seconds using preview metadata and save back to
the original frame grid. Do not assume 30 fps.

Declare editable curves with `type: "easing"`, a four-number `default` and a
four-number value `[x1, y1, x2, y2]` for every object. Both X coordinates must be
between 0 and 1. Y coordinates must be finite and may overshoot beyond 0–1.
Consume the value with `Easing.bezier(...object.easing("entryEasing"))`.
The panel provides presets, draggable handles and coordinate controls. One
completed gesture saves the entire curve as one operation and one Undo step.

Named easing enums remain supported as preset-only controls. To enable custom
curves for an existing animation, preserve its current curve, migrate its field,
default and every affected object's value, increase the definition version and
change its reader to `object.easing`. Import this v2 runtime; existing authored
v1 copies are not overwritten. Keep operation receipts unchanged. The JSON
document remains version 1 with an additional validated field type; older Studio
versions reject documents containing this new field. Springs retain their
physical parameters rather than being converted to Bezier curves.

Adding a field to the document alone does not change the video: wire the duration
and easing into the animation that consumes them, and migrate every affected
object when extending an existing definition.
