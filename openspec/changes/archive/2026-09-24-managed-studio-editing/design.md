## Context

REM-499. Current picker uses elementsFromPoint and surface heuristics; preview/interactivity.tsx still resolves controls through Remotion override IDs. hooks/use-inspect.ts abandons drafts on another selection and clears selection on rebuild. A DOM ID alone cannot remove the shared call-site writer.

## Goals / Non-Goals

Provide an end-to-end managed property editor and an independently addressable catalogue. Keep arbitrary React rendering and declared motion parameters. Version one does not promise keyframe inversion, pixel picking inside WebGL, universal transform handles or multi-object writes.

## Decisions

- One canonical `src/videos/<video>/studio.json` per managed video. The versioned document contains definitions (field ID, type, explicit default and constraints), object records (ID, definition, label, parent, values). Flat field IDs are literal keys, not dotted paths. All current values are explicit; changing a default cannot silently change an existing film. This is property data, not a scene renderer. The TSX scene owns structure and timing.
- The shipped `studio-objects-v2` React provider receives the imported document. Bindings decorate existing roots. Object identity is separate from occurrence identity; repeated occurrences intentionally edit the same object. JSON object catalogue remains available without mounting every object. Preview interaction is optional and absent during ordinary rendering.
- Shared Effect schemas decode IPC and persisted documents. The sidecar resolves only the canonical video path, validates definitions/parents/values, rejects unknown fields and incompatible versions, and records revision hashes.
- The sidecar owns single-document operations with before-value and definition preconditions. It serializes writers, takes a filesystem lock, records an idempotent receipt in the same document transaction, then atomically replaces the file. Independent field changes can merge; changed addressed fields or schemas fail with a sentence. Undo is an inverse checked operation, not file restoration. No multi-file operation is exposed in v1, so there is no claim of multi-file atomicity.
- The webview owns a draft per field, selection, save status and checked Undo. Preview messages never dictate a filesystem path. A completed input/gesture saves directly, even when another object is selected. Failed drafts remain visible and block export until resolved. Every asynchronous response is tied to its project/video context.
- New IPC methods are read and patch; Rust remains an opaque forwarding boundary. Bump SIDECAR_PROTOCOL and Rust PROTOCOL together. No SQLite migration or settings key is required.
- Existing registered Studio projects remain openable and receive the versioned SDK without overwriting authored files. New external folder imports are refused. Legacy videos retain the existing inspector until explicitly converted by the agent with the new generation contract; old source is never automatically reverse-engineered or rewritten.
- JSON imported into the existing compiled bundle supplies both preview and export. Pending edits block export. After saving, export also waits until the rebuilt runtime reports that it contains the saved operation receipt. Resource snapshot improvements beyond existing export pinning remain an explicit limitation, not a new guarantee.

## Risks / Trade-offs

- Arbitrary external editors do not honor our file lock: compare file contents again immediately before replacement; report conflicts. Managed writers must use the operation API. This is optimistic concurrency, not a filesystem-wide CAS primitive.
- Custom components can ignore declared values: validate structure and bindings, test shipped examples, never claim static checks prove arbitrary program semantics.
- The document supports number, text, color, boolean, enum and an atomic four-coordinate easing field; assets, token links, rich text and explicit keyframes require later versioned field types and are not misrepresented as writable scalars.
- Legacy conversion remains a code change performed by the agent; absence of a managed document is visible. Preserve existing videos and data while migrating new generation defaults.

## Migration Plan

Ship schemas, SDK, sidecar operations and inspector together. Scaffold new videos with an imported managed document. Install the SDK in existing registered projects without touching old videos. Restrict new folder opening to projects with Studio identity or already registered history. An incompatible managed document fails closed and leaves source bytes unchanged. Rollback uses version checks and leaves managed source/data intact.

## Managed pane controls

Use the existing DialKitSurface and controlled DialKit slider, text, color, enum
and toggle controls. Reuse the legacy numeric scrubber for unbounded numbers and
the same group headings and persisted fold preferences. Schema group metadata
controls sections; missing groups appear under Properties. Do not use DialStore
as a second source of values.

Continuous controls update the managed draft immediately. Release of a pointer
or held editing key commits once, including events from the color popup. Color
inputs normalize to the document's sRGB hex representation with alpha. Text
commits on focus leaving the field, and discrete controls commit immediately.
Uncertain writes keep their existing retry/discard behavior and disable editing.

## Custom easing follow-up

`easing` is an explicit field containing [x1,y1,x2,y2]. X is restricted to [0,1],
Y is finite and may overshoot. The tuple is atomic for drafts, receipts, conflict
checks and Undo; equality compares coordinates across JSON and IPC serialization.
The pane offers DialKit handles, coordinate sliders and existing named presets.
Gesture completion produces one operation for the whole curve.

New videos import studio-objects-v2 and call object.easing, passing its result to
Remotion Easing.bezier. Registry installation adds v2 alongside existing authored
v1 runtimes. Existing enum animations require coordinated field/value/consumer
migration; they are not silently rewritten. The document remains version 1 with
an additive field type, which older apps reject. Sidecar protocol is bumped to 35.
