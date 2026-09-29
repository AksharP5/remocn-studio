## ADDED Requirements

### Requirement: Removing an element is written on the gesture, not at Send

Deleting an element outside the catalogue SHALL remove its call site from the code immediately, through the project's own codemods, in the process that resolves them, which SHALL answer with the file's new text and SHALL NOT write it. The sidecar SHALL write it under the containment checks of every other code write. A call site that draws several instances SHALL be removed whole. When the call site's line starts more than one element, or the codemod would remove something other than the picked component, the studio SHALL refuse rather than guess. The write SHALL NOT wait for a message and SHALL start no turn. The next turn in the project SHALL tell the agent which element was deleted and where.

#### Scenario: Deleting a badge

- **WHEN** the person deletes a badge whose call site is `<Badge … />` in a scene file
- **THEN** that element is gone from the file and nothing else in it changes
- **AND** no turn starts

#### Scenario: A call site inside a condition or a list

- **WHEN** the call site is the right side of `&&`, a branch of a ternary or the body of a `.map` callback
- **THEN** the element is replaced by `null` there, and the code still compiles

#### Scenario: A line that starts several elements

- **WHEN** the picked `<Badge />` shares its line with an element Remotion's codemod finds instead, as in `{show ? <Badge /> : <Card />}`, or the line starts two `<Badge />`
- **THEN** nothing is written, the element reappears, and a sentence says the studio cannot tell which one was picked

#### Scenario: The agent is told

- **WHEN** an element was deleted from the code and the next turn in that project starts
- **THEN** the turn carries a note naming the component and its file and line, saying the person removed it and it must not be added back

#### Scenario: The code no longer has the element

- **WHEN** the file changed since the pick and the call site is no longer where the pick recorded it
- **THEN** nothing is written, the element reappears, and a sentence asks the person to pick it again

#### Scenario: A file outside the project

- **WHEN** the call site resolves outside the opened project folder
- **THEN** nothing is written and a sentence names the path

#### Scenario: A turn is writing to the video

- **WHEN** a turn is running in the video's chat
- **THEN** Delete on an element outside the catalogue is disabled until the turn ends, saying the agent is editing this video

### Requirement: Undoing a code removal puts the previous text back

Undo of a code removal SHALL write back the file's text from before the removal only when the file still holds exactly the text the removal wrote, and SHALL otherwise refuse with a sentence and change nothing. The previous text SHALL be held for as long as the app window stays open.

#### Scenario: Undo right after

- **WHEN** the person deletes an element and presses ⌘Z
- **THEN** the file is back to its previous text and the element is drawn again

#### Scenario: The file changed since

- **WHEN** the agent or an editor changed the file after the removal
- **THEN** Undo is refused with a sentence saying the file changed since, and the file is left as it is
