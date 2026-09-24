## MODIFIED Requirements

### Requirement: The preview's header switches between Preview and Docs

The preview pane's header SHALL NOT carry a Preview / Docs switch while the pane shows the preview. Docs SHALL be opened with ⌘D, the View menu, the command palette or a stage row, and while the pane is in Docs its header SHALL carry a Preview button in place of a title that returns to the preview. The choice and the open document SHALL be kept per video for as long as the app runs and SHALL NOT be written to disk, so moving to another video and back lands on the tab that was open and a relaunch starts on the preview.

#### Scenario: Reading a document and coming back

- **WHEN** the person opens Docs on one video, moves to another video, and returns
- **THEN** the first video is still in Docs, on the document that was open
- **AND** the second video is on its own choice

#### Scenario: Relaunching

- **WHEN** the app is relaunched
- **THEN** every video starts on the preview

#### Scenario: Docs is open

- **WHEN** the pane is in Docs
- **THEN** Inspect and Snapshot leave the header
- **AND** Export stays
- **AND** a Preview button returns the pane to the preview

#### Scenario: The preview is shown

- **WHEN** the pane shows the preview
- **THEN** its header carries no Preview / Docs switch
- **AND** ⌘D still opens Docs
