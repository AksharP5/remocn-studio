## MODIFIED Requirements

### Requirement: The properties pane exists only while it has something in it

The canvas inspector SHALL be visible by default and flush with the top and
right edges of the preview workspace. It SHALL consist of a vertical bar of
icon buttons along its outer edge and a content area beside it. The bar SHALL
hold the inspector's views — Layers (or the video's details when the object list
is unavailable) and Properties — then Snapshot, and a control that collapses and
expands the content area. The active view SHALL be marked; Properties SHALL be
disabled without a selection. Clicking the active view's icon SHALL collapse the
content area, and clicking any view's icon while collapsed SHALL expand it on
that view. Collapsed, only the bar SHALL remain, with selection and edits
preserved. The video SHALL NOT automatically reframe when the inspector
collapses or expands. Export SHALL be in the preview pane's header, in Preview
and Docs alike. Playback controls SHALL remain beside the inspector without
overlapping it. What the properties controls edit belongs to
preview/properties-pane.

#### Scenario: Nothing is selected
- **WHEN** the canvas opens or selection is cleared
- **THEN** the inspector shows its Layers view and its bar, with Properties disabled

#### Scenario: An element with a schema is picked
- **WHEN** an element with editable properties is selected
- **THEN** the inspector shows its Properties view with the element's properties

#### Scenario: An element with no schema is picked
- **WHEN** the selected element has no tunable properties
- **THEN** the inspector keeps its Layers view and the compact comment card is used

#### Scenario: The inspector is collapsed
- **WHEN** the person clicks the active view's icon or the collapse control
- **THEN** only the bar remains, selection and edits are preserved, and any view's icon expands it again

#### Scenario: Exporting from Preview
- **WHEN** the canvas is shown
- **THEN** Export is in the pane header, where it also is in Docs

#### Scenario: The preview is hidden
- **WHEN** the preview is hidden
- **THEN** the inspector is hidden with it
