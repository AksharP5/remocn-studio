## ADDED Requirements

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
