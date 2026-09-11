## Purpose

Inspect answers *change this*: hover the frame, click the thing you mean, and the studio resolves what you pointed at — its component, its place in the code, its own stretch of time and the tunable parts around it — so it can be tuned live and named in the message.

## ADDED Requirements

### Requirement: Arming is acknowledged, and the frame's clicks are taken

Arming Inspect SHALL pause the preview, put a crosshair over the frame, and force the frame and everything inside it to be hit-testable for as long as the mode is on. The page SHALL answer every arm and disarm with a status — armed, disarmed, no player canvas, or the source resolver unavailable — and the pane SHALL print anything that is not a clean arm, including when no answer arrives within a short patience. Inspect and Snapshot SHALL be mutually exclusive, and Escape SHALL disarm whichever is on unless something else has already answered that key. While armed, pointer and click events SHALL be stopped when, and only when, they land on the frame itself, so a pick never also reaches the player's click-to-play; whether a point is on the frame SHALL be decided by asking the document what is under it, falling back to the frame's rectangle when the document cannot answer.

#### Scenario: Inspect is armed

- **WHEN** the Inspect button is pressed while it is available
- **THEN** the preview pauses, the frame takes a crosshair, and the button reads as pressed
- **AND** everything inside the frame is made hit-testable, so a scene that puts an overlay out of the pointer's way is still pickable

#### Scenario: The source resolver did not load

- **WHEN** the page answers that it has no source resolver
- **THEN** the pane reads that selections will carry no source location
- **AND** picking still works

#### Scenario: The player is not on screen

- **WHEN** the page answers that it has no player canvas
- **THEN** the pane reads *The player is not on screen yet, so there is nothing to pick from.*

#### Scenario: The page never answers

- **WHEN** no answer arrives within the patience window
- **THEN** the pane reads that Inspect is on but the preview never answered, and suggests restarting the preview

#### Scenario: A pick on the frame

- **WHEN** a click lands on the frame while armed
- **THEN** the element is picked and the click does not reach the player underneath

#### Scenario: A click on the transport bar

- **WHEN** a click lands on the player's transport controls, which overlap the frame's rectangle
- **THEN** the click reaches them and the video responds

### Requirement: A click picks the thing that actually paints at the point

A pick SHALL take the topmost element under the pointer that paints something there — a background, an image, a border, a shadow, or text near the point — rather than the topmost transparent wrapper. An element that is effectively invisible SHALL paint nothing: one whose own or whose ancestor's opacity is below a small threshold, or whose visibility is not visible. A masked element SHALL count as painting only where it shows text. Text SHALL win over a surface. A candidate covering almost the whole frame on both axes SHALL lose to any smaller candidate under the same point. Holding Alt SHALL turn every one of those rules off and pick the literal topmost element.

#### Scenario: A word in a line of words

- **WHEN** a point lands on a word, or in the gap between two words of one line
- **THEN** the line is picked rather than the backdrop or the marker behind it

#### Scenario: A full-frame glow over a card

- **WHEN** a full-frame surface and a smaller card both paint under the point
- **THEN** the card is picked
- **AND** with nothing smaller under the point, the full-frame surface is picked

#### Scenario: A word that has not been revealed yet

- **WHEN** the point is over text whose element has faded to nothing at this frame
- **THEN** that text is not picked, and whatever paints behind it is

#### Scenario: Alt is held

- **WHEN** the pointer is over a word inside a wrapper inside a line, with Alt held
- **THEN** the literal topmost element is picked, with no climbing and no filtering

### Requirement: A pick is widened to the thing you meant

From the element that paints, the pick SHALL climb outward while the current element is an inline wrapper — inline-level and painting no surface of its own — and SHALL stop at the first block-level element, at an element that paints its own surface, or at the frame itself. Anything in the SVG namespace SHALL be treated as one drawing: it always paints once it is on screen, it is never an inline wrapper, and a shape inside it SHALL be folded up to the outermost picture that holds it. Tags SHALL be compared in a way that is correct for both HTML and SVG.

