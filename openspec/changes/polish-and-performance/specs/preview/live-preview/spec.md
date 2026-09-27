## MODIFIED Requirements

### Requirement: The pane never prints a protocol token or a raw renderer message

Anything the pane shows about a failed preview or a failed frame SHALL be a sentence. The reply the sidecar sends when a request is cut short SHALL be worded as the preview having stopped when the studio's helper restarted. A renderer's own advice that does not apply to a desktop app SHALL be dropped, and a failure carrying a long encoded asset URL SHALL name the file instead of printing the URL. Text the studio cannot word SHALL sit behind a Details disclosure with Copy details rather than stand in for the sentence.

#### Scenario: The sidecar dies mid-request

- **WHEN** the preview's request is answered with the cancellation reply
- **THEN** the pane reads *The preview stopped when the studio's helper restarted.*
- **AND** the protocol token itself never appears on screen

#### Scenario: A frame fails on a video that would not load

- **WHEN** the renderer reports a failed fetch of a video with its encoded proxy URL and its stock advice about low disk space
- **THEN** the pane reads that the frame could not be rendered because that video would not load, naming the file
- **AND** the disk-space advice is not shown

#### Scenario: A failure the studio has nothing to say about

- **WHEN** the renderer's message matches none of the known shapes
- **THEN** its first line is shown when it reads as a sentence, and otherwise the pane's own sentence is shown
- **AND** the full text is under Details, wrapped and scrollable rather than clipped

## ADDED Requirements

### Requirement: Building shows a bar, and the frame fades in

While the project compiles, the canvas SHALL show a floating card with a spinner, the wording of the stage and a progress bar: indeterminate until the compiler reports a percentage, then filled to it. The card SHALL fade in and out, and the video's frame SHALL fade in when it is first ready rather than appear in one frame. The inspector's heading SHALL name the video by the name the person gave it, never by its code identifier.

#### Scenario: The compiler has not reported yet

- **WHEN** the project is building and no percentage has arrived
- **THEN** the card reads *Starting the compiler…* over an indeterminate bar

#### Scenario: The compiler reports progress

- **WHEN** the compiler reports 42%
- **THEN** the card reads *Building the project — 42%* and the bar is filled to 42%

#### Scenario: The frame is ready

- **WHEN** the first frame is ready to show
- **THEN** the card fades out and the frame fades in

#### Scenario: The inspector names the video

- **WHEN** the inspector's layers or details are shown for a video named *Launch teaser*
- **THEN** its heading reads *Launch teaser*
