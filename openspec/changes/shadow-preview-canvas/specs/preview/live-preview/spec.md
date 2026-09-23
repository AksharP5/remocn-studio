## MODIFIED Requirements

### Requirement: Playback controls sit below the frame

The preview SHALL use a persistent playback panel fixed at the bottom of the canvas, outside the video content, with a seek bar, Play/Pause, previous and next frame actions, elapsed and total time, and a mute control. Wider panels SHALL also show a volume slider. The embedded player's controls, click-to-play and double-click-to-fullscreen SHALL be disabled so playback interactions do not intercept editing gestures on the frame. Explicit Fit SHALL use the resolved dimensions and leave room for the playback and inspector overlays. The video SHALL otherwise retain the user’s camera.

#### Scenario: Playback is controlled from the panel

- **WHEN** Play or Pause is pressed
- **THEN** the existing preview player changes its playback state
- **AND** the panel follows the player's reported frame, playback, buffering and sound state

#### Scenario: A precise frame is chosen

- **WHEN** the seek bar or a frame-step action is used
- **THEN** playback pauses and seeks to a whole frame within the video's bounds
- **AND** the action does not clear the selected object

#### Scenario: Playback shortcuts are used

- **WHEN** the preview has focus outside text inputs and other interactive controls
- **THEN** K toggles playback; Space is reserved for canvas navigation and Left/Right move one frame
- **AND** those shortcuts do not intercept input elsewhere in the app

#### Scenario: The player is not ready

- **WHEN** no video is ready to receive playback commands
- **THEN** the playback panel keeps its space and disables its controls
- **AND** the time display shows placeholders

#### Scenario: Fullscreen is available

- **WHEN** fullscreen is supported and the person enters it
- **THEN** the frame and its playback panel enter fullscreen together
- **AND** a failed fullscreen request is described in the panel

#### Scenario: Playback reports an error

- **WHEN** the player reports a playback error
- **THEN** the panel shows a readable failure message without moving the frame

### Requirement: A rebuild reaches the pane

When the project's files change and the host recompiles, the native surface SHALL prepare the new runtime out of sight beside the one on screen and swap to it only once it has drawn its first frame, preserving camera, frame, playback state and sound. The canvas SHALL NOT show a loading screen or an empty frame for a rebuild once a version has been shown. When the new version cannot be shown, the previous one SHALL stay on screen with a notice. Compile progress arriving after the first compile has settled SHALL NOT replace a playing preview with a progress screen.

#### Scenario: The agent writes to the project

- **WHEN** a turn edits a file the bundle includes and the host recompiles it
- **THEN** the current version keeps playing while the new runtime loads hidden
- **AND** the canvas swaps to the new runtime at the same frame, playback state and sound once it has drawn, without reloading the app window
- **AND** the studio is told the preview was rebuilt when the swap happens

#### Scenario: Rebuilds arrive faster than a version can draw

- **WHEN** another rebuild is announced while a new runtime is still loading
- **THEN** the loading runtime is discarded and only the latest one is prepared

#### Scenario: A new version cannot be shown

- **WHEN** the new runtime fails to load, throws while rendering, or has not drawn within 30 seconds
- **THEN** the previous version stays on screen and remains playable and editable
- **AND** a notice says the latest change could not be shown
- **AND** the next version that draws replaces it and clears the notice

#### Scenario: Progress after the preview is already serving

- **WHEN** the compiler reports progress once the preview has been served
- **THEN** the pane keeps playing
- **AND** the progress screen is not shown again

#### Scenario: A rebuild fails

- **WHEN** a recompile fails
- **THEN** the pane shows a readable native compilation failure with recovery actions
- **AND** the failure is remembered, so a render pinned to the bundle refuses rather than rendering from a broken one