#### Scenario: A letter inside a word inside a line

- **WHEN** a letter is picked
- **THEN** it climbs through its word to the line that holds it

#### Scenario: A highlighted chip inside a sentence

- **WHEN** the inline element under the point paints its own surface or its own border
- **THEN** the climb stops there rather than taking the whole line

#### Scenario: A card in a grid of cards

- **WHEN** a card is picked
- **THEN** it is not folded up into the grid, the card being block-level

#### Scenario: A path inside an icon

- **WHEN** a shape inside an SVG is picked
- **THEN** the outermost picture holding it is what is selected
- **AND** Alt still picks the shape itself

### Requirement: Two boxes and their label, drawn inside the preview

The preview page SHALL draw a thin hover box with a label, which lives and dies with the armed mode, and a solid selection box with a label, which belongs to the open card rather than to the mode. Both SHALL be drawn inside the preview document, so they cannot drift from the pixels. The label on both SHALL name the component the person could actually tune, followed by the element's tag: the name the author declared on the component by preference, then the interactive component's own name, then the nearest component in the tree that is neither Remotion's own wrappers nor its internal plumbing, and the bare tag when nothing names it. The selection box SHALL be set the moment a click lands, before the selection has been resolved. It SHALL be cleared only when the card is closed or the page is rebuilt, and SHALL follow the open link of the chain when the properties pane switches between them.

#### Scenario: The pointer moves over the frame

- **WHEN** the pointer moves while armed
- **THEN** the hover box is redrawn on the element that would be picked, at most once per animation frame

#### Scenario: An element is clicked

- **WHEN** a click lands on an element
- **THEN** the selection box is placed on it immediately, before the selection is reported
- **AND** it stays there when the pointer leaves the frame

#### Scenario: The pane switches to an outer link

- **WHEN** the properties pane is switched to another link of the selected element's chain
- **THEN** the selection box moves to the first element that link renders

#### Scenario: The card is closed

- **WHEN** the card is cancelled
- **THEN** the selection box and its label are taken off, whether or not the mode is still armed

#### Scenario: The author named the component

- **WHEN** the picked element's interactive component carries a declared name
- **THEN** the label reads that name and the tag

#### Scenario: Only Remotion's plumbing is around it

- **WHEN** every component around the element is a Remotion wrapper or an internal forwarding function
- **THEN** the label is the bare tag rather than a name nobody would recognise

### Requirement: Selection identity is per instance, not per call site

A selection SHALL be identified by the element that was clicked, expressed as a path from the nearest design identifier in its ancestry, or from the frame itself, so several elements rendered from one place in the code are different selections. A click on the element already open SHALL be reported as a repeat: the selection box pulses and nothing else changes — no revert, no reopening of the chain. With no card open, a click on the same element SHALL open it again.

#### Scenario: Four rows rendered from one place in the code

- **WHEN** each of the four is clicked in turn
- **THEN** each opens as its own selection
- **AND** the properties pane can say which instance of how many is open

#### Scenario: A stray second click

- **WHEN** the element that is already open is clicked again
- **THEN** the selection box pulses, and the values already tuned on it are untouched
- **AND** the pulse is not animated when the person has asked for reduced motion

#### Scenario: The element is clicked after the card was cancelled

- **WHEN** the same element is clicked with no card open
- **THEN** it opens again

### Requirement: What a selection carries

A reported selection SHALL carry the component's name, its file, line and column or nothing when the source could not be resolved, its markup truncated to a bounded length, the composition it belongs to, the frame and the frame rate it was picked at, the scene around it with that scene's own offset and duration, the parent frames of its stack that lie inside the project, its rectangle normalised to the page's viewport, the element's own timed window, its direct text when it has exactly one text child, the font families the page has loaded, the project's static file names, the composition's resolved numbers, and the chain of tunable components around it from innermost outward. A selection whose source could not be resolved SHALL still be usable.

#### Scenario: An element inside a scene

