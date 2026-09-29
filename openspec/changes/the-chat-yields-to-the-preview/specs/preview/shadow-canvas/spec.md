## ADDED Requirements

### Requirement: The toolbar makes way on a narrow canvas

The canvas toolbar shares its row with the pane's actions — Export and Hide the
preview — and the two SHALL NOT overlap. The width that decides is the canvas's
own, between the left ruler and the inspector, not the window's. Below 480 pixels
Zoom out, Zoom in and Full screen SHALL leave the toolbar; below 400 pixels Zoom
to selection and Rulers SHALL leave it too. Each SHALL keep its shortcut (⌘−, ⌘+,
F, ⇧2, ⇧R) and Full screen SHALL keep its button in the playback panel. Pan, Fit,
the zoom readout and Show content outside the frame SHALL stay at every width.

#### Scenario: The default window with the sidebar open

- **WHEN** the preview is shown at the default window size with the sidebar open and the chat at its minimum
- **THEN** the toolbar shows Pan, Fit, Zoom to selection, the zoom readout, Show content outside the frame and Rulers
- **AND** Export is not covered

#### Scenario: A canvas narrower still

- **WHEN** the canvas is narrower than 400 pixels
- **THEN** the toolbar shows Pan, Fit, the zoom readout and Show content outside the frame
- **AND** ⇧2, ⇧R, ⌘−, ⌘+ and F still do what the hidden buttons did

#### Scenario: The canvas widens again

- **WHEN** the canvas becomes wider, because the window grew or the inspector was collapsed
- **THEN** the buttons that left come back
