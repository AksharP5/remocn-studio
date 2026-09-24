# preview/inspect Specification

## Purpose
Inspect answers *change this*: hover the frame, click the thing you mean, and the studio resolves what you pointed at — its component, its place in the code, its own stretch of time and the tunable parts around it — so it can be tuned live and named in the message.

## Requirements

### Requirement: Explicit geometry supports direct manipulation

A selected managed HTML object with declared, consumed geometry bindings SHALL
show its border box, eight resize handles, dimensions in composition units and an
optional rotation handle. Its base coordinates SHALL be stored in its positioned
parent's space. Preview scale SHALL not change how far a gesture moves the object
in composition coordinates. Geometry without explicit bindings or with unsupported
transforms SHALL remain available through ordinary selection and properties.

#### Scenario: Dragging a selected object

- **WHEN** a pointer moves beyond the click threshold on a bound object
- **THEN** playback is paused and the object follows the pointer without easing or momentum
- **AND** Shift constrains movement to one axis
- **AND** a click below the threshold still permits double-click text editing

#### Scenario: Resizing a rotated box

- **WHEN** a corner or edge is dragged
- **THEN** the opposite corner or edge remains anchored in the parent's coordinate space
- **AND** dimensions remain positive and respect their declared constraints
- **AND** Shift at a corner preserves the original aspect ratio
- **AND** resizing text changes its box rather than its font size

#### Scenario: Rotating an object

- **WHEN** the rotation handle is dragged
- **THEN** the object rotates about its center and the label shows its angle
- **AND** Shift snaps the angle to fifteen-degree increments

#### Scenario: Cancelling or finishing a gesture

- **WHEN** Escape, pointer cancellation, loss of capture or a source replacement interrupts a drag
- **THEN** its temporary geometry is removed without a file write
- **WHEN** a changed gesture ends normally
- **THEN** all affected fields are submitted as one operation with one Undo
- **AND** the temporary override is removed after the runtime displays the accepted values

#### Scenario: Manipulation using the keyboard

- **WHEN** a resize or rotation handle has focus and an arrow key is pressed
- **THEN** the corresponding geometry changes by one unit, or ten with Shift
- **AND** the property fields remain an alternative for entering exact values

#### Scenario: A rebuild or Snapshot resets selection tools

- **WHEN** selection tools are mounted again
- **THEN** the preview requests fresh geometry capabilities from the app
- **AND** an earlier gesture cannot write to a new object generation

### Requirement: Managed plain text can be edited in the preview

Double-clicking a supported HTML text region SHALL open a plain-text input over
that region while playback stays paused. The input SHALL inherit its typography,
alignment and preview scale, and grow with its content up to the visible frame's
available height. Enter SHALL insert a newline. Cmd/Ctrl+Enter or an outside click
SHALL save one normal managed property operation; Escape SHALL cancel without a
write. Editing keystrokes and pointer gestures SHALL not trigger selection or
player shortcuts. Selection outlines SHALL be hidden during text entry.

#### Scenario: A card has several text fields

- **WHEN** Title, Status and Footer regions have explicit field bindings
- **THEN** double-clicking Status edits only Status, even if another field currently has the same text
- **AND** one completed edit is undone with one existing property Undo

#### Scenario: An older scene has no field bindings

- **WHEN** a plain text region exactly matches one declared text field on its managed object
- **THEN** it can be edited inline without rewriting the authored runtime
- **AND** multiple matching fields or unsupported markup fall back to the properties pane

#### Scenario: A text edit is cancelled

- **WHEN** Escape is pressed inside the inline input
- **THEN** the input closes, the original rendered text returns, and selection stays open
- **AND** no draft, file write or Undo operation is created

#### Scenario: A save fails

- **WHEN** the property writer rejects a completed inline edit
- **THEN** its existing inspector draft remains available for Retry or Discard
- **AND** the failure is not presented as a successful save

#### Scenario: The source changes during editing

- **WHEN** a rebuild replaces the text node or its managed document generation
- **THEN** the inline session is cancelled and its old request cannot write into the new generation
- **AND** a concurrent property change detected before commit retains the input with an explanation

#### Scenario: A scene uses a transform the plain-text input cannot reproduce

- **WHEN** text uses SVG, rotation, skew, perspective, vertical writing or mixed rich-text styles
- **THEN** its properties remain available without an inaccurate inline editor

#### Scenario: A video is exported during text entry

