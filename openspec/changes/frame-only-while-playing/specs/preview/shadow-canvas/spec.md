## MODIFIED Requirements

### Requirement: Content outside the frame is visible on the canvas
While the video is paused, the canvas SHALL draw content that extends beyond the
video frame, dimmed, and keep it selectable. While the video plays, the canvas
SHALL draw only what is inside the frame, and SHALL draw the content outside it
again as soon as playback stops. Clipping by elements that cover exactly the
frame SHALL be lifted on the canvas; clipping by smaller elements SHALL be kept.
A toolbar toggle SHALL hide content outside the frame at all times; hidden
content SHALL be neither drawn nor picked. Rendering, Snapshot and export SHALL
continue to show the frame only.

#### Scenario: An element enters from off-screen
- **WHEN** the video is paused at a frame where an element is still outside the frame
- **THEN** it is drawn dimmed next to the frame and can be picked

#### Scenario: The video clips at its root
- **WHEN** the video is paused and its root or a scene container is frame-sized with hidden overflow
- **THEN** its children beyond the frame are still drawn dimmed on the canvas
- **AND** a rounded clip inside the frame still clips its content

#### Scenario: Playing with content outside shown
- **WHEN** the toggle is on and the person plays the video
- **THEN** the canvas shows only what is inside the frame, and the surround stays dimmed and empty

#### Scenario: Pausing
- **WHEN** the person pauses, scrubs or steps to a frame
- **THEN** content outside the frame at that frame is drawn dimmed again and can be picked

#### Scenario: The canvas learns of a pause late
- **WHEN** playback has stopped but the canvas has not yet been told
- **THEN** it keeps showing only what is inside the frame until it is, never content from another frame

#### Scenario: Hiding what is outside
- **WHEN** the toggle is off
- **THEN** the canvas shows only what is inside the frame, playing or paused
- **AND** a click beside the frame does not pick content hidden there
