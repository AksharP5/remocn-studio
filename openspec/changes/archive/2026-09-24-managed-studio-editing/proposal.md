## Why

REM-499: Inspect currently discovers DOM nodes while property writes target a JSX call site. Repeated instances, rebuilds and the Add/Send draft lifecycle make direct editing unpredictable. Studio controls generation and can require an explicit editable-project contract.

## What Changes

- Introduce a versioned, validated per-video object document: component definitions, stable object IDs, parent relationships, typed fields and independently stored values. React remains the scene and animation source.
- Register semantic objects without adding layout wrappers; select their declared roots and keep selection across remounts and rebuilds. Expose the complete object catalogue even outside the current frame.
- Save property changes directly through checked, idempotent operations with conflict-aware Undo; do not route managed property edits through Add/Send or shared Remotion call sites.
- Generate managed videos by default and validate the contract. Existing Studio videos remain readable while they are upgraded explicitly; arbitrary external project import is no longer supported.
- Keep preview and export based on the same saved document, and report unsaved/conflicting work honestly.

## Capabilities

### New Capabilities

- `preview/managed-objects`: Object documents, runtime registration, validated direct writes and Undo.

### Modified Capabilities

- `projects/project-lifecycle`: Accept Studio projects, preserve registered legacy Studio projects.
- `agent/knowledge`: Generate managed object documents and bindings.
- `preview/inspect`: Prefer declared semantic objects and preserve identity.
- `preview/properties-pane`: Directly edit managed objects independently of composer drafts.
- `preview/write-to-code`: Managed data writes use their own checked address rather than JSX codemods.

## Non-goals

- Replacing React/Remotion with a JSON scene renderer.
- Automatically reverse-engineering arbitrary old React code into editable objects.
- Universal drag/resize, multi-selection, arbitrary expression inversion or a keyframe editor. Version one edits declared scalar properties and motion parameters; unsupported operations are not advertised.
- Pixel-accurate picking inside opaque canvas/WebGL components without an explicit adapter.

## Impact

Shared schemas and IPC gain managed read/write operations; the sidecar owns validation, containment and durable transaction receipts. Rust bumps the forwarding protocol. Preview gains semantic bindings, while the webview owns selection, drafts and save/Undo feedback. Templates and generation conventions use the same document shape. Existing code-based export consumes the imported saved document. No new dependencies or history database migration are planned.
