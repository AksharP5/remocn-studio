# export/mp4-export Specification

## Purpose
Turning the video on screen into a file on disk: the Export dialog where the format, the size, the quality and the destination are decided, and the render job behind it, which uses the project's own renderer against a copy of the compiled project that nothing can change while it runs.

## Requirements

### Requirement: Export is one dialog, and the file it will write is in it

The Export button in the preview's header SHALL open a dialog carrying a preset, a format, a resolution, a quality, a file name and a folder, and the dialog's own Export button SHALL start the render. The dialog SHALL show the size, the container and the length the export will produce, and SHALL NOT hand the decision to a system save panel.

#### Scenario: Opening the dialog

- **WHEN** the person presses Export in the preview's header
- **THEN** the dialog opens with the settings last used in this project, or the studio's defaults when the project has none
- **AND** the file name and the folder the render will write to are on screen before anything is pressed

#### Scenario: Reading what will be produced

- **WHEN** the dialog is open
- **THEN** it states the real output size, the container name and the video's length

#### Scenario: Starting the render

- **WHEN** the person presses Export inside the dialog
- **THEN** the dialog closes, the settings and the folder are remembered for this project, and the render starts against the file named in the dialog

### Requirement: A preset fills three settings and never changes the video's shape

The studio SHALL offer the presets Custom, YouTube, Shorts · Reels · TikTok and Instagram Feed. A named preset SHALL set format, resolution and quality only, all three to H.264, a 1080 short side and High. Changing any of those three by hand SHALL move the preset to Custom, unless the change left every setting where it was. A preset whose expected shape does not match the video SHALL warn and change nothing.

#### Scenario: Picking a preset

- **WHEN** YouTube, Shorts · Reels · TikTok or Instagram Feed is picked
- **THEN** the format becomes H.264, the resolution the 1080 short side and the quality High

#### Scenario: Editing a setting a preset filled

- **WHEN** the format, resolution or quality is changed while a preset is picked
- **THEN** the preset becomes Custom and the changed setting stands

#### Scenario: A preset that does not match the video's shape

- **WHEN** Shorts · Reels · TikTok is picked for a 16:9 video
- **THEN** the dialog warns that the preset expects 9:16 while this video is 16:9, and says the export keeps the video's own shape
- **AND** neither the resolution nor the aspect ratio of the export is altered

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
- **THEN** the dialog reads *The composition has no measured size yet.* and Export is disabled

### Requirement: Quality is per codec, and the project's own settings are the default

The quality choice SHALL be Project default, Draft, Standard or High. For H.264 and VP9 it SHALL become a constant rate factor on that codec's own scale; for ProRes a profile; for a GIF there SHALL be no quality control at all. Project default SHALL send no quality of the studio's own, so the project's own configured setting reaches the renderer unchanged.

#### Scenario: Choosing a quality for a codec that has one

- **WHEN** Draft, Standard or High is chosen for H.264 or VP9
- **THEN** the render carries the rate factor for that codec and that quality, and no profile

#### Scenario: Choosing a quality for ProRes

- **WHEN** Draft, Standard or High is chosen for MOV · ProRes
- **THEN** the render carries the matching ProRes profile and no rate factor

#### Scenario: Leaving it to the project

- **WHEN** Project default is chosen
- **THEN** the render carries neither a rate factor nor a profile of the studio's own

#### Scenario: A GIF

- **WHEN** the GIF format is chosen
- **THEN** the dialog offers no quality control and warns that a GIF carries no audio

### Requirement: The output size is the size the renderer will really write

For the one format that needs even dimensions the studio SHALL shrink each side until the scaled side is even, and SHALL leave the other formats' dimensions alone. When a side is trimmed the dialog SHALL say so and name the trimmed size, and the size reported when the export finishes SHALL be the same size the dialog promised.

#### Scenario: An odd frame in a format that needs even sides

- **WHEN** a 1921×1081 video is exported as MP4 · H.264 at Source
- **THEN** the output is 1920×1080 and the dialog says the frame is trimmed to that size

#### Scenario: The same frame in a format that does not

- **WHEN** the same 1921×1081 video is exported as WebM · VP9
- **THEN** the output keeps 1921×1081 and nothing is trimmed

#### Scenario: The finished file