- **WHEN** an element inside a timed scene is picked
- **THEN** the selection names that scene, its start, its duration and how far into it the current frame is
- **AND** the element's own window is the sequence it sits in, counted once and absolutely

#### Scenario: The source cannot be resolved

- **WHEN** the source resolver answers nothing for the element
- **THEN** the selection still carries the component, the markup, the frame and the chain
- **AND** what is shown where a file would be says there is no source

#### Scenario: The stack reaches into a dependency

- **WHEN** frames of the stack point at files inside the project's dependencies, or at the resolver's own proxy
- **THEN** those frames are dropped and only the project's own are reported

### Requirement: Nothing about a pick reaches a third party

The source resolver SHALL be served by the preview host from a copy the studio ships, SHALL be prevented from starting itself, SHALL be started with telemetry off, and SHALL have any request for a web-hosted font stripped out of it when it is served. Its own overlay — its toolbar, its selection boxes, its labels and its drag box — SHALL be turned off, so nothing of it is on screen. Nothing about a selection SHALL leave the machine.

#### Scenario: The resolver's bundle is served

- **WHEN** the page loads the source resolver
- **THEN** it is served from the copy the studio ships, before the project's own bundle
- **AND** every request in it for a font hosted on the web has been removed, and how many were removed is logged

#### Scenario: The studio ships no resolver

- **WHEN** the resolver's script cannot be found or read
- **THEN** the page is served without it and arming answers that it is unavailable
- **AND** the preview itself is unaffected

### Requirement: Markers and the comment card are drawn in the app window

The numbered markers for selections already added, and the comment card for an element with nothing to tune, SHALL be drawn in the app window over the preview, in a layer that lets pointer events through. Marker geometry SHALL be normalised to the preview page's viewport, so a resize keeps a marker on its element. The card SHALL be placed beside the element it belongs to, below it by preference, flipping above or to the other edge when there is no room and staying on the pane in every case. An element that has something to tune SHALL open the properties pane instead of the card, which is specified by the `preview/properties-pane` capability.

#### Scenario: The pane is resized

- **WHEN** the pane is resized after a selection was added
- **THEN** the marker stays on its element

#### Scenario: There is no room below the element

- **WHEN** the element sits near the bottom of the frame
- **THEN** the card opens above it
- **AND** a card larger than the pane is pinned to a corner rather than running off it

### Requirement: The card is not a popover

The comment card SHALL NOT close on an outside press, SHALL NOT trap focus, and SHALL take the focus itself when it opens and hand it back when it closes. Escape inside its field SHALL cancel it. Enter without Shift SHALL add. Add SHALL leave the card open and empty its field; only Cancel SHALL close it, and Cancel SHALL restore the values the element arrived with.

#### Scenario: Clicking elsewhere on the frame

- **WHEN** another element is clicked while the card is open
- **THEN** the card moves to that element rather than the click being swallowed as a dismissal

#### Scenario: Add is pressed

- **WHEN** Add is pressed
- **THEN** the selection is put in the composer, the field empties, and the card stays open on the same element
- **AND** the values set on it stay live in the frame

#### Scenario: Cancel is pressed

- **WHEN** Cancel is pressed
- **THEN** the card closes, the selection box is taken off, and the values the element arrived with are restored

### Requirement: Picking elsewhere abandons what was pending

Moving the selection to another element SHALL revert the changes that element's card was still holding and SHALL say so in a message with an Undo, held open for ten seconds. Undo SHALL abandon whatever card is open first, then set the reverted values again and reopen the card they belonged to. A card whose changes have already been added SHALL NOT be reverted. Only the paths a card actually moved SHALL be reset, never a whole component, so that letting a card go cannot undo work another card already added. The properties pane's own resets are specified by the `preview/properties-pane` capability.

#### Scenario: Another element is picked with changes pending

- **WHEN** the selection moves away from a card holding unsent changes
- **THEN** those values are put back, and a message names how many were reverted and on what, with an Undo

#### Scenario: Undo is pressed

- **WHEN** Undo is pressed inside the window
- **THEN** whatever card is now open is abandoned first, the reverted values are set again, and that card is reopened

