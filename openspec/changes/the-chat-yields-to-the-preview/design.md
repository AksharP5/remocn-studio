## Context

The shell (`components/studio/app-shell.tsx`) is a fixed 288 px sidebar beside a
react-resizable-panels group of two panels, `chat` (minimum 380 px) and `preview`
(minimum 360 px, collapsible, since a preview dragged shut is a preview hidden).
While the preview is shown the chat is `preserve-pixel-size`, so every change of
the group's width — the sidebar sliding, the window resizing — comes out of the
preview. The layout is stored under `layout:shell` only after a user interaction.

Since the canvas replaced the iframe preview, the inspector is not a panel of the
group any more: it is a 340 px column inside the preview
(`--canvas-inspector-width`), open by default each time the preview mounts, with
the 20 px ruler on the canvas's left, the toolbar and the pane's actions sharing
the canvas's top row, and the playback panel spanning its bottom, 16 px in from
the ruler and from the inspector.

Measured from the screenshot that raised this (default 1440 px window, sidebar
open, default split): the group is about 1142 px, the preview 502 px, so the
canvas between ruler and inspector was 142 px and the playback panel about
110 px — its hint wrapped one word per line and the toolbar was cut off at the
fourth button.

## Goals / Non-Goals

**Goals:** the preview opens wide enough for what it holds; the chat is what
narrows; nothing is hidden automatically; a person's own drag is respected.

**Non-Goals:** a new minimum for the preview, automatic collapse of anything,
reacting to the inspector being expanded inside a narrow preview.

## Decisions

### A soft room enforced by the studio, not a larger `minSize`

The obvious fix is `minSize` = inspector + canvas. The library rules it out.
`validatePanelConstraints` (bundled as `Z` in react-resizable-panels 4.12.2) snaps
a collapsible panel that is below half its minimum to its collapsed size, and
every layout validation runs it — mount, a constraint change, and each
ResizeObserver tick of the group. With the chat keeping its pixels, a window
narrowed until the preview's share falls under 420 px would collapse the preview,
and `usePreviewCollapse` would record that as hidden: the automatic closing the
request rules out. The same snap exists at today's 360 px minimum, under 180 px,
and this change keeps it no more reachable than it was (see Risks).

So the preview's hard minimum stays 360 px, and the room is a target the webview
moves toward with `panel.resize()`: `previewRoom(previewWidth, groupWidth)` in
`lib/studio/panes.ts` answers `min(PREVIEW_ROOM, groupWidth − CHAT_MIN_WIDTH)`
when that is more than a pixel above the preview's width, else `null`. It never
narrows the preview, and the library caps the resize at the chat's minimum on
its own anyway.

### When the room is enforced

`hooks/use-preview-room.ts` checks the room:

- in a layout effect on `isShown` / `isSliding`, which runs after
  `usePreviewCollapse`'s `expand()` in the same commit (effects run in hook
  order), so showing the preview is one slide from collapsed to the room; the
  same effect covers mount and the sidebar settling;
- in the group's `onLayoutChanged` when `isUserInteraction` is false — mount,
  window resize, imperative calls, the double-click reset — composed with the
  stored layout's own handler, which still receives every change.

It is skipped while the sidebar slides (the group resizes every frame then, and
`FrozenPane` holds the preview's content still), while the preview is hidden or
collapsed, and after a drag or a keyboard resize of the divider. A resize the
hook makes itself reports back through `onLayoutChanged` and finds the room
reached, so it cannot loop. `onLayoutChanged` is dispatched synchronously inside
the library's emitter; a nested `resize()` there was read against the source and
is safe — the emitter iterates a copy of its listeners and the panels re-read the
latest layout from the store.

The preview's width is read as `getSize().asPercentage` × the sum of the group's
`[data-panel]` children, not `inPixels`: right after `expand()` the store holds
the new layout while the DOM still has the old one.

### Why 840 px

`PREVIEW_ROOM` is the 340 px inspector plus 500 px of canvas, rulers included.
480 px between ruler and inspector is where the full toolbar (≈ 310 px from a
16 px inset) and the pane's actions (Export's 88 px minimum, Hide the preview,
16 px padding) share their row without touching, and where the playback panel
keeps its controls with room for the hint. At the default window with the sidebar
open the chat's minimum caps the preview at 761 px (401 px of canvas); with the
sidebar hidden the preview gets the full room and the chat about 580 px.

### The toolbar makes way below the room

At the capped 401 px canvas the full toolbar and Export overlap by about 70 px.
The top row is a named container (`@container/canvas-top`), so its width, not the
window's, decides: below 30rem Zoom out, Zoom in and Full screen go (all three
have shortcuts, and Full screen a twin in the playback panel), needing ≈ 380 px;
below 25rem Zoom to selection and Rulers go too, ≈ 320 px. Show content outside
the frame stays, since it has no shortcut. This mirrors the composer's
`@container/composer` collapse.

### Alternatives ruled out

- **Flip the resize behaviour** (preview keeps its pixels, the chat stretches):
  every sidebar slide would reflow the transcript each frame instead of the
  frozen preview, and a larger window would widen the chat instead of the canvas.
- **Collapse the inspector or the sidebar on a narrow window:** the request is
  that nothing closes by itself.
- **Change only the default split:** a stored layout, or a preview shown again at
  the width it was hidden at, would still open squeezed.

## Ownership and failure direction

All of it is webview state in `ShellPanes`: no IPC, no protocol bump, no history
migration, no new `settings.json` key. `layout:shell` keeps storing only what the
person drags. When the chat has nothing left to give, the preview keeps what is
left and the toolbar makes way; nothing is hidden and nothing is silent, since
every control that leaves the toolbar keeps a shortcut.

## Risks

- A person who drags the preview narrower than its room gets it back at the next
  sidebar toggle, window resize or launch. That is the rule as asked — the chat
  yields first — and the stored layout still holds their drag.
- The snap at half the preview's minimum is still there. A preview already
  dragged below about 470 px loses the sidebar's 288 px while the slide runs,
  when the room is not enforced, and can be snapped shut and recorded as hidden,
  exactly as before this change. Enforcing the room during the slide would move
  that per-frame reflow onto the transcript; it is left for its own change.
- The spec's first requirement still names the properties pane as a third member
  of the group; that is older drift, left for its own change.