- **WHEN** an export finishes
- **THEN** the width and height it reports are the ones the dialog showed

### Requirement: The destination is a name and a folder the person can read

The file name SHALL follow the preset and the format until the person types one, after which the typed stem SHALL stand and only the ending SHALL keep following the format. A typed name SHALL have any path separator replaced with a hyphen, so a file cannot land somewhere the dialog is not showing. The folder SHALL default to the project's own `out` folder, SHALL read as a relative path while it is inside the project, and SHALL collapse the home directory to `~` when it is outside it. The four settings and the folder SHALL be remembered per project, under an `export:<projectId>` key in the studio's settings.

#### Scenario: Before anything is typed

- **WHEN** the dialog opens for a video with no export yet
- **THEN** the name is the video's name with the format's ending, and the folder reads `out`

#### Scenario: Picking a preset after opening

- **WHEN** a named preset is picked and nothing has been typed
- **THEN** the file name gains the preset's name and keeps following the format

#### Scenario: Typing a name

- **WHEN** the person types a name and then changes the format
- **THEN** the typed stem is kept and only the ending changes

#### Scenario: Typing a separator

- **WHEN** the typed name contains `/` or `\`
- **THEN** each separator becomes a hyphen and the file stays in the folder on screen

### Requirement: Only a finished export replaces a finished export

The render SHALL write to a hidden partial file beside the target and SHALL rename it onto the target only once the render has finished. A failed or cancelled render SHALL leave no partial behind and SHALL leave an earlier export at the same path untouched. The studio SHALL NOT raise an overwrite prompt; the dialog SHALL say instead that exporting again replaces the file at that location.

#### Scenario: A render that finishes

- **WHEN** the render completes
- **THEN** the partial is renamed onto the target and the folder holds only the finished file

#### Scenario: A render that fails

- **WHEN** the renderer fails mid-render
- **THEN** the failure is reported, no partial file is left in the folder, and any earlier export at that path still has its own bytes

#### Scenario: Exporting over a file that is already there

- **WHEN** the target already holds a finished export
- **THEN** no prompt is raised and the file is replaced only when the new render finishes

### Requirement: One export at a time, and cancelling waits for the renderer to stop

A project SHALL run at most one export at a time and SHALL refuse a second with a sentence rather than queueing it. Cancelling SHALL tell the renderer to stop and SHALL wait up to ten seconds for it to settle before removing the partial. A finished export SHALL NOT block the next one, and a rebuild of the project SHALL NOT cancel a render already running.

#### Scenario: A second export while one runs

- **WHEN** an export is asked for in a project that is already exporting
- **THEN** it is refused with a sentence saying an export is already running and to cancel it first

#### Scenario: Cancelling

- **WHEN** the person presses the running Export button, which is the cancel control
- **THEN** the renderer is told to cancel, the partial is removed once it settles, and no error is reported for the cancel

#### Scenario: Exporting twice in a row

- **WHEN** an export finishes and another is started immediately
- **THEN** the second starts rather than being told one is already running

#### Scenario: The agent saves a file mid-render

- **WHEN** the project is rebuilt while an export is running
- **THEN** the render continues against the bytes it started with and is not cancelled

### Requirement: A render is pinned to a copy nothing can change

An export SHALL render from the bundle the preview already compiled and SHALL NOT compile a second one. It SHALL wait for a compile that has actually settled and SHALL fail with the compiler's own errors when the project does not compile. It SHALL then take its own copy of the compiled bundle and of the project's `public` folder, measure and render against that copy, and remove the copy when the job ends however it ends. A copy an earlier crash left behind SHALL be swept before a new job starts.

#### Scenario: A project that does not compile

- **WHEN** an export is started while the project has compile errors
- **THEN** it fails saying the project does not compile, with the compiler's own errors below that sentence

#### Scenario: The project changes under a running render

- **WHEN** a file the bundle was built from is overwritten while the render runs
- **THEN** the render keeps reading the copy it pinned and the finished file is not affected

#### Scenario: A video that computes its own metadata

- **WHEN** a video computes its size or duration rather than declaring them
- **THEN** the dialog forecasts the values the preview resolved and the export measures and renders at the same ones

#### Scenario: The job ends

- **WHEN** the export finishes, fails or is cancelled
- **THEN** the copy is removed and the job is no longer served

### Requirement: The run says which stage it is in and how far it has come

The export SHALL report its stages as preparing, rendering and finalizing, and SHALL report progress as frame counts and a percentage. The studio SHALL word those counts as *Rendering — N/M frames*, then *Encoding — N/M frames*, then *Combining the audio and the video* while the audio and video are being joined. Anything the studio had to leave out of the render SHALL reach the person as a notice on the running export rather than as a failure; see `export/render-settings-and-browser`. There SHALL be no wall-clock timeout on the render itself.

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

### Requirement: Export refuses with the reason on the button

Export SHALL be unavailable, with the reason on the button's tooltip, when no project is open, when the preview is showing a different project than the open chat, when another project is exporting, when the preview is not serving, when there is no composition to export, or when the composer is holding element changes that are not in the code yet.

#### Scenario: The preview shows another project

- **WHEN** the preview's project is not the open chat's project
- **THEN** Export is disabled and reads *The preview is showing a different project than this session.*

#### Scenario: The preview is not running

- **WHEN** the preview is not serving
- **THEN** Export is disabled and says the preview has to be running before it can be exported

#### Scenario: Unsent element changes

- **WHEN** the composer holds chips carrying tuned values or code the studio will write at Send
- **THEN** Export is disabled and names how many element changes are being held, saying to send the message or take the chip off so the export matches what is on screen

#### Scenario: Another project is exporting

- **WHEN** a different project's export is running
- **THEN** Export is disabled and says only one export runs at a time

### Requirement: A renderer that cannot do the job is refused by name

Before pinning anything an export SHALL check that the project's `remotion` package and its render packages are the same version, and SHALL refuse naming every package that drifted and the command that brings them back in step. A project whose renderer is too old to encode a video SHALL be refused with a sentence saying so rather than failing inside the render.

#### Scenario: Packages that disagree

- **WHEN** the project's renderer or bundler is a different version than its `remotion`
- **THEN** the export refuses, names each package and the version it is at, and names the install command for the project's own package manager

#### Scenario: A renderer too old to export

- **WHEN** the project's renderer exposes no way to encode a video
- **THEN** the export refuses saying there is nothing there that can encode a video and to upgrade Remotion in the project folder

### Requirement: A filename ending the renderer would refuse is corrected and said out loud

When the chosen file name does not end in one of the endings the renderer accepts for the chosen format, the studio SHALL append the format's own ending rather than replacing what was typed, and SHALL tell the person it did, naming the file it saved as and why. An ending the renderer does accept for that format SHALL be left alone, and a dot in a folder name SHALL NOT be read as an ending.

#### Scenario: A name the renderer would not take

- **WHEN** an MP4 is exported to a file ending `.txt`
- **THEN** the file is written as that name with `.mp4` appended, and a notice names the file it was saved as and the endings the renderer accepts for that format

#### Scenario: Another ending the renderer takes for that codec

- **WHEN** an MP4 export is named with a `.mkv` or `.mov` ending
- **THEN** the name is left exactly as it is and nothing is said

#### Scenario: A dot in the folder

- **WHEN** the file has no ending but a folder above it does
- **THEN** the format's ending is appended to the file name and the folder is untouched

### Requirement: The result belongs to the video it was rendered from

The running, finished or failed state of an export SHALL be held against the project and the video it belongs to. Looking at another project or another video SHALL hide it, and coming back SHALL show it again, a render still running included. A finished export SHALL be shown as its path, size and file size with a button that reveals it in the file manager, and SHALL NOT pull the file manager over the screen on its own.

#### Scenario: Looking away while a render runs

- **WHEN** the person opens another video's chat while an export runs and then comes back
- **THEN** the running export and its progress are shown again

#### Scenario: A finished file

- **WHEN** an export finishes
- **THEN** the pane shows the path relative to the project, the output size and the file size, with a button that reveals it in the file manager

#### Scenario: Another project's result

- **WHEN** a different project is open
- **THEN** that project's export result is not shown against this one

#### Scenario: The render failed

- **WHEN** the render failed
- **THEN** the failure's text is shown under the preview, kept wrapping and scrollable so a long message cannot run off the pane
