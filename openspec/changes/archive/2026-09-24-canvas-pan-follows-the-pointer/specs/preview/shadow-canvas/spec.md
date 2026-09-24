## ADDED Requirements

### Requirement: Panning follows the pointer
Panning by Space-drag, the hand tool, a drag on the empty canvas, a middle-button
drag or wheel/trackpad scroll SHALL move the view by the pointer's travel, updated
at most once per display frame, without waiting on the inspector or the
properties pane to re-render.

#### Scenario: Space-drag across the canvas
- **WHEN** the user holds Space and drags across the canvas
- **THEN** the video stays under the same point of the pointer throughout the drag
- **AND** the view moves smoothly, without jumps

#### Scenario: Middle-button drag
- **WHEN** the user drags with the middle mouse button anywhere on the canvas
- **THEN** the canvas pans exactly as with Space-drag
- **AND** nothing is selected or edited

#### Scenario: A properties pane is open
- **WHEN** a managed object is selected and the user pans
- **THEN** panning is as smooth as without a selection