- **WHEN** an inline text session or its save is pending
- **THEN** export waits for that edit to be completed or cancelled and for the preview's save receipt

### Requirement: Element selection is available without a mode button

When editing is available, the preview SHALL enable element selection automatically, without an Inspect button. Becoming ready SHALL neither pause playback nor open the properties pane. The page SHALL acknowledge whether selection is ready, disabled, missing a player canvas, or missing the source resolver. The pane SHALL explain a failure or a missing acknowledgement. Selection and Snapshot SHALL be mutually exclusive; leaving Snapshot SHALL restore selection automatically. Pointer events SHALL be intercepted only on the frame itself. Clicking an element SHALL pause playback at the current frame and select it. Escape SHALL clear the current selection while keeping selection available, unless another control has already handled the key.

#### Scenario: The preview becomes ready

- **WHEN** an editable preview becomes ready
- **THEN** its elements can be selected immediately
- **AND** playback and the closed properties pane are left alone
- **AND** the frame is made hit-testable, including elements authored with pointer events disabled

#### Scenario: Snapshot temporarily owns the frame

- **WHEN** Snapshot is active
- **THEN** frame gestures capture an image rather than select an element
- **AND** leaving Snapshot restores element selection without another action

#### Scenario: Escape clears the selection

- **WHEN** Escape is pressed with an element selected and no other control handles the key
- **THEN** the selection and its properties are closed
- **AND** a later click can immediately select another element

#### Scenario: Source resolution finishes after selection was cleared

- **WHEN** an earlier click resolves after Escape, a different pick, or a rebuild
- **THEN** that result does not reopen or replace the current selection

#### Scenario: The source resolver did not load

- **WHEN** the page answers that it has no source resolver
- **THEN** the pane reads that selections will carry no source location
- **AND** picking still works

#### Scenario: The player is not on screen

- **WHEN** the page answers that it has no player canvas
- **THEN** the pane reads *The player is not on screen yet, so there is nothing to pick from.*

#### Scenario: The page never answers

- **WHEN** no answer arrives within the patience window
- **THEN** the pane explains that element selection is unavailable because the preview did not answer, and suggests restarting it

#### Scenario: A pick on the frame

- **WHEN** a click lands on an element while selection is available
- **THEN** playback pauses and the element is picked without seeking
- **AND** the click does not reach the player underneath

#### Scenario: A click on the transport bar

- **WHEN** a click lands on the playback controls below the frame
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

### Requirement: Quiet hover and persistent selection, drawn inside the preview

The preview page SHALL draw a thin, subdued hover outline without a fill or floating label, and a solid selection outline with a label. Hover SHALL not draw a second outline on the selected element. Both outlines SHALL live inside the preview document. The selection label SHALL name the declared object or tunable component, falling back to its element tag when nothing names it. The selection outline SHALL appear immediately on click, before source resolution completes, and follow the open target in the properties pane. Over visible text, the pointer SHALL use a text cursor; elsewhere it SHALL use the default cursor. Neither hovering nor changing the cursor SHALL pause playback or open properties.

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

When the preview reports that it rebuilt, legacy selections tied to the old render SHALL be cleared: pending card values are reset, the card is closed, markers are removed, and references already added are marked as no longer reopenable. On the canvas, the element that was picked SHALL then be picked again in the rebuilt runtime when it can still be found by its per-instance anchor, reopening its card. Managed objects retain their stable-ID behavior. Element selection SHALL be enabled again automatically when the preview is ready and editing is available. The text being typed in the composer and the references already in it SHALL NOT be removed.

#### Scenario: A turn writes to the project while a card is open

- **WHEN** the preview rebuilds
- **THEN** the legacy card's pending values are reset and its markers go
- **AND** on the canvas the card reopens on the same element when it still exists
- **AND** the next ready preview supports selection automatically
- **AND** what was typed in the composer is still there

#### Scenario: A chip from before the rebuild

- **WHEN** a selection added before the rebuild is clicked in the composer
- **THEN** it does not reopen the properties pane

### Requirement: The playhead crosses the wire and the boxes follow it

The page SHALL report the playhead — the frame and whether the video is playing — immediately on play, pause and seek, and at most once per animation frame while playing. The boxes SHALL be repainted on every frame update, so a box on a moving element tracks it. The playback panel SHALL display progress without announcing every frame to a screen reader. The quiet status area SHALL explain that clicking selects an element, or that Escape clears an existing selection.

#### Scenario: The video is played while an element is selected

