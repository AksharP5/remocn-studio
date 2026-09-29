## ADDED Requirements

### Requirement: The chat yields before the preview is squeezed

The preview holds the canvas and, beside it, the inspector, so its width SHALL be
judged against its room: the open inspector plus a canvas wide enough for the
canvas toolbar, the pane's actions and the playback panel (840 pixels,
`PREVIEW_ROOM` in `lib/studio/panes.ts`). Whenever the preview is shown narrower
than its room and the change did not come from the person moving the divider —
the preview being shown, a launch, the sidebar opening or closing once its slide
has settled, the window being resized — the chat pane SHALL give up width, down to
its own minimum, and the preview SHALL take it. The webview owns this decision.
The studio SHALL NOT hide the sidebar, the preview or the inspector to make room,
SHALL NOT narrow the preview to do it, and SHALL NOT store the width it sets.

#### Scenario: Showing the preview

- **WHEN** the person shows the preview and it would come back narrower than its room
- **THEN** the chat narrows and the preview opens at its room, in the one slide
- **AND** the sidebar and the inspector stay open

#### Scenario: The chat reaches its minimum

- **WHEN** the window is too narrow for the chat's minimum and the preview's room together
- **THEN** the chat stops at its minimum and the preview takes the rest
- **AND** no pane is hidden; the canvas toolbar makes way instead

#### Scenario: Launching

- **WHEN** the studio launches with the preview shown and the stored or default widths leave it narrower than its room
- **THEN** the chat yields as it does when the preview is shown
- **AND** the stored widths are not rewritten

#### Scenario: The sidebar opens

- **WHEN** the person shows the sidebar while the preview is at its room
- **THEN** once the slide settles the chat gives back the width the sidebar took, down to its minimum

#### Scenario: Dragging the divider

- **WHEN** the person drags the divider so the preview is narrower than its room
- **THEN** the preview stays where it was dropped, down to its own minimum
- **AND** the next change of layout by any other means gives it its room again

#### Scenario: The preview already has its room

- **WHEN** the preview is at least as wide as its room
- **THEN** nothing moves

## MODIFIED Requirements

### Requirement: A pane layout is remembered per pane combination

The width the person drags the panes to SHALL be remembered across launches under
the set of panes the resizable group holds — the chat and the preview. A width
stored for one set SHALL NOT be read back into another. Hiding the preview SHALL
collapse it within the same set rather than storing a layout of its own. Only a
width the person sets with the divider SHALL be stored; a width the studio sets to
give the preview its room SHALL NOT.

#### Scenario: Coming back to a resized window

- **WHEN** the person resized the panes and relaunches
- **THEN** the panes come back at the widths they were left at
- **AND** a preview left narrower than its room is given its room by the chat, without the stored widths changing

#### Scenario: Nothing was ever dragged

- **WHEN** the person has never moved a divider
- **THEN** the panes take their default proportions, the chat yields to the preview's room, and nothing is stored
