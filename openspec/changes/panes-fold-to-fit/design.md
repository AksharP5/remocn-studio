## Context

Builds on `the-chat-yields-to-the-preview` (unarchived) and must be archived
after it: that change's "nothing is hidden automatically" clause is replaced here,
and its toolbar requirement is modified.

The shell is a 288 px sidebar in a CSS grid column beside a content card that
holds a react-resizable-panels group of `chat` (380 px minimum) and `preview`
(collapsible). The inspector is an absolutely placed column inside the preview,
and the canvas toolbar used to sit absolutely over the preview header's empty
left side, so nothing stopped the header's actions and the toolbar from sharing
pixels.

## Decisions

### The floor is measured from the header row, not guessed

At the `sm:` sizes the app always runs at (the window never gets below 640 px),
the toolbar is 309 px whole, 219 px without Zoom out / Zoom in / Full screen, and
159 px without Zoom to selection and Rulers. The actions are 120 px idle
(`min-w-22` Export, a 28 px icon, a 4 px gap) and 176 px while an export runs
(`min-w-36`). With the header's 16 px paddings and an 8 px gap, the narrowest row
is 319 px idle and 375 px exporting, so the canvas floor is **400 px**. When the
chat folds, the preview is leftmost and the row also clears the traffic lights
(`--titlebar-inline-inset`, 80 px on macOS) and carries *Show the chat*: +100 px.

The toolbar moved into the header's flow (`flex-1 min-w-0`, its own
`@container/canvas-toolbar`), so its tiers read the room left beside the actions:
hide the first group under 19.5rem (312 px), the second under 14rem (224 px).
That also answers the export-progress case, which the old canvas-wide container
could not see.

### Fold thresholds are pure numbers of the window width

`fitPanes(windowWidth, isPreviewShown)` in `lib/studio/panes.ts`:

| Pane | Docked while the window is at least |
| --- | --- |
| sidebar (preview shown) | 288 + 8 + 380 + 1 + 20 + 400 + 340 = **1437** |
| sidebar (preview hidden) | 288 + 8 + 380 = **676** |
| chat (preview shown) | 16 + 380 + 1 + 468 = **865** |

The inspector is not in that table: it folds from the preview's own measured width
(`inspectorHasRoom(previewWidth, isLeftmost)`, 760 px, or 860 px leftmost),
through the camera's viewport bounds that the canvas already observes. With the
chat at its minimum that is a window of 1157 px, between the other two, so the
order sidebar → inspector → chat holds; a person who drags the chat wider folds
the inspector sooner, which is the drag they asked for.

The window width comes from `useSyncExternalStore` over `resize`. Its update is
synchronous, so the new constraints are committed inside the resize event, before
the group's ResizeObserver runs — the group never validates a layout whose
minimums exceed its width. That matters because a collapsible panel under half
its minimum is snapped shut by the library and `usePreviewCollapse` would record
that as the preview hidden (see the previous change's design).

### A fold is instant; a choice slides

`useSidebarCollapse(isShown, hasRoom)` jumps straight to shown or hidden when
`hasRoom` changed in the same render, and the grid's `grid-template-columns` and
margin transitions are only applied while a slide runs. An animated fold would
leave the group narrow for 200 ms — long enough, on a large jump such as a window
snapped to half the screen, for the snap described above.

### The chat folds by constraint, not by collapse

A folded chat gets `minSize` and `maxSize` of `0px`; unfolded, 380 px and 100 %.
The library revalidates on any constraint change. Making the chat `collapsible`
would have also made it collapsible by dragging the divider, a gesture with no
state behind it. The chat's content never leaves its panel: while folded, its
wrapper is positioned against the content card (the panel's own divs are not
positioned, and a clip only applies to descendants whose containing block is
inside it), so the same `ChatPane` instance is the overlay and nothing remounts.

### Intent, fit and peek are three states

`usePanes` keeps the stored intent (`projectsPane`), derives docking from intent
and fit, and holds a transient peek per folded pane. `toggleProjects` hides or
docks when there is room and peeks when there is not, so ⌘B, the View menu and
the header button all do the right thing without knowing about fit. The commands
read "shown" as docked or peeking. A peek is reset when its pane docks, so a later
fold does not reopen it.

### Leaving the sidebar overlay

It closes after 200 ms when the pointer leaves it, unless the exit is at the
window's left edge (x ≤ 8), on Escape, and on a press outside it. "Inside" is
marked by the overlay's React `onPointerDown`, which bubbles through portals, so a
menu opened from the sidebar counts as inside; the document listener runs after
React's root listener.

### Dragging

Tauri's `drag.js` invokes `plugin:window|start_dragging` for every drag region,
and `core:default` does not include `core:window:allow-start-dragging`, so every
drag was refused since the first header was marked. The grid and the sidebar
column now carry a bare `data-tauri-drag-region` (their own box only: the gaps
around the card and the band above the sidebar), the sidebar overlay likewise.

## Risks / Trade-offs

- **The sidebar folds at 1437 px**, three pixels under the default window. A
  window a little smaller than the default opens without the sidebar. That is the
  requested order; the alternative (judging the sidebar against the inspector
  folded) keeps it docked while the canvas is a sliver.
- **The leftmost preview's ruler sits under the traffic lights.** The header
  clears them; the 20 px vertical ruler beneath them does not, and needs nothing
  clickable there.
- **Hover-to-open can surprise** a pointer travelling to a Dock on the left of the
  screen. The edge starts below the traffic lights and waits 80 ms.