- **WHEN** the preview plays
- **THEN** the selection box follows the element as it moves
- **AND** the playback panel's progress updates

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

Element selection SHALL be unavailable while the plan is Free, while the preview pane is hidden, while the pane is showing documents, with no Project open, with the Project's folder missing, while a permission card is waiting to be answered, while the preview is not yet serving, and when the preview is showing a different Project from the open chat's. A visible, serving preview SHALL explain the reason in its status area. Losing availability SHALL disable picking immediately. The Inspect menu command SHALL focus the preview and open the managed object catalogue when available, rather than toggle selection off. A move to another Project SHALL drop element references in the composer while preserving text, pictures and assets, as specified by `composer/references`.

#### Scenario: The plan is Free

- **WHEN** a preview is shown on the Free plan
- **THEN** element selection is disabled
- **AND** its status explains that Inspect and Snapshot are part of Pro

#### Scenario: The preview is on another project

- **WHEN** the preview is showing a Project other than the open chat's
- **THEN** the status reads *The preview is showing a different project than this session.*

#### Scenario: The pane moves to documents while armed

- **WHEN** the pane's mode moves to Docs
- **THEN** element selection is disabled until the pane returns to Preview

#### Scenario: The open chat moves to another project

- **WHEN** the open chat moves to a different Project
- **THEN** the element references in the composer are dropped and renumbered away
- **AND** the pictures, assets and the text that was typed are left alone

### Requirement: Direct manipulation of animated managed geometry

An opted-in managed object MUST declare its current frame's affine mapping from
base geometry to rendered layout, including positive uniform local scale. The
preview MUST draw handles at the rendered pose, transform pointer movement through
supported 2D ancestor rotation and uniform scale, and invert the declared mapping
before committing base property values as one operation. It MUST NOT persist DOM
measurements or freeze the animation at the edited frame. A playhead change MUST
cancel unfinished gestures. Singular mappings, hidden objects, perspective, skew
and nonuniform scale MUST retain property editing without inaccurate handles.

#### Scenario: Resize midway through an animated card expansion
- **WHEN** the composition is paused during interpolation between two card poses
- **AND** the scene binds the endpoint with the larger interpolation weight
- **THEN** the opposite visible edge stays fixed during resize
- **AND** release saves changes to that endpoint without a jump at the paused frame
- **AND** one Undo reverses all changed geometry fields.

#### Scenario: Move a scaled and rotated object
- **WHEN** the selected object has entry rotation, local uniform scale or a rotated uniformly scaled ancestor
- **THEN** its handles follow the projected border box
- **AND** pointer deltas are converted into the object's parent coordinates.

### Requirement: Scenes in the object list move the playhead

A scene object in the object list SHALL be linked to the scene on the seek bar
whose name equals its label. Clicking a linked scene row SHALL select the scene
object and move the playhead to the scene's first frame. Clicking the row of an
object that is not mounted at the current frame SHALL select it and move the
playhead to the first frame of the scene it belongs to, so it is drawn with its
outline and handles. A scene object or object with no linked scene SHALL be
selected without moving the playhead.

#### Scenario: Jumping to a scene from the list

- **WHEN** the person clicks the "Pricing" scene row
- **THEN** the playhead moves to the first frame of the "Pricing" scene and the scene object is selected

#### Scenario: Reaching an off-screen object

- **WHEN** the person clicks a dimmed row whose scene is linked
- **THEN** the playhead moves to that scene's first frame
- **AND** the object is selected with its outline and handles on the canvas

#### Scenario: A scene the seek bar does not know

- **WHEN** a scene object's label matches no scene on the seek bar
- **THEN** clicking it selects it and the playhead stays where it is

### Requirement: Managed selection follows object identity

For managed videos the studio SHALL select declared semantic roots and preserve the selected object ID through rebuilds and temporary unmounts.

#### Scenario: Text is split into letters
- **WHEN** a letter inside a managed heading is picked
- **THEN** the heading object is selected

#### Scenario: The selected object is deleted
- **WHEN** the next valid catalogue no longer contains the ID
- **THEN** selection is cleared rather than moved to another object

### Requirement: Editing is scoped to the native surface
Main preview picking SHALL query the mounted video’s ShadowRoot. Geometry and
text overlays SHALL remain in unscaled screen space and repaint on camera
changes, including when playback is paused. Geometry ancestor traversal SHALL
include the camera outside the shadow host. Comment rectangles SHALL remain
normalized to video coordinates. Properties and playback chrome SHALL not
initiate a pick. Existing field eligibility and operation validation SHALL apply.

