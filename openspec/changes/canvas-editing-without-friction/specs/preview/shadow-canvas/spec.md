## ADDED Requirements

### Requirement: The camera has keyboard shortcuts and frames the selection
With focus on the canvas and not in a text field, ⌘0 SHALL set 100%, ⌘+ and ⌘−
SHALL zoom about the viewport centre, ⇧1 SHALL fit the video and ⇧2 SHALL zoom to
the selection. Zoom to selection SHALL also be a toolbar action, disabled without
a selection, and SHALL fit the selection's box inside the unobscured area up to
400%. Shortcuts SHALL do nothing while an edit holds the camera.

#### Scenario: Zooming to a small element
- **WHEN** an element is selected and ⇧2 is pressed
- **THEN** the element is centred in the area not covered by the inspector and playback
- **AND** the zoom does not exceed 400%

#### Scenario: A resize handle has focus
- **WHEN** a geometry handle is focused and ⇧1 is pressed
- **THEN** the video is fitted

### Requirement: Content outside the frame is visible on the canvas
The canvas SHALL draw content that extends beyond the video frame, dimmed, and
keep it selectable. Clipping by elements that cover exactly the frame SHALL be
lifted on the canvas; clipping by smaller elements SHALL be kept. A toolbar toggle SHALL hide it. Rendering, Snapshot and export
SHALL continue to show the frame only.

#### Scenario: An element enters from off-screen
- **WHEN** the playhead is at a frame where an element is still outside the frame
- **THEN** it is drawn dimmed next to the frame and can be picked

#### Scenario: The video clips at its root
- **WHEN** the video's root or a scene container is frame-sized with hidden overflow
- **THEN** its children beyond the frame are still drawn dimmed on the canvas
- **AND** a rounded clip inside the frame still clips its content

#### Scenario: Hiding what is outside
- **WHEN** the toggle is off
- **THEN** the canvas shows only what is inside the frame
