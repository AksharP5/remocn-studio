## MODIFIED Requirements

### Requirement: Playback controls sit below the frame

The preview SHALL use a persistent playback panel fixed at the bottom of the canvas, outside the video content, with a seek bar, Play/Pause, previous and next frame actions, elapsed and total time, a mute control and a full-screen button. Wider panels SHALL also show a volume slider. The embedded player's controls, click-to-play and double-click-to-fullscreen SHALL be disabled so playback interactions do not intercept editing gestures on the frame. Explicit Fit SHALL use the resolved dimensions and leave room for the playback and inspector overlays. The video SHALL otherwise retain the user’s camera.

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

- **WHEN** a video is ready and the person presses the panel's full-screen button
- **THEN** the video and the panel open in the full-screen view of the canvas
- **AND** the same button, now Exit full screen, closes it
- **AND** a window that cannot enter full screen is described in the panel

#### Scenario: Playback reports an error

- **WHEN** the player reports a playback error
- **THEN** the panel shows a readable failure message without moving the frame
