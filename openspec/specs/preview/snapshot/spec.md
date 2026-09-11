# preview/snapshot Specification

## Purpose
Snapshot answers *look at this*: it turns the frame on screen, or a rectangle of it, into a picture the agent can see, rendered at full resolution by the project's own renderer and dropped into the composer as an ordinary image attachment.

## Requirements

### Requirement: Arming pauses the preview, warms the render page and acknowledges

Arming Snapshot SHALL pause the preview, put a crosshair over the frame, and begin measuring the video for rendering before any capture is asked for. The page SHALL answer every arm and disarm with a status, and the pane SHALL say so when the answer is anything but a clean arm, including when no answer arrives at all within a short patience. Snapshot and Inspect SHALL be mutually exclusive: arming one disarms the other, and Escape disarms whichever is on.

#### Scenario: Snapshot is armed

- **WHEN** the Snapshot button is pressed while it is available
- **THEN** the preview pauses, the frame takes a crosshair, and the button reads as pressed
- **AND** the composition is measured in the background so a capture does not wait for it

#### Scenario: The player is not on screen

- **WHEN** the page answers that it has no player canvas
- **THEN** the pane reads *The player is not on screen yet, so there is nothing to capture.*

#### Scenario: The page is from an older build

- **WHEN** the page does not answer the arm within the patience window
- **THEN** the pane reads that Snapshot is on but the preview never answered, and suggests restarting the preview

#### Scenario: The player will not pause

- **WHEN** the page arms but reports that it held no player to pause
- **THEN** the pane says the preview answered but its player did not

#### Scenario: Inspect is armed while Snapshot is on

- **WHEN** Inspect is armed
- **THEN** Snapshot is disarmed, and only one of the two is ever active

### Requirement: A click captures the whole frame and a drag captures a region

While armed, a press inside the frame SHALL begin a marquee drawn inside the preview page, and releasing SHALL request a capture. A release that never moved more than a few pixels from where it went down SHALL be treated as a click and SHALL capture the whole frame. A real drag SHALL capture the rectangle it described, expressed as a share of the composition rather than of the window, so the same drag crops the same region whatever size the pane is. Escape during a drag SHALL abandon it.

#### Scenario: A click on the frame

- **WHEN** the pointer goes down and up on the frame without moving appreciably
- **THEN** the whole frame is captured

#### Scenario: A rectangle is dragged

- **WHEN** the pointer is dragged across part of the frame and released
- **THEN** that region is captured, read as a share of the composition's own width and height
- **AND** the same region is captured whichever corner the drag started from, and whatever the pane's size

#### Scenario: The drag runs off the frame

- **WHEN** a drag leaves the frame's box
- **THEN** the rectangle is clamped to the frame
- **AND** a drag that never entered the frame captures nothing

#### Scenario: Escape during a drag

- **WHEN** Escape is pressed while a rectangle is being dragged
- **THEN** the marquee is dropped and no capture is requested

### Requirement: The still comes from the project's own renderer

A capture SHALL be rendered by the Project's own installed renderer, against the same compiled bundle the pane is playing, on a page that declares itself to be rendering rather than previewing. It SHALL be rendered at the composition's full resolution. The render settings SHALL be the Project's own, read from its Remotion config, and the browser and its graphics backend SHALL be the one policy every renderer-backed operation uses, which is specified by the `export/render-settings-and-browser` capability.

#### Scenario: A frame is captured

- **WHEN** a capture is requested for a frame of the open Video
- **THEN** the frame is rendered by the project's renderer from the bundle already compiled for the pane
- **AND** no second bundle is built

#### Scenario: The project sets its own render options

- **WHEN** the Project's Remotion config sets a graphics backend, a delay timeout or a browser mode
- **THEN** the capture honours them rather than substituting the studio's own

#### Scenario: The preview is not running for that project

- **WHEN** a capture is asked for a Project with no preview host
- **THEN** it fails with a sentence saying the preview is not running for this project, rather than hanging

### Requirement: A capture answers at the speed of a click

Once the render page for a video has been warmed, a capture SHALL reuse it rather than opening and navigating a page of its own. The warmed page SHALL be dropped whenever the bundle is rebuilt, and the measured composition forgotten with it, so a capture can never be taken against code that no longer exists. A Remotion that does not expose what a warm page needs SHALL fall back to rendering a page per capture, which still answers.

#### Scenario: A second capture of the same video

- **WHEN** a capture follows an earlier one of the same video with no rebuild between them
- **THEN** it is taken on the page that is already open, without navigating

#### Scenario: The project is rebuilt

- **WHEN** the bundle recompiles
- **THEN** the warm page is closed and the measurement forgotten
- **AND** Snapshot is disarmed, so re-arming warms again against the new bundle

#### Scenario: The installed Remotion cannot be warmed

- **WHEN** the pieces a warm page needs cannot be resolved from the project
- **THEN** each capture renders through the ordinary per-capture path and still answers

