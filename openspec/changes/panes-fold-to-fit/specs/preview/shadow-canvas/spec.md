## ADDED Requirements

### Requirement: The canvas has a floor

The canvas — the space between the left ruler and the inspector — SHALL NOT be
narrower than its header row needs at its narrowest: the toolbar's Pan, Fit, zoom
readout and Show content outside the frame beside Export (or an export's
progress) and Hide the preview, 400 pixels. When the preview is the leftmost
docked pane its header SHALL also clear the traffic lights and lead with
*Show the chat*, and the floor SHALL grow by that lead. The preview's minimum
width SHALL be derived from the floor, so Export and Hide the preview are never
covered and never pushed out of the pane.

#### Scenario: The preview at its minimum

- **WHEN** the person drags the divider until the preview stops
- **THEN** the toolbar shows at least Pan, Fit, the zoom readout and Show content outside the frame
- **AND** Export and Hide the preview are whole and clickable

#### Scenario: An export is running at the floor

- **WHEN** an export's progress replaces Export while the canvas is at its floor
- **THEN** the progress and the toolbar do not overlap

### Requirement: The inspector folds to its bar when the preview is narrow

When the preview is narrower than the canvas floor plus the left ruler and the
open inspector, the inspector SHALL show only its bar, whatever the person last
chose, and the canvas chrome SHALL be laid out against the bar. Pressing a view's
icon or the expand control while folded SHALL open the inspector over the canvas,
without moving the toolbar, the playback panel or the frame, and pressing the
active view's icon or the collapse control SHALL close it again. When the preview
regains the room, the inspector SHALL return docked as the person last chose,
and an open overlay SHALL become the docked inspector.

#### Scenario: Narrowing the preview

- **WHEN** the window or the divider leaves the preview too narrow for the open inspector
- **THEN** the inspector folds to its bar and the canvas keeps its floor

#### Scenario: Opening the folded inspector

- **WHEN** the inspector is folded and the person presses Layers
- **THEN** the inspector opens over the right of the canvas on Layers
- **AND** the playback panel and the toolbar stay where they were

#### Scenario: Room returns

- **WHEN** the preview widens past what the open inspector needs
- **THEN** the inspector is docked again if the person had it open, and folded if they had collapsed it

### Requirement: The playback panel stays legible when narrow

The playback panel's canvas hint SHALL be one line: shown whole when it fits
beside the controls, and absent when it does not, never wrapped or cut
mid-phrase. The preview's own hint and the reason Inspect is unavailable SHALL
stay on one line and truncate, with the full text on hover. When the panel is
too narrow for the speed slider (under 28rem), a compact button SHALL show the
current speed (for example "1×") and move to the next speed on each press,
wrapping from the fastest to the slowest.

#### Scenario: A narrow canvas

- **WHEN** the playback panel is narrower than its hint needs
- **THEN** the hint is not shown and no line wraps
- **AND** the speed button shows the current rate

#### Scenario: Changing speed from the compact button

- **WHEN** the person presses the speed button at 1×
- **THEN** playback runs at 2×, and the next presses go to 0.25×, 0.5× and back to 1×

## MODIFIED Requirements

### Requirement: The toolbar makes way on a narrow canvas

The canvas toolbar SHALL sit in the canvas's header row, in flow between the
header's leading control and the pane's actions — Export and Hide the preview —
so the two cannot overlap. The width that decides SHALL be the room the toolbar
has in that row, after the actions and any leading control, not the window's.
With less than 312 pixels Zoom out, Zoom in and Full screen SHALL leave the
toolbar; with less than 224 pixels Zoom to selection and Rulers SHALL leave it
too. Each SHALL keep its shortcut (⌘−, ⌘+, F, ⇧2, ⇧R) and Full screen SHALL keep
its button in the playback panel. Pan, Fit, the zoom readout and Show content
outside the frame SHALL stay at every width the canvas floor allows.

#### Scenario: The default window with the sidebar open

- **WHEN** the preview is shown at the default window size with the sidebar open and the chat at its minimum
- **THEN** Export is not covered and the toolbar shows every button that fits beside it

#### Scenario: A narrow canvas

- **WHEN** the toolbar has less than 224 pixels beside the actions
- **THEN** the toolbar shows Pan, Fit, the zoom readout and Show content outside the frame
- **AND** ⇧2, ⇧R, ⌘−, ⌘+ and F still do what the hidden buttons did

#### Scenario: An export starts

- **WHEN** an export's progress takes Export's place and is wider than Export
- **THEN** the toolbar gives up buttons rather than running under it

#### Scenario: The canvas widens again

- **WHEN** the toolbar's room grows, because the window grew or the inspector folded or collapsed
- **THEN** the buttons that left come back
