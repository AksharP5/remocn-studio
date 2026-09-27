## ADDED Requirements

### Requirement: The video can be watched full screen

A toolbar action, the playback panel's full-screen button and F with focus on the
canvas and not in a text field or a text edit SHALL open a full-screen view of the
video once it is ready. The webview SHALL own the view; it SHALL ask the Rust core
to put the window in macOS full screen when the window is not already there. The
view SHALL show the video fitted inside the whole screen and centred on black,
enlarged beyond 100% when the screen is larger than the video, with nothing drawn
outside the frame, and SHALL hide the toolbar, inspector, rulers, selection
outlines and status hints. Selecting, editing, panning and zooming SHALL do
nothing in the view.

The playback panel SHALL stay available, centred at the bottom. While the video
plays and the pointer rests, the panel and the pointer SHALL fade out after about
two and a half seconds; moving the pointer, pressing a key or pausing SHALL bring
them back, and the panel SHALL stay while the pointer is over it. Space and K SHALL
play or pause, Left and Right SHALL step one frame, and a click on the video SHALL
play or pause.

Esc, F or the panel's button SHALL close the view, return the canvas camera to the
view it had before, and take the window out of full screen only if the view put it
there. Leaving macOS full screen by other means while the view is open SHALL close
the view. Playback position, playing state, speed and volume SHALL carry over in
both directions, and the video SHALL NOT be reloaded to enter or leave the view.
The camera used in the view SHALL NOT be remembered as the video's camera.

#### Scenario: Watching the video

- **WHEN** the person presses F with the canvas focused while the video plays
- **THEN** the window enters full screen and the video fills it on black, fitted and centred
- **AND** playback continues from the same frame without reloading

#### Scenario: The controls step aside

- **WHEN** the video plays in the view and the pointer has not moved for about two and a half seconds
- **THEN** the playback panel and the pointer fade out
- **AND** moving the pointer brings them back

#### Scenario: Leaving with Esc

- **WHEN** the person presses Esc in the view at 400% zoom on the canvas before
- **THEN** the window leaves full screen and the canvas is back at 400% on the same spot
- **AND** the frame and play state are the ones the view had

#### Scenario: The window was already full screen

- **WHEN** the window is in macOS full screen before the view opens, and the person leaves the view
- **THEN** the window stays in full screen and shows the canvas again

#### Scenario: Leaving full screen from the window

- **WHEN** the person leaves macOS full screen with the green button or the menu while the view is open
- **THEN** the view closes and the canvas camera is restored

#### Scenario: Nothing can be edited in the view

- **WHEN** the person clicks, double-clicks, drags or scrolls over the video in the view
- **THEN** no element is selected or edited and the view does not pan or zoom
- **AND** a click plays or pauses the video

#### Scenario: Typing is not a shortcut

- **WHEN** focus is in a text field or a text edit on the canvas and F is pressed
- **THEN** the F is typed and the view does not open

#### Scenario: The window cannot enter full screen

- **WHEN** the core refuses or fails to put the window in full screen
- **THEN** the view fills the window instead
- **AND** the playback panel says full screen is unavailable and the video fills the window

#### Scenario: No video is ready

- **WHEN** the preview is building, has failed or has no video
- **THEN** the toolbar action and the panel's button are disabled and F does nothing