#### Scenario: The card had already been added

- **WHEN** the selection moves away from a card whose changes were added
- **THEN** nothing is reverted and no message is raised

### Requirement: A rebuild clears what refers to the old render

When the preview reports that it rebuilt, whatever the open card was still holding SHALL be reset, the card SHALL be closed, the markers SHALL be taken off, selections already added SHALL be marked as no longer reopenable, and Inspect SHALL be disarmed. The text being typed in the composer and the references already in it SHALL NOT be touched.

#### Scenario: A turn writes to the project while a card is open

- **WHEN** the preview rebuilds
- **THEN** the card closes, its pending values are reset, the markers go and the mode is disarmed
- **AND** what was typed in the composer is still there

#### Scenario: A chip from before the rebuild

- **WHEN** a selection added before the rebuild is clicked in the composer
- **THEN** it does not reopen the properties pane

### Requirement: The playhead crosses the wire and the boxes follow it

The page SHALL report the playhead — the frame and whether the video is playing — immediately on play, pause and seek, and at most once per animation frame while playing. The boxes SHALL be repainted on every frame update, so a box on a moving element tracks it. While Inspect is armed and the pane has nothing more urgent to say, the pane SHALL show the frame the preview is on. That readout SHALL NOT be announced to a screen reader.

#### Scenario: The video is played while an element is selected

- **WHEN** the preview plays
- **THEN** the selection box follows the element as it moves
- **AND** the pane's frame readout counts up

#### Scenario: The frame is seeked

- **WHEN** the preview is seeked
- **THEN** the new frame is reported at once rather than at the next animation frame

### Requirement: The card can move the frame it is judged at

A selection carrying a timed window SHALL be offered a way to seek within that window and to replay it: the preview is paused, seeked to the window's start, played, and paused again on the window's last frame. An element with no timed window SHALL say so rather than offering a replay that would do nothing. Replaying SHALL be skipped while the preview is already playing. Picking an element SHALL NOT seek, so the frame being judged stays the one on screen. A selection already added SHALL be able to seek back to the frame it was made on.

#### Scenario: An element's own window is replayed

- **WHEN** Replay is pressed for an element whose window ends after it begins
- **THEN** the preview seeks to the window's start, plays, and pauses on its last frame

#### Scenario: An element with no timed window

- **WHEN** the element sits in no sequence
- **THEN** the strip says it has no timed window and Replay is not offered

#### Scenario: A chip in the composer is seeked to

- **WHEN** a selection already in the composer is asked to seek
- **THEN** the preview goes to the frame that selection was made on

### Requirement: Inspect is offered only when it can work, and says why not

The Inspect button SHALL carry the reason it is unavailable on its tooltip rather than being silently dead, and SHALL remain focusable so that reason can be read. It SHALL be unavailable while the plan is Free, while the preview pane is hidden, while the pane is showing documents, with no Project open, with the Project's folder missing, while a permission card is waiting to be answered, while the preview is not yet serving, and when the preview is showing a different Project from the open chat's. Anything armed SHALL be disarmed the moment it becomes unavailable. A move to another Project SHALL drop the element references in the composer, leaving text, pictures and assets alone, which is specified by the `composer/references` capability.

#### Scenario: The plan is Free

- **WHEN** Inspect is pressed on the Free plan
- **THEN** nothing is armed
- **AND** the trial invitation is brought back, and the tooltip says Inspect and Snapshot are part of Pro

#### Scenario: The preview is on another project

- **WHEN** the preview is showing a Project other than the open chat's
- **THEN** the tooltip reads *The preview is showing a different project than this session.*

#### Scenario: The pane moves to documents while armed

- **WHEN** the pane's mode moves to Docs
- **THEN** Inspect is disarmed and its button leaves the header

#### Scenario: The open chat moves to another project

- **WHEN** the open chat moves to a different Project
- **THEN** the element references in the composer are dropped and renumbered away
- **AND** the pictures, assets and the text that was typed are left alone