### Requirement: The picture is cropped in the webview and becomes an image attachment

The host SHALL render a full frame to a file and answer with its path and the composition's dimensions. The webview SHALL read that file, crop it to the requested region and scale the result so its long edge is at most 1568 pixels, cropping before scaling so a small region keeps its detail. The result SHALL be stored the way a pasted picture is and SHALL land in the composer as an ordinary image attachment with an `[Image #N]` reference written at the caret, which is specified by the `composer/references` capability. No image library SHALL be involved outside the webview.

#### Scenario: A small region of a large frame

- **WHEN** a small rectangle of a 4K frame is captured
- **THEN** the frame is cropped to that rectangle first and only then scaled
- **AND** the stored picture's long edge is at most 1568 pixels

#### Scenario: A frame already small enough

- **WHEN** the cropped region's long edge is already within the limit
- **THEN** it is stored at its own size rather than being scaled up

#### Scenario: The rendered frame cannot be read back

- **WHEN** the rendered file cannot be reached from the window, or the canvas refuses to hand the bytes back
- **THEN** the pane says so as a sentence and nothing is attached

#### Scenario: Two snapshots in one message

- **WHEN** two captures are made before the message is sent
- **THEN** each is named after its composition and frame, and they do not collide

### Requirement: One capture at a time, and each sweeps the stills folder

A second capture SHALL be refused while one is in flight, and the Snapshot button SHALL show that a capture is running. Every capture SHALL clear the folder the studio keeps its rendered stills in before writing a uniquely named file into it, so the folder never grows. The attachment the composer keeps is a separate, permanent file, so past turns keep their pictures.

#### Scenario: A second click while a capture is running

- **WHEN** the frame is clicked again before the previous capture has answered
- **THEN** the second click is ignored
- **AND** the button shows a spinner for the capture in flight

#### Scenario: A capture is taken

- **WHEN** a still is rendered
- **THEN** the previous contents of the stills folder are removed first
- **AND** the new file is given a name nothing else in the folder can collide with

### Requirement: Rendering a frame reports its progress and words its failures

While a capture runs, the pane SHALL say what it is doing: downloading the renderer's browser with its percentage when that has to happen, and rendering the frame at full resolution otherwise. A failure SHALL reach the pane as a sentence with a reading appended when the studio can classify it, and never as a raw renderer message alone.

#### Scenario: The renderer's browser is not installed yet

- **WHEN** the renderer has to download its browser before the first capture
- **THEN** the pane reads *Downloading the renderer's browser* with its percentage

#### Scenario: A scene that never finishes

- **WHEN** nothing in the scene resolves its render delay within the project's own timeout
- **THEN** the failure says that nothing in the scene resolved its render delay in time
- **AND** a reading is appended naming the likely causes, and pointing at the graphics backend when the render browser could make no WebGL context at all

#### Scenario: A file the scene asked for did not arrive

- **WHEN** the failure names a missing or unreachable asset
- **THEN** the reading says a file the scene asked for did not arrive and where to look for it

### Requirement: Snapshot is offered only when it can work, and says why not

The Snapshot button SHALL carry the reason it is unavailable on its tooltip rather than being silently dead, and SHALL remain focusable so that reason can be read. It SHALL be unavailable while the plan is Free, while the preview pane is hidden, while the pane is showing documents, with no Project open, with the Project's folder missing, while a permission card is waiting to be answered, while the preview is not yet serving, and when the preview is showing a different Project from the open chat's.

#### Scenario: The plan is Free

- **WHEN** Snapshot is pressed on the Free plan
- **THEN** nothing is armed
- **AND** the trial invitation is brought back, and the tooltip says Inspect and Snapshot are part of Pro

#### Scenario: The preview has not compiled yet

- **WHEN** the preview is still building
- **THEN** the tooltip reads *The preview is not running yet.*

#### Scenario: A permission card is waiting

- **WHEN** a turn is waiting on a permission card
- **THEN** the tooltip reads *Answer the approval request first.*

#### Scenario: The pane is showing documents

- **WHEN** the pane's mode is Docs
- **THEN** the Snapshot button is not in the header at all, and anything armed is disarmed

### Requirement: The same still machinery serves the studio's own pictures

The still rendering Snapshot uses SHALL also be what the studio renders a frame with when it needs one of its own — a preview picture for an asset saved to the library, and the frames a design check looks at. Those uses SHALL take the composition and frame the pane says are on screen. A picture that cannot be rendered SHALL never fail the thing that asked for it. The library's own use of this is specified by the `library/asset-library` capability and the design check's by the `agent/design-check` capability.

#### Scenario: A component is saved to the library

- **WHEN** the agent saves a component and a preview picture is rendered for it
- **THEN** the frame is rendered through the same path a Snapshot takes
- **AND** a render that fails leaves the asset saved with no picture rather than failing the save
