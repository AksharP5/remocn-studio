## MODIFIED Requirements

### Requirement: The properties pane exists only while it has something in it

The canvas inspector SHALL be visible by default and flush with the top and
right edges of the preview workspace. Without a tunable selection it SHALL show
video information and a selection hint. Selecting a tunable element SHALL replace
that content with its existing properties controls. What those controls edit
belongs to preview/properties-pane.

The inspector toolbar SHALL contain an icon-only Snapshot action, Export and a
hide control. Hiding the inspector SHALL preserve selection and expose a control
to show it again. The video SHALL NOT automatically reframe when visibility
changes. Playback controls SHALL remain beside the panel without overlapping it.

#### Scenario: Nothing is selected
- **WHEN** the canvas opens or selection is cleared
- **THEN** the inspector remains available with video information and its actions

#### Scenario: An element with a schema is picked
- **WHEN** an element with editable properties is selected
- **THEN** its properties fill the inspector above the canvas

#### Scenario: An element with no schema is picked
- **WHEN** the selected element has no tunable properties
- **THEN** the inspector keeps its video information and the compact comment card is used

#### Scenario: The inspector is hidden
- **WHEN** the user hides the inspector
- **THEN** selection and edits are preserved and Show inspector remains accessible

#### Scenario: The preview is hidden
- **WHEN** the preview is hidden
- **THEN** the inspector is hidden with it
