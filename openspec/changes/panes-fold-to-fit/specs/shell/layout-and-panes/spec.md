## ADDED Requirements

### Requirement: Panes fold to fit the window, preview last

The studio SHALL decide from the window's width which panes it docks, and SHALL
fold them in one order as the window narrows: the sidebar first, then the
inspector's content down to its bar, then the chat, so that at the window's
minimum width (640 pixels) the preview is still docked. The sidebar SHALL fold
when the window cannot hold it beside the chat at its minimum and the preview with
its inspector open and its canvas at its floor; the chat SHALL fold when the
window cannot hold it beside the preview at the preview's own minimum. With the
preview hidden the chat SHALL never fold. A fold SHALL follow the room available,
not a choice: it SHALL NOT be written to `settings.json`, and widening the window
SHALL bring each pane back as the person last chose it. A fold caused by the
window changing size SHALL be immediate; a pane the person hides or shows SHALL
still slide.

#### Scenario: Narrowing the window

- **WHEN** the person narrows the window from its default width
- **THEN** the sidebar folds first, then the inspector folds to its bar, then the chat folds
- **AND** the preview stays docked down to the window's minimum

#### Scenario: Widening it again

- **WHEN** the window grows back
- **THEN** each folded pane returns docked, in the reverse order
- **AND** a sidebar the person had hidden by hand stays hidden

#### Scenario: The preview is hidden

- **WHEN** the preview is hidden and the window is narrowed to its minimum
- **THEN** the sidebar folds and the chat stays docked

#### Scenario: Relaunching in a narrow window

- **WHEN** the studio launches in a window too narrow for every pane
- **THEN** it opens with the panes already folded, and `projectsPane` still holds the person's choice

### Requirement: A folded pane opens over the layout

A pane folded for want of room SHALL still open, over the docked panes rather than
beside them, without resizing what is underneath. The sidebar SHALL slide out over
the panes when the pointer rests at the window's left edge below the traffic
lights, and SHALL slide away when the pointer leaves it anywhere but back over
that edge, on Escape, or on a press outside it; ⌘B, the View menu and *Show the
project list* SHALL open and close it the same way while it has no room to dock.
A folded chat SHALL open from *Show the chat* at the start of the preview's
header and SHALL stay over the preview until it is closed from *Hide the chat* in
its own header or the window gains room for it. An overlay SHALL NOT be
remembered, and SHALL take no focus and no keys while closed.

#### Scenario: Reaching for the sidebar

- **WHEN** the sidebar is folded or hidden and the pointer rests at the window's left edge
- **THEN** the sidebar slides out over the chat and the preview
- **AND** moving the pointer off it to the right slides it away

#### Scenario: Toggling the sidebar with no room

- **WHEN** the person presses ⌘B while the window has no room to dock the sidebar
- **THEN** the sidebar opens over the panes, and ⌘B again closes it
- **AND** `projectsPane` is not rewritten

#### Scenario: Opening the folded chat

- **WHEN** the chat is folded and the person presses *Show the chat*
- **THEN** the chat slides over the preview's leading side
- **AND** it stays while the person picks elements on the visible canvas
- **AND** *Hide the chat* in its header slides it away

### Requirement: The window is dragged by its chrome

The window SHALL be draggable by the pane headers — the sidebar's brand row, the
chat's header and the preview's header, in Preview and in Docs — and by the bare
window around the content card: the band above the sidebar and the gaps at the
card's edges. Controls inside those regions SHALL keep their clicks. The core
SHALL grant the webview `core:window:allow-start-dragging`, which every drag
region needs.

#### Scenario: Dragging by a header

- **WHEN** the person presses on an empty part of a pane header and drags
- **THEN** the window moves

#### Scenario: Pressing a control in a header

- **WHEN** the person presses Export or a toolbar button
- **THEN** the control acts and the window does not move

## MODIFIED Requirements

### Requirement: The window is a sidebar beside a resizable group

The window SHALL hold a fixed-width sidebar and, beside it, a resizable group of
the chat pane and the preview pane. The divider between chat and preview SHALL be
draggable while both are docked, and each pane SHALL keep a minimum width of its
own: 380 pixels for the chat, and for the preview its canvas floor plus the left
ruler and the inspector's bar (468 pixels). Which of the three is docked follows
the window's width (see *Panes fold to fit the window, preview last*).

#### Scenario: Resizing the panes

- **WHEN** the person drags the divider between the chat and the preview
- **THEN** both panes resize and neither goes below its own minimum width

#### Scenario: The sidebar is not resizable

- **WHEN** the person looks for a divider between the sidebar and the panes
- **THEN** there is none: the sidebar has one width and only ever collapses

#### Scenario: A pane slide is running

- **WHEN** the sidebar or the preview is opening or closing
- **THEN** the preview keeps the width it had until the animation settles
- **AND** the compiled page inside it is not relaid out while the slide runs

#### Scenario: The chat is folded

- **WHEN** the chat is folded
- **THEN** the preview takes the whole group and the divider is neither shown nor draggable

### Requirement: The sidebar collapses and is remembered

The sidebar SHALL be collapsible from the button on its own brand row and from a
button in the chat pane's header, and the choice SHALL persist across launches as
`projectsPane` in `settings.json`. While collapsed, folded or closing it SHALL
take no focus and no keys. While the window has no room to dock it, its toggles
SHALL open it over the layout instead of changing the stored choice.

#### Scenario: Hiding the sidebar

- **WHEN** the person hides the sidebar
- **THEN** it slides away, the panes take the space, and *Show the project list* appears in the chat pane's header

#### Scenario: Tabbing while it is closing

- **WHEN** the sidebar is hidden or hiding
- **THEN** nothing inside it can be reached by keyboard

### Requirement: The chat yields before the preview is squeezed

The preview holds the canvas and, beside it, the inspector, so its width SHALL be
judged against its room: the open inspector plus a canvas wide enough for the
canvas toolbar, the pane's actions and the playback panel (840 pixels,
`PREVIEW_ROOM` in `lib/studio/panes.ts`). Whenever the preview is shown narrower
than its room and the change did not come from the person moving the divider —
the preview being shown, a launch, the sidebar opening or closing once its slide
has settled, the window being resized — the chat pane SHALL give up width, down to
its own minimum, and the preview SHALL take it. The webview owns this decision.
The studio SHALL NOT narrow the preview to do it and SHALL NOT store the width it
sets. When the chat at its minimum is still not enough, panes fold as
*Panes fold to fit the window, preview last* describes.

#### Scenario: Showing the preview

- **WHEN** the person shows the preview and it would come back narrower than its room
- **THEN** the chat narrows and the preview opens at its room, in the one slide

#### Scenario: The chat reaches its minimum

- **WHEN** the window is too narrow for the chat's minimum and the preview's room together
- **THEN** the chat stops at its minimum and the preview takes the rest
- **AND** the canvas toolbar makes way until the window is narrow enough for the next fold

#### Scenario: Launching

- **WHEN** the studio launches with the preview shown and the stored or default widths leave it narrower than its room
- **THEN** the chat yields as it does when the preview is shown
- **AND** the stored widths are not rewritten

#### Scenario: Dragging the divider

- **WHEN** the person drags the divider so the preview is narrower than its room
- **THEN** the preview stays where it was dropped, down to its own minimum
- **AND** the next change of layout by any other means gives it its room again

#### Scenario: The preview already has its room

- **WHEN** the preview is at least as wide as its room
- **THEN** nothing moves
