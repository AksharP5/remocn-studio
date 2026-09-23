## ADDED Requirements

### Requirement: Direct manipulation snaps to the frame and other objects
Moving or resizing an unrotated managed object SHALL snap the sides that the
gesture moves to the frame's edges and centre and to the edges and centres of
other visible managed objects when within six screen pixels, independent of zoom.
A guide line SHALL show each active snap. Holding ⌘ or Ctrl SHALL disable
snapping for the gesture. Rotation and aspect-locked corner resizing SHALL NOT snap.

#### Scenario: Centring an object
- **WHEN** a dragged object's centre comes within six screen pixels of the frame's centre
- **THEN** the object aligns to the centre and a guide is drawn across the frame
- **AND** the committed value is in composition units

#### Scenario: Snapping is turned off
- **WHEN** ⌘ or Ctrl is held during the drag
- **THEN** the object follows the pointer exactly and no guide is drawn

### Requirement: The keyboard nudges a selected object
With a managed object selected and editable, arrow keys on the canvas SHALL move
it by one composition unit, or ten with Shift; with a resize or rotation handle
focused they SHALL change that edge or angle. Consecutive presses SHALL be one
operation with one Undo. Without an editable selection, arrow keys SHALL keep
stepping frames.

#### Scenario: Holding an arrow key
- **WHEN** an arrow key is held on a selected object
- **THEN** the object keeps moving and one operation is written after the key is released

#### Scenario: Nothing editable is selected
- **WHEN** an arrow key is pressed on the canvas without a managed selection
- **THEN** the playhead moves one frame

## MODIFIED Requirements

### Requirement: A rebuild clears what refers to the old render

When the preview reports that it rebuilt, legacy selections tied to the old render SHALL be cleared: pending card values are reset, the card is closed, markers are removed, and references already added are marked as no longer reopenable. On the canvas, the element that was picked SHALL then be picked again in the rebuilt runtime when it can still be found by its per-instance anchor, reopening its card. Managed objects retain their stable-ID behavior. Element selection SHALL be enabled again automatically when the preview is ready and editing is available. The text being typed in the composer and the references already in it SHALL NOT be removed.

#### Scenario: A turn writes to the project while a card is open

- **WHEN** the preview rebuilds
- **THEN** the legacy card's pending values are reset and its markers go
- **AND** on the canvas the card reopens on the same element when it still exists
- **AND** the next ready preview supports selection automatically
- **AND** what was typed in the composer is still there

#### Scenario: A chip from before the rebuild

- **WHEN** a selection added before the rebuild is clicked in the composer
- **THEN** it does not reopen the properties pane
