## MODIFIED Requirements

### Requirement: The run says which stage it is in and how far it has come

The export SHALL report its stages as preparing, rendering and finalizing, and SHALL report progress as frame counts and a percentage. The studio SHALL word those counts as *Rendering — N/M frames*, then *Encoding — N/M frames*, then *Combining the audio and the video* while the audio and video are being joined. Anything the studio had to leave out of the render SHALL reach the person as a notice on the running export rather than as a failure; see `export/render-settings-and-browser`. There SHALL be no wall-clock timeout on the render itself.

The same run SHALL be shown on the Dock icon as one progress bar that never moves backwards: indeterminate while the composition is measured, a fraction of the whole run while frames render and encode, indeterminate again while the audio and video are combined, gone when the file is written or the render is cancelled, and in the error state for a moment when the render fails. Where the operating system offers no Dock progress the run SHALL be shown in the pane alone.

#### Scenario: Frames rendering

- **WHEN** fewer frames have been rendered than the composition has
- **THEN** the status reads that it is rendering, with the rendered count, the total and a percentage

#### Scenario: Encoding

- **WHEN** every frame has been rendered and encoding is behind
- **THEN** the status moves to encoding with its own count

#### Scenario: Before the frame count is known

- **WHEN** progress arrives before a frame count does
- **THEN** the status reads *Measuring the composition…* rather than showing a count against zero

#### Scenario: A long render

- **WHEN** a render takes many minutes
- **THEN** the studio does not time it out; only the project's own frame timeout bounds a frame that never resolves

#### Scenario: The Dock during a render

- **WHEN** half the frames are rendered and none encoded
- **THEN** the Dock bar sits at a quarter of the whole run, and it does not fall back when encoding starts its own count

#### Scenario: The Dock when the render fails

- **WHEN** the render fails
- **THEN** the Dock bar turns to its error state, and is gone a few seconds later while the failure's text stays in the pane

#### Scenario: The Dock when the file is written

- **WHEN** the export finishes or is cancelled
- **THEN** the Dock bar is gone
