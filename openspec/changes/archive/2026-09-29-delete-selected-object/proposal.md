## Why

REM-603. An object picked on the canvas can be moved, resized, retyped and tuned, but not deleted: the only way today is to ask the agent, which costs a turn for a one-key gesture. The person wants to delete it themselves, at once, and take it back with one Undo.

## What Changes

- **Delete / ⌫ on the canvas**, a **Delete** button in the properties header, and Delete in the context menu of a right-clicked object on the canvas or of a Layers row remove the selected object. The keys follow the Tab guard: never from text fields, the inline text editor or panel controls.
- **It disappears at once.** The preview hides it before anything is written, the selection clears, its row leaves Layers, and the rebuild does not bring it back.
- **A managed object is removed in its document, not in the code.** Its record is marked `removed: true` and keeps its values and place in the tree, so everything else that reads those values keeps working. A new runtime, `studio-objects-v6`, wraps v5 and leaves a removed object — and its descendants — unpainted. The first Delete in a v5 video rewrites the one import of the provider to v6 and says so.
- **An element outside the catalogue is removed from the code** at its call site by the project's own `deleteJsxNode`, written immediately rather than at Send. A call site drawing several instances offers *Delete all N*.
- **One Undo.** ⌘Z on the canvas undoes the video's last change — a property edit or a removal — and a ten-second *Deleted "…" · Undo* notice replaces the header's Undo, which leaves with the selection.
- **Scenes cannot be deleted**, and objects with nothing painted at the current frame (a soundtrack, timing data) are not offered Delete; both say why.
- **The agent is told** a removed object is gone, so it never brings it back and reaps its dead code when it next edits the scene.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `preview/managed-objects`: remove and restore operations, checked and idempotent; a removed object stays catalogued, unpainted, with its ID reserved and its descendants removed; the v6 runtime and the move from v5.
- `preview/inspect`: the keys, the canvas and Layers context menus, ⌘Z, the notice, selection and the list after a removal, scenes and unpainted objects refused.
- `preview/properties-pane`: Delete in the header, *Delete all N*, and the disabled reasons.
- `preview/write-to-code`: a call-site removal written on the gesture, and its text-preimage Undo.

## Impact

- **Shared contract**: `shared/studio-document.ts` (`removed`, the remove/restore operation); `shared/ipc.ts` (`studio.remove`, `preview.remove`, `preview.restore`). `SIDECAR_PROTOCOL` and Rust `PROTOCOL` bump together.
- **Sidecar**: the document store, the v5→v6 import rewrite, the host running `deleteJsxNode`, the registry shipping v6, the conventions.
- **Templates**: `studio-objects-v6`, and the video template imports it.
- **Rust core**: the protocol constant only.
- **Webview**: `use-managed-objects`, `use-inspect`, `use-canvas-layers`, a canvas context-menu hook, a notice hook, the properties header.

## Non-goals

- **Deleting scenes** — closing the gap means rewriting timing code; that is a turn, not a gesture.
- **Handing a deletion to the agent** — this change exists to make that unnecessary.
- **Removing a managed object's code or record** — its values may be read far from its root.
- **A confirmation dialog** — Undo makes it redundant.
- **Deleting several objects at once** — selection is single.
- **Keeping a code removal's Undo across a restart.**
