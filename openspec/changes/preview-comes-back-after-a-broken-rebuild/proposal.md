## Why

The preview host announces `ready` once, on the first compile that succeeds. When a rebuild fails, the pane shows the compiler's messages and drops the player; when the next rebuild succeeds, the host only tells the page it was rebuilt — and there is no page any more. The pane follows the progress to *Compiling — 100%* and waits for a `ready` that never comes. The only way out was reloading the studio, which also cuts the running turn.

## What Changes

- A successful compile that heals a failed one is announced as `ready` again, in addition to the rebuild notification that clears the still cache and drops the session, so the pane mounts the player again without anyone pressing anything.

## Non-goals

- No change to progress after a served preview: a rebuild that follows a successful one still keeps the player up and does not show the progress screen.

## Capabilities

### Modified Capabilities

- `preview/live-preview`: *A rebuild reaches the pane* gains the scenario where a failed rebuild is fixed.

## Impact

- **Sidecar**: `sidecar/preview/host.ts` (the watch callback), `sidecar/preview/build-state.ts` (`recovering`).
- **Webview**: none; `usePreview` already takes a `ready` after a failure back to playing.
- Linear: no ticket; reported in chat on 2026-09-15.
