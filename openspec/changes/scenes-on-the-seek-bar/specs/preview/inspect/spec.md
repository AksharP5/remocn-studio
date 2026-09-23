## ADDED Requirements

### Requirement: Scenes in the object list move the playhead

A scene object in the object list SHALL be linked to the scene on the seek bar
whose name equals its label. Clicking a linked scene row SHALL select the scene
object and move the playhead to the scene's first frame. Clicking the row of an
object that is not mounted at the current frame SHALL select it and move the
playhead to the first frame of the scene it belongs to, so it is drawn with its
outline and handles. A scene object or object with no linked scene SHALL be
selected without moving the playhead.

#### Scenario: Jumping to a scene from the list

- **WHEN** the person clicks the "Pricing" scene row
- **THEN** the playhead moves to the first frame of the "Pricing" scene and the scene object is selected

#### Scenario: Reaching an off-screen object

- **WHEN** the person clicks a dimmed row whose scene is linked
- **THEN** the playhead moves to that scene's first frame
- **AND** the object is selected with its outline and handles on the canvas

#### Scenario: A scene the seek bar does not know

- **WHEN** a scene object's label matches no scene on the seek bar
- **THEN** clicking it selects it and the playhead stays where it is
