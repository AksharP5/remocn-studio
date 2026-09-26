## MODIFIED Requirements

### Requirement: Resolution is the short side and the aspect ratio is never touched

The resolution SHALL be read as the target length of the video's shorter side, so the scale is that target divided by the shorter side and Source is a scale of one. An upscale SHALL be allowed with a warning that pictures and video in the scene are drawn larger than their own pixels. A scale of more than sixteen times the video SHALL be refused, as SHALL an output with a side under two pixels or a video whose size has not been measured yet, and a refusal SHALL disable the dialog's Export button rather than failing at render time.

#### Scenario: Exporting a vertical video at 1080

- **WHEN** a 1080×1920 video is exported at the 1080 resolution
- **THEN** the output is 1080×1920

#### Scenario: Asking for more than the renderer takes

- **WHEN** the chosen resolution would be more than sixteen times the video's own size
- **THEN** the dialog says so, names the limit, and Export is disabled

#### Scenario: No measured size yet

- **WHEN** the preview has not reported the video's size
- **THEN** the dialog reads *The video has no measured size yet.* and Export is disabled

### Requirement: Only a finished export replaces a finished export

The render SHALL write to a hidden partial file beside the target and SHALL rename it onto the target only once the render has finished. A failed or cancelled render SHALL leave no partial behind and SHALL leave an earlier export at the same path untouched. The studio SHALL NOT raise an overwrite prompt; when a file already sits at the target, the dialog SHALL say instead that it is replaced once the render finishes, and SHALL say nothing about replacing when there is none.

#### Scenario: A render that finishes

- **WHEN** the render completes
- **THEN** the partial is renamed onto the target and the folder holds only the finished file

#### Scenario: A render that fails

- **WHEN** the renderer fails mid-render
- **THEN** the failure is reported, no partial file is left in the folder, and any earlier export at that path still has its own bytes

#### Scenario: Exporting over a file that is already there

- **WHEN** the target already holds a finished export
- **THEN** no prompt is raised and the file is replaced only when the new render finishes

#### Scenario: The dialog names a file that is already there

- **WHEN** the dialog is open and a file with the chosen name is already in the chosen folder
- **THEN** the dialog says that file is replaced once the render finishes
- **AND** with no such file, the dialog says nothing about replacing

### Requirement: One export at a time, and cancelling waits for the renderer to stop

A project SHALL run at most one export at a time and SHALL refuse a second with a sentence rather than queueing it. While an export runs, the Export button SHALL become a pill showing the stage and its percentage, with a separate cancel control beside it. Cancelling a render that has run for less than five seconds SHALL happen on the first press; cancelling one that has run longer SHALL first ask, offering to keep exporting or to stop. Cancelling SHALL tell the renderer to stop and SHALL wait up to ten seconds for it to settle before removing the partial. A finished export SHALL NOT block the next one, and a rebuild of the project SHALL NOT cancel a render already running.

#### Scenario: A second export while one runs

- **WHEN** an export is asked for in a project that is already exporting
- **THEN** it is refused with a sentence saying an export is already running and to cancel it first

#### Scenario: Cancelling

- **WHEN** the person presses the cancel control within five seconds of the render starting
- **THEN** the renderer is told to cancel, the partial is removed once it settles, and no error is reported for the cancel

#### Scenario: Cancelling a render that has run a while

- **WHEN** the person presses the cancel control after the render has run for five seconds or more
- **THEN** a small confirmation asks whether to stop the export, and the render keeps running until *Stop* is chosen
- **AND** choosing *Keep exporting* closes the confirmation and leaves the render alone

#### Scenario: Exporting twice in a row

- **WHEN** an export finishes and another is started immediately
- **THEN** the second starts rather than being told one is already running

#### Scenario: The agent saves a file mid-render

- **WHEN** the project is rebuilt while an export is running
- **THEN** the render continues against the bytes it started with and is not cancelled

### Requirement: The run says which stage it is in and how far it has come

