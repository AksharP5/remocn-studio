## ADDED Requirements

### Requirement: Entry and exit poses are edited on the canvas
A managed object that moves between two field-backed poses through the v5
`geometryBetween` helper SHALL be edited in the pose that dominates the current
frame: the start pose while its weight is at least one half, the other pose from
the midpoint on. The canvas SHALL name the edited pose, draw the other pose as an
outline and draw the path between the two. When the move declares the local
frames of both poses, clicking the outline SHALL move the playhead to that pose.
A selected managed object SHALL keep its handles while transparent. Saving SHALL write only the edited
pose's fields as one operation. Objects moved by an unbound CSS offset keep editing
their resting geometry.

#### Scenario: Dragging an object before it has entered
- **WHEN** the playhead is early in an entry and the object, still outside the frame, is dragged
- **THEN** its start pose moves and its resting pose stays
- **AND** the label reads "Entry start" and the resting pose is outlined with the path to it

#### Scenario: Dragging an object that has almost left
- **WHEN** the playhead is late in an exit and the object is dragged
- **THEN** its end pose moves and the label reads "Exit end"

#### Scenario: Going to the other pose
- **WHEN** the move declares the frames of its two poses and the outline of the other pose is clicked
- **THEN** playback pauses and the playhead moves to the frame of that pose
- **AND** the object stays selected, now editing that pose, even if it is transparent there

#### Scenario: Moving a start pose that is transparent and outside the frame
- **WHEN** the selected object is transparent at the current frame or cannot be hit where it is drawn
- **THEN** it is shown half-transparent in the editor and its label says so
- **AND** dragging inside its selection frame moves it instead of panning the canvas

#### Scenario: The helper in an older project
- **WHEN** a project created before the helper is opened
- **THEN** the helper file is added next to its authored v5 runtime and nothing authored changes