#### Scenario: A zoomed element is resized
- **WHEN** a supported managed geometry handle is dragged at a non-default zoom
- **THEN** the committed size and position use video units
- **AND** the camera remains fixed for the gesture

#### Scenario: Native text editing begins
- **WHEN** supported managed text is double-clicked
- **THEN** the existing inline editor opens above its text in the canvas
- **AND** saving uses the same operation and rendered receipt protocol

#### Scenario: A snapshot is drawn while zoomed
- **WHEN** the user drags a snapshot region over the video
- **THEN** it maps to the corresponding video region independently of pan and zoom

#### Scenario: An existing provider loads
- **WHEN** the native compiler encounters the supported studio-objects-v5 provider
- **THEN** its transport is adapted to the local surface without rewriting authored source
- **AND** generation and operation acknowledgments remain intact

### Requirement: Direct manipulation snaps to the frame and other objects
Moving or resizing an unrotated managed object SHALL snap the sides that the
gesture moves to the frame's edges and centre and to the edges and centres of
other visible managed objects when within six screen pixels, independent of zoom.
A guide line SHALL show each active snap. Holding ⌘ or Ctrl SHALL disable
snapping for the gesture. Rotation and aspect-locked corner resizing SHALL NOT snap.

#### Scenario: Centring an object
- **WHEN** a dragged object's centre comes within six screen pixels of the frame's centre
- **THEN** the object aligns to the centre and a guide is drawn across the frame
- **AND** the committed value is in composition units

#### Scenario: Snapping is turned off
- **WHEN** ⌘ or Ctrl is held during the drag
- **THEN** the object follows the pointer exactly and no guide is drawn

### Requirement: The keyboard nudges a selected object
With a managed object selected and editable, arrow keys on the canvas SHALL move
it by one composition unit, or ten with Shift; with a resize or rotation handle
focused they SHALL change that edge or angle. Consecutive presses SHALL be one
operation with one Undo. Without an editable selection, arrow keys SHALL keep
stepping frames.

#### Scenario: Holding an arrow key
- **WHEN** an arrow key is held on a selected object
- **THEN** the object keeps moving and one operation is written after the key is released

#### Scenario: Nothing editable is selected
- **WHEN** an arrow key is pressed on the canvas without a managed selection
- **THEN** the playhead moves one frame

### Requirement: Entry and exit poses are edited on the canvas
A managed object that moves between two field-backed poses through the v5
`geometryBetween` helper SHALL be edited in the pose that dominates the current
frame: the start pose while its weight is at least one half, the other pose from
the midpoint on. The canvas SHALL name the edited pose, draw the other pose as an
outline and draw the path between the two. When the move declares the local
frames of both poses, clicking the outline SHALL move the playhead to that pose.
A selected managed object SHALL keep its handles while transparent. Saving SHALL write only the edited
pose's fields as one operation. Objects moved by an unbound CSS offset keep editing
their resting geometry.

#### Scenario: Dragging an object before it has entered
- **WHEN** the playhead is early in an entry and the object, still outside the frame, is dragged
- **THEN** its start pose moves and its resting pose stays
- **AND** the label reads "Entry start" and the resting pose is outlined with the path to it

#### Scenario: Dragging an object that has almost left
- **WHEN** the playhead is late in an exit and the object is dragged
- **THEN** its end pose moves and the label reads "Exit end"

#### Scenario: Going to the other pose
- **WHEN** the move declares the frames of its two poses and the outline of the other pose is clicked
- **THEN** playback pauses and the playhead moves to the frame of that pose
- **AND** the object stays selected, now editing that pose, even if it is transparent there

#### Scenario: Moving a start pose that is transparent and outside the frame
- **WHEN** the selected object is transparent at the current frame or cannot be hit where it is drawn
- **THEN** it is shown half-transparent in the editor and its label says so
- **AND** dragging inside its selection frame moves it instead of panning the canvas

#### Scenario: The helper in an older project
- **WHEN** a project created before the helper is opened
- **THEN** the helper file is added next to its authored v5 runtime and nothing authored changes

### Requirement: The inspector lists the video's editable objects

When nothing is selected, the inspector SHALL list the open video's managed
objects as a tree by their labels and parents, in document order, followed by
the video's dimensions, frame rate and duration on one line. Objects not
mounted at the current frame SHALL be listed dimmed. The list SHALL follow a
rebuild and an edit of the objects document. A video without managed objects
SHALL show a sentence saying it has no editable objects, with the video details.

