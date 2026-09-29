## Why

The inspector moved inside the preview pane, but the pane's widths did not move
with it. The preview's minimum is still 360 px, the inspector alone takes 340 px
of it, and the chat keeps its pixels whenever the group changes size. Showing the
preview at the default window (1440 px, sidebar open) with the default 56 / 44
split gives the preview 502 px: a 142 px canvas beside the inspector, a playback
panel about 110 px wide whose hint wraps one word per line, and a canvas toolbar
cut off under Export. Nothing is broken, but nothing fits.

The fix asked for: when the preview opens, the chat narrows so that everything
fits, and nothing is closed automatically to get there.

## What Changes

- The preview has a **room**: the open inspector plus a canvas wide enough for
  its toolbar, the pane's actions and the playback panel — 840 px.
- Whenever the preview is shown narrower than its room and the change did not
  come from the person moving the divider — showing the preview, a launch, the
  sidebar opening or closing once its slide settles, a window resize — the chat
  gives up width, down to its own 380 px minimum, and the preview takes it.
- The studio never hides the sidebar, the preview or the inspector to make room,
  never narrows the preview to do it, and never stores the width it sets. A drag
  of the divider still holds the preview wherever it is dropped, down to 360 px.
- When the chat is already at its minimum and the canvas is still narrow, the
  canvas toolbar makes way instead: below 480 px of canvas Zoom out, Zoom in and
  Full screen leave the toolbar, below 400 px Zoom to selection and Rulers too.
  Each keeps its shortcut, and Full screen keeps its button in the playback panel.

At the default window the preview now opens at 761 px (a 401 px canvas) with the
chat at 380 px; with the sidebar hidden it opens at its 840 px room.

## Capabilities

### Modified Capabilities

- `shell/layout-and-panes`: a new requirement, the chat yields before the preview
  is squeezed; the remembered-layout requirement says the width the studio sets is
  not stored and drops the three-pane layout the group no longer has.
- `preview/shadow-canvas`: a new requirement, the toolbar makes way on a narrow
  canvas.

## Non-goals

- Raising the preview's own minimum to its room. A collapsible panel below half
  its minimum is snapped shut on every layout validation, so an 840 px minimum
  would hide the preview on an ordinary window shrink — the auto-closing this
  change exists to avoid (see design).
- Collapsing the sidebar or the inspector automatically on a narrow window.
- Making the chat yield when the person expands a collapsed inspector; the
  inspector opens by default each time the preview is shown, which is covered.
- Lowering the chat's 380 px minimum; the composer was built to collapse its
  control row down to it.
- Fixing the pre-existing `bun run check` failures under `videos/` and
  `artifacts/`.

## Impact

- Webview: `lib/studio/panes.ts` (the widths and `previewRoom`), new
  `hooks/use-preview-room.ts`, `components/studio/app-shell.tsx` wires it,
  `components/studio/canvas-preview.tsx` (the inspector width from `panes.ts`, the
  toolbar's container and its narrow tiers).
- No sidecar, Rust core, IPC, protocol, history or `settings.json` change. The
  stored `layout:shell` value is read as before and is not rewritten.