The export SHALL report its stages as preparing, rendering and finalizing, and SHALL report progress as frame counts and a percentage. The studio SHALL word those counts as *Rendering — N/M frames*, then *Encoding — N/M frames*, then *Combining the audio and the video* while the audio and video are being joined. The running Export pill SHALL carry the stage's short name and its percentage as text, and the full wording as its tooltip. Anything the studio had to leave out of the render SHALL reach the person as a notice on the running export rather than as a failure; see `export/render-settings-and-browser`. There SHALL be no wall-clock timeout on the render itself.

The same run SHALL be shown on the Dock icon as one progress bar that never moves backwards: indeterminate while the video is measured, a fraction of the whole run while frames render and encode, indeterminate again while the audio and video are combined, gone when the file is written or the render is cancelled, and in the error state for a moment when the render fails. Where the operating system offers no Dock progress the run SHALL be shown in the pane alone.

#### Scenario: Frames rendering

- **WHEN** fewer frames have been rendered than the video has
- **THEN** the status reads that it is rendering, with the rendered count, the total and a percentage
- **AND** the pill reads the stage and the percentage

#### Scenario: Encoding

- **WHEN** every frame has been rendered and encoding is behind
- **THEN** the status moves to encoding with its own count

#### Scenario: Before the frame count is known

- **WHEN** progress arrives before a frame count does
- **THEN** the status reads *Measuring the video…* rather than showing a count against zero

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

### Requirement: Export refuses with the reason on the button

Export SHALL be unavailable, with the reason on the button's tooltip, when no project is open, when the preview is showing a different project than the open chat, when another project is exporting, when the preview is not serving, when there is no video to export, or when the composer is holding element changes that are not in the code yet.

#### Scenario: The preview shows another project

- **WHEN** the preview's project is not the open chat's project
- **THEN** Export is disabled and reads *The preview is showing another project, not the one this chat belongs to.*

#### Scenario: The preview is not running

- **WHEN** the preview is not serving
- **THEN** Export is disabled and says the preview has to be running before it can be exported

#### Scenario: Unsent element changes

- **WHEN** the composer holds chips carrying tuned values or code the studio will write at Send
- **THEN** Export is disabled and names how many element changes are being held, saying to send the message or take the chip off so the export matches what is on screen

#### Scenario: Another project is exporting

- **WHEN** a different project's export is running
- **THEN** Export is disabled and says only one export runs at a time

### Requirement: The result belongs to the video it was rendered from

The running, finished or failed state of an export SHALL be held against the project and the video it belongs to. Looking at another project or another video SHALL hide it, and coming back SHALL show it again, a render still running included. A finished export SHALL be shown as its path, size and file size with a button that reveals it in the file manager and a button that dismisses it, SHALL leave on its own fifteen seconds after it appeared, and SHALL NOT pull the file manager over the screen on its own. A failed export SHALL be shown as a worded sentence, with the renderer's own text behind a Details disclosure that can be copied, a Try again that renders again with the same settings to the same file, and a Dismiss. Result rows SHALL fade in and out rather than appear and vanish.

#### Scenario: Looking away while a render runs

- **WHEN** the person opens another video's chat while an export runs and then comes back
- **THEN** the running export and its progress are shown again

#### Scenario: A finished file

- **WHEN** an export finishes
- **THEN** the pane shows the path relative to the project, the output size and the file size, with a button that reveals it in the file manager and a button that dismisses it

#### Scenario: The finished row is left alone

- **WHEN** fifteen seconds pass after an export finished and nobody dismissed it
- **THEN** the row fades out on its own

#### Scenario: Another project's result

- **WHEN** a different project is open
- **THEN** that project's export result is not shown against this one

#### Scenario: The render failed

- **WHEN** the render failed
- **THEN** the failure is shown as a sentence under the preview, kept wrapping and scrollable so a long message cannot run off the pane
- **AND** the renderer's raw text sits behind Details with Copy details, and Try again and Dismiss are offered

#### Scenario: Trying again

- **WHEN** the person presses Try again on a failed export
- **THEN** the render starts again with the settings and the file it failed with, and the failure row is replaced by the running pill