#### Scenario: Nothing is selected

- **WHEN** a video with managed objects is open and nothing is selected
- **THEN** the inspector shows its objects as a tree and the video details below it

#### Scenario: An object is off screen

- **WHEN** an object is not mounted at the current frame
- **THEN** its row is dimmed
- **AND** it becomes undimmed once the playhead reaches a frame where it is mounted

#### Scenario: A video without editable objects

- **WHEN** the open video declares no managed objects
- **THEN** the inspector says the video has no editable objects and shows its details

#### Scenario: The document cannot be read

- **WHEN** the objects document fails to load
- **THEN** the inspector shows the failure as a sentence and the video details

### Requirement: The object list is a tree of collapsible groups

An object with children SHALL be listed as a group with a control that expands
and collapses it. An object whose definition is `scene` SHALL be listed as a
scene group, distinguished from ordinary groups. A group SHALL start expanded
when it or any of its descendants is mounted at the current frame, or when it
contains the selection, and collapsed otherwise; a group the person expanded or
collapsed SHALL keep that state while the video stays open, except that a new
selection inside a collapsed group SHALL expand the groups above it. Collapsing
a group SHALL NOT change the selection.

#### Scenario: A video described by scenes

- **WHEN** the video's objects are parented to scene objects
- **THEN** the list shows one scene group per scene with its objects inside
- **AND** the scene on screen is expanded and the others are collapsed

#### Scenario: Collapsing a group

- **WHEN** the person collapses an expanded group
- **THEN** its descendants are hidden from the list and the group stays collapsed as the playhead moves

#### Scenario: Selecting inside a collapsed group

- **WHEN** the person clicks on the canvas an object inside a collapsed group
- **THEN** the groups above it expand and its row is marked as selected

#### Scenario: A flat video

- **WHEN** no object has a parent
- **THEN** the list shows every object at one level, as before

### Requirement: The object list selects and points at objects

Hovering a row SHALL outline its object on the canvas with the quiet hover
style while the object is mounted; leaving the row SHALL remove the outline.
Clicking a row SHALL select the object exactly as clicking it on the canvas
does, opening its properties. Selecting an object that is not mounted SHALL open
its properties without an outline on the canvas.

#### Scenario: Hovering a row

- **WHEN** the pointer rests on a mounted object's row
- **THEN** the object is outlined on the canvas

#### Scenario: Selecting a hidden object

- **WHEN** the person clicks the row of a transparent or covered object
- **THEN** the object is selected and its properties open
- **AND** its selection outline and handles are drawn on the canvas

#### Scenario: Selecting an off-screen object

- **WHEN** the person clicks a dimmed row
- **THEN** the object's properties open
- **AND** nothing is outlined on the canvas

### Requirement: The object list stays reachable while something is selected

While a selection is open and editable objects are listed, the inspector SHALL
offer Layers and Properties views. A new selection, from the canvas or the list,
SHALL show Properties. Choosing Layers SHALL show the list without changing the
selection: the object stays outlined with its handles on the canvas, and its row
is marked as selected. Clicking a row SHALL select that object and show
Properties. With nothing selected, only Layers SHALL be available.

#### Scenario: Going back to the list

- **WHEN** an object is selected and the person chooses Layers
- **THEN** the list is shown with the object's row marked
- **AND** the object remains selected on the canvas

#### Scenario: Picking another object from the list

- **WHEN** the list is shown during a selection and the person clicks another row
- **THEN** that object is selected and its properties are shown

#### Scenario: Selecting on the canvas while the list is shown

- **WHEN** the list is shown and the person clicks another element on the canvas
- **THEN** the inspector shows Properties for the new selection

### Requirement: Tab moves the selection between objects on screen

With focus on the canvas and no edit in progress, Tab SHALL select the next
mounted managed object in list order and Shift+Tab the previous one, wrapping
around. With nothing selected, Tab SHALL select the first. Tab SHALL do nothing
when no managed object is mounted, and SHALL NOT be taken from text fields or
panel controls.

#### Scenario: Cycling through objects

- **WHEN** the canvas has focus and the person presses Tab repeatedly
- **THEN** each mounted object is selected in turn, in list order, wrapping at the end

#### Scenario: Editing text

- **WHEN** inline text editing is active and Tab is pressed
- **THEN** the selection does not change
