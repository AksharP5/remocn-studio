## ADDED Requirements

### Requirement: Managed properties save independently of the composer

For managed objects the pane SHALL show declared controls, save completed edits directly, retain selection across rebuilds and offer conflict-aware Undo. Switching selection SHALL NOT revert saved changes. Pending or failed writes SHALL be distinguished from saved values and prevent an export that would omit them.

#### Scenario: A sibling is picked
- **WHEN** a property is changed and another object is picked
- **THEN** the first edit is saved without Add or Send

#### Scenario: Saving fails
- **WHEN** a property cannot be saved
- **THEN** the pane retains the draft with an actionable error and does not claim success


#### Scenario: The saved file has not reached the compiled preview
- **WHEN** a property has been saved but the runtime has not acknowledged its operation receipt
- **THEN** export remains unavailable and the pane distinguishes this from an unsaved draft

### Requirement: Managed controls use DialKit and preserve gesture boundaries

The pane SHALL render supported fields with the existing DialKit controls, reuse
DialKit sliders for all numeric values, including timing, and group fields by declared group.
The studio SHALL persist collapsed groups using the existing pane preferences.

#### Scenario: Continuous adjustment
- **WHEN** a number or color is adjusted repeatedly during one pointer gesture
- **THEN** preview updates immediately and the completed gesture saves once

#### Scenario: Color notation
- **WHEN** a supported CSS color is entered in the color control
- **THEN** the saved value is normalized to hex without discarding its alpha

### Requirement: Animation controls use seconds and named easing presets

Timing fields with frame units SHALL display seconds using the composition's actual
FPS and save values on their declared frame grid. Timing SHALL remain unavailable
until FPS is known. New generated animations SHALL expose second-based timing and
wired editable easing fields; the pane SHALL visualize recognized named easing curves.

#### Scenario: A frame-based duration is edited
- **WHEN** a 30-frame duration is inspected at 60 FPS
- **THEN** the pane shows 0.5 seconds and saves edits back as frame values

#### Scenario: An easing preset is selected
- **WHEN** the user selects an option of a declared easing enum
- **THEN** its scalar value is previewed and saved through the normal managed operation flow

### Requirement: Rebuilding preserves playback position

The preview SHALL preserve the current frame and playback state when properties
trigger rebuilding, including a full iframe reload. Restored frames SHALL be
clamped to the new duration and SHALL NOT leak into a different composition.

#### Scenario: A property is changed at 13 seconds
- **WHEN** saving triggers a rebuild while preview is paused at 13 seconds
- **THEN** the rebuilt preview remains paused at the corresponding frame

### Requirement: Header actions remain outside the scrolling property list

The managed pane SHALL place its object selector, save status and recovery actions
in an automatically sized header. Only the property list SHALL scroll. The object
selector SHALL use DialKit and preserve stable object IDs as selection values.

#### Scenario: There are many editable properties
- **WHEN** the user scrolls a long list of properties while changes are pending
- **THEN** the header status and Discard action remain separate from the property controls

### Requirement: Custom easing curves are editable as one property

The pane SHALL render easing fields with draggable Bezier handles, coordinate
controls and preset selection. Drafts SHALL update preview and each completed
gesture SHALL save the entire tuple as one operation with checked Undo.

#### Scenario: A custom overshooting curve is edited
- **WHEN** the user edits an easing field to [0.2,-0.3,0.8,1.4]
- **THEN** preview and export use that curve, and Undo restores all four prior coordinates

#### Scenario: An older animation declares an easing enum
- **WHEN** its consumer still expects a named preset
- **THEN** the pane retains preset-only behavior until the document and consumer are explicitly migrated

### Requirement: Managed properties use task-oriented presentation

The header SHALL contain one DialKit element selector, Undo and close actions with
labels, and compact save status. The body SHALL separate Appearance and Animation
with keyboard-accessible tabs. Generated field labels SHALL be readable English;
stored IDs and explicitly authored labels SHALL remain unchanged. Unknown fields
SHALL remain accessible rather than being discarded by presentation heuristics.

#### Scenario: Editing a heading
- **WHEN** a heading exposes typography, colors, layout and motion
- **THEN** Appearance shows its text, colors and layout while Animation shows timing and motion controls
- **AND** X/Y and width/height can share rows, with secondary text spacing and Bezier coordinates disclosed separately

#### Scenario: Spring controls
- **WHEN** an object exposes a boolean spring switch and physical spring parameters
- **THEN** the physical settings are available while that switch is enabled

#### Scenario: Switching tabs with a draft
- **WHEN** the user switches property categories with pending edits
- **THEN** the edits are committed through the existing managed save path
