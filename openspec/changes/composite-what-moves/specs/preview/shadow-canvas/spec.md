## MODIFIED Requirements

### Requirement: Content outside the frame is visible on the canvas
The canvas SHALL draw content that extends beyond the video frame, dimmed, and
keep it selectable; it SHALL stay drawn, dimmed, while the video plays. Clipping by
elements that cover exactly the frame SHALL be lifted on the canvas; clipping by
smaller elements SHALL be kept. A toolbar toggle SHALL hide it. Rendering,
Snapshot and export SHALL continue to show the frame only.

#### Scenario: An element enters from off-screen
- **WHEN** the playhead is at a frame where an element is still outside the frame
- **THEN** it is drawn dimmed next to the frame and can be picked

#### Scenario: The video clips at its root
- **WHEN** the video's root or a scene container is frame-sized with hidden overflow
- **THEN** its children beyond the frame are still drawn dimmed on the canvas
- **AND** a rounded clip inside the frame still clips its content

#### Scenario: Playing with content outside shown
- **WHEN** the toggle is on and the person plays a video whose moving content runs past the frame
- **THEN** that content keeps moving, dimmed, beside the frame for the whole playback
- **AND** playback keeps the pace it has with the toggle off

#### Scenario: Hiding what is outside
- **WHEN** the toggle is off
- **THEN** the canvas shows only what is inside the frame
