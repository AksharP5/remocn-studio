## ADDED Requirements

### Requirement: Editing is scoped to the native surface
Main preview picking SHALL query the mounted video’s ShadowRoot. Geometry and
text overlays SHALL remain in unscaled screen space and repaint on camera
changes, including when playback is paused. Geometry ancestor traversal SHALL
include the camera outside the shadow host. Comment rectangles SHALL remain
normalized to video coordinates. Properties and playback chrome SHALL not
initiate a pick. Existing field eligibility and operation validation SHALL apply.

#### Scenario: A zoomed element is resized
- **WHEN** a supported managed geometry handle is dragged at a non-default zoom
- **THEN** the committed size and position use video units
- **AND** the camera remains fixed for the gesture

#### Scenario: Native text editing begins
- **WHEN** supported managed text is double-clicked
- **THEN** the existing inline editor opens above its text in the canvas
- **AND** saving uses the same operation and rendered receipt protocol

#### Scenario: A snapshot is drawn while zoomed
- **WHEN** the user drags a snapshot region over the video
- **THEN** it maps to the corresponding video region independently of pan and zoom

#### Scenario: An existing provider loads
- **WHEN** the native compiler encounters the supported studio-objects-v5 provider
- **THEN** its transport is adapted to the local surface without rewriting authored source
- **AND** generation and operation acknowledgments remain intact
