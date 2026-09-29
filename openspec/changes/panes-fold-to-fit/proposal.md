## Why

The shell holds four things side by side — the sidebar, the chat, the canvas and
the inspector inside the preview — and on a small screen they do not fit. The
window's minimum (960 px) is already narrower than the sidebar, the chat and the
preview's minimums together, so the last pane in the row is squeezed until the
canvas toolbar runs under Export and Export itself can be pushed out of reach.
`the-chat-yields-to-the-preview` made the chat give way first and ruled out
hiding anything; that is not enough below about 1440 px.

Separately, the window cannot be dragged at all: every `data-tauri-drag-region`
asks the core for `start_dragging`, and the capability file never granted
`core:window:allow-start-dragging`, so the call is refused.

## What Changes

- **The canvas has a floor.** The canvas — the space between the left ruler and
  the inspector — never gets narrower than its toolbar and the pane's actions
  need (400 px). The toolbar sits in the header row in flow, so its narrow tiers
  are decided by the room left beside the actions, and Export cannot be covered.
  The preview's minimum becomes that floor plus the ruler and the inspector's
  bar (468 px).
- **Panes fold as the window narrows, in a fixed order**: the sidebar first, then
  the inspector's content (down to its bar), then the chat, so that at the
  window's minimum the preview is still on screen. A fold follows the room
  available, not a choice: it is never stored, and widening the window brings
  each pane back as it was chosen.
- **A folded pane still opens — over the layout, not beside it.** The sidebar
  slides out over the panes when the pointer reaches the window's left edge and
  slides away when the pointer leaves it; its toggles (⌘B, the header button)
  open it the same way. The inspector's bar expands it over the canvas. A folded
  chat opens from a *Show the chat* button in the preview's header and stays
  over the preview until it is closed from its own header.
- **The window can be dragged** by every region already marked for it, and by
  the gaps around the content card and the band above the sidebar.
- The window's minimum width drops to 640 px, the width at which only the
  preview is docked.

## Capabilities

### Modified Capabilities

- `shell/layout-and-panes`: panes fold to fit the window, in order, and open as
  overlays while folded; the sidebar reveals on hover; the window is draggable;
  the preview's minimum is the canvas floor.
- `preview/shadow-canvas`: the canvas has a floor, the toolbar sits in the header
  row and its tiers follow the room beside the actions; the inspector folds to
  its bar when the preview is too narrow for it and expands over the canvas.

## Non-goals

- Hiding the chat by hand while there is room for it; the chat folds only for
  want of room.
- Persisting a fold, or a peek, across launches.
- Changing the preview's room (840 px) or the chat's minimum (380 px).
- A keyboard shortcut for the chat overlay.

## Impact

- Webview: `lib/studio/panes.ts` (widths, `fitPanes`, `inspectorHasRoom`), new
  `hooks/use-window-width.ts` and `hooks/use-sidebar-peek.ts`,
  `hooks/use-panes.ts`, `hooks/use-sidebar-collapse.ts`,
  `hooks/use-canvas-layers.ts`, `hooks/use-canvas-preview.ts`,
  `components/studio/app-shell.tsx`, `chat-pane.tsx`, `preview-pane.tsx`,
  `canvas-preview.tsx`.
- Rust core: `src-tauri/capabilities/default.json` grants
  `core:window:allow-start-dragging`; `tauri.conf.json` `minWidth` 960 → 640.
- Tests: `test/register-dom.ts` gives happy-dom the default 1440 × 900 window.
- No sidecar, IPC, protocol, history or `settings.json` change.
