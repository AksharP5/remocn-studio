## MODIFIED Requirements

### Requirement: Managed selection follows object identity

For managed videos the studio SHALL select declared semantic roots and preserve the selected object ID through rebuilds and temporary unmounts.

#### Scenario: Text is split into letters
- **WHEN** a letter inside a managed heading is picked
- **THEN** the heading object is selected

#### Scenario: The selected object is deleted
- **WHEN** the next valid catalogue no longer contains the ID, or marks it or one of its ancestors removed
- **THEN** selection is cleared rather than moved to another object

## ADDED Requirements

### Requirement: Delete removes the selected object

With an object selected, Delete or ⌫ on the canvas, Delete in the context menu a right-click on the object opens, and Delete in its Layers row's context menu SHALL remove it; the properties header offers the same action (see `preview/properties-pane`). The object SHALL disappear from the preview at once, before anything is written, and SHALL NOT be painted again by the rebuild that follows. The selection SHALL clear. A managed object is removed in its document (see `preview/managed-objects`); an element outside the catalogue is removed from its call site in the code (see `preview/write-to-code`). The action SHALL be available only for an object painted at the current frame, and SHALL be refused for a scene. The keys SHALL NOT be taken while inline text editing is active, from text fields or from panel controls, nor with ⌘, Ctrl or Alt held.

#### Scenario: Deleting from the canvas

- **WHEN** a mounted heading is selected and the canvas has focus and ⌫ is pressed
- **THEN** the heading vanishes at once, the selection clears and its row leaves Layers

#### Scenario: Right-clicking an object on the canvas

- **WHEN** the person right-clicks a mounted object on the canvas
- **THEN** the object is selected as a click would select it, and a menu opens with Delete
- **AND** choosing Delete removes it exactly as ⌫ does

#### Scenario: Right-clicking where nothing can be deleted

- **WHEN** the person right-clicks a scene, empty canvas, or an element the studio cannot delete
- **THEN** no menu opens, or Delete in it is disabled, and nothing is removed

#### Scenario: Right-clicking while editing text

- **WHEN** inline text editing is active and the person right-clicks the text
- **THEN** the system text menu opens rather than the object menu

#### Scenario: Deleting from Layers

- **WHEN** the person opens a mounted object's row menu in Layers and chooses Delete
- **THEN** that object is removed exactly as from the canvas

#### Scenario: Typing in the inline editor

- **WHEN** inline text editing is active and ⌫ is pressed
- **THEN** a character is deleted and the object stays

#### Scenario: A scene row

- **WHEN** the person opens a scene row's menu
- **THEN** Delete is shown disabled, saying a scene cannot be deleted because its place on the timeline lives in the code

#### Scenario: An object not on screen

- **WHEN** the person opens the menu of a dimmed row, or of an object with nothing painted such as a soundtrack
- **THEN** Delete is shown disabled, saying to move to a frame where the object is on screen

#### Scenario: The removal cannot be saved

- **WHEN** the write behind a removal is refused
- **THEN** the object reappears where it was, stays selected, and a sentence says why

### Requirement: ⌘Z on the canvas undoes the video's last change

With focus on the canvas and no edit in progress, ⌘Z SHALL undo the most recent undoable change to the open video made in the studio — a property edit, a gesture or a removal — with the same checks as the properties header's Undo. It SHALL NOT be taken from text fields or panel controls. After a removal a notice naming the object SHALL offer Undo for ten seconds.

#### Scenario: Undoing a removal

- **WHEN** the person deletes a managed object and presses ⌘Z
- **THEN** the object is back where it was with its values, and is selected again

#### Scenario: Undoing a code removal

- **WHEN** the person deletes an element from the code and presses ⌘Z
- **THEN** the file is back to its previous text and the element is drawn again after the rebuild, without a selection

#### Scenario: The order of Undo

- **WHEN** a property edit is saved after an element was deleted from the code
- **THEN** the first ⌘Z undoes the property edit and the second the deletion

#### Scenario: The notice after a removal

- **WHEN** an object is deleted
- **THEN** a notice reads *Deleted "Subtitle"* with Undo, and pressing Undo does what ⌘Z does

#### Scenario: Undo is no longer possible

- **WHEN** the undo's precondition fails because the document or the file changed since
- **THEN** nothing changes and a sentence says the video changed since the deletion

### Requirement: Removed objects leave the object list

The object list SHALL NOT show an object that is removed or sits under a removed ancestor, and Tab SHALL NOT select one. Restoring it SHALL return its row to its old place.

#### Scenario: A removed group

- **WHEN** a group is removed
- **THEN** its row and its children's rows leave the list, and Tab skips them
