## ADDED Requirements

### Requirement: The frame carries the video's name and shows a turn working

The canvas SHALL name the video frame with a small label just above the frame's top-left corner: the open video's name, in muted text, outside the frame so it never covers the video. The label SHALL follow the camera in the same frame the video moves — pan, zoom, Fit, Zoom to selection and their animations — and SHALL keep one screen size at every zoom. It SHALL be cut short with an ellipsis rather than run past the frame's right edge. While the frame's left edge is off the canvas or under the left ruler, the label SHALL sit at the left end of the frame's top edge that is still shown.

While the open chat's turn is running and nothing waits on the person — no permission card and no source question — the label SHALL show, in place of the name and whether or not anything is selected on the canvas, a wide version of the chat's thinking animation — one dot matrix, as tall as the chat's and three times as wide, with a single ripple across its width, in the same colour as the chat's mark — followed by a short phrase about making the video (such as "Storyboarding…" or "Keyframing…") in the chat's shimmer, the phrase changing every few seconds. It SHALL use the chat's mark's dots, colours, timing and opacity levels. The name SHALL come back as soon as the turn ends, however it ends. When the system asks for reduced motion the mark SHALL be shown still, as the chat's is.

The label SHALL NOT be shown while its place is not on the canvas: when the frame's top edge is above the canvas, below it, or close enough to the toolbar or the top ruler that the label would sit under them, or when less of the frame's top edge is on the canvas than the label needs to be read. It SHALL NOT be shown in the full-screen view, while the video is loading or has failed, or with no open video. The label SHALL NOT take pointer events and SHALL NOT be announced to a screen reader; the inspector names the video and the chat says what the turn is doing. The app window owns the label; the preview page draws nothing for it.

#### Scenario: A video is open

- **WHEN** a video is open on the canvas and its frame's top edge is in view
- **THEN** the video's name is shown just above the frame's top-left corner

#### Scenario: A turn works with nothing selected

- **WHEN** the open chat's turn is running with nothing waiting on the person and nothing is selected on the canvas
- **THEN** the label above the frame shows the wide thinking animation and a working phrase instead of the video's name
- **AND** the phrase changes every few seconds while the turn runs

#### Scenario: The turn ends

- **WHEN** the turn finishes, fails or is stopped
- **THEN** the animation and the phrase go away and the video's name is shown again

#### Scenario: A card is waiting to be answered

- **WHEN** the running turn raises a permission card or a source question
- **THEN** the label shows the video's name, without the animation, until the card is answered and the turn carries on

#### Scenario: The camera moves

- **WHEN** the canvas is panned or zoomed, or Fit or Zoom to selection animates the view
- **THEN** the label stays just above the frame's top-left corner in every frame, at the same size on screen

#### Scenario: The frame's top edge is under the toolbar or off the canvas

- **WHEN** the view is moved so the place above the frame is under the toolbar or the top ruler, or outside the canvas
- **THEN** the label and its animation are not shown, and they come back as soon as the place above the frame is in view again

#### Scenario: Zoomed in past the frame's left edge

- **WHEN** the frame's top edge is in view but its left edge is off the canvas or under the left ruler
- **THEN** the label sits at the left end of the part of the top edge that is shown

#### Scenario: Watching full screen

- **WHEN** the full-screen view is open
- **THEN** no label and no animation are drawn over the video

#### Scenario: The chrome changes

- **WHEN** the rulers are shown or hidden or the inspector is expanded or collapsed without the camera moving
- **THEN** the label is placed again against what now covers the canvas's edges

#### Scenario: Reduced motion

- **WHEN** the system asks for reduced motion
- **THEN** the thinking mark is shown still, the way the chat's mark is
