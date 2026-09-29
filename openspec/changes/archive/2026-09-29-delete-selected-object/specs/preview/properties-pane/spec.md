## MODIFIED Requirements

### Requirement: Managed properties use task-oriented presentation

The header SHALL contain one DialKit element selector, Delete, Undo and close actions with
labels, and compact save status. The body SHALL separate Appearance and Animation
with keyboard-accessible tabs. Generated field labels SHALL be readable English;
stored IDs and explicitly authored labels SHALL remain unchanged. Unknown fields
SHALL remain accessible rather than being discarded by presentation heuristics.

#### Scenario: Editing a heading
- **WHEN** a heading exposes typography, colors, layout and motion
- **THEN** Appearance shows its text, colors and layout while Animation shows timing and motion controls
- **AND** X/Y and width/height can share rows, with secondary text spacing and Bezier coordinates disclosed separately

#### Scenario: Spring controls
- **WHEN** an object exposes a boolean spring switch and physical spring parameters
- **THEN** the physical settings are available while that switch is enabled

#### Scenario: Switching tabs with a draft
- **WHEN** the user switches property categories with pending edits
- **THEN** the edits are committed through the existing managed save path

## ADDED Requirements

### Requirement: The header offers Delete, and says when it cannot

The header SHALL offer Delete for the open object, managed or not, with the behaviour of `preview/inspect`. Pending drafts SHALL be discarded rather than saved when the object is deleted. When the open element is one of several instances drawn from one place in the code, the action SHALL read *Delete all N*. When deletion is impossible — a scene, an object not painted at the current frame, an element whose place in the code the studio cannot find, or a managed video on a runtime that cannot remove — the action SHALL be disabled and SHALL say why.

#### Scenario: One of four cards from one line

- **WHEN** the pane is open on the second of four cards drawn from the same call site
- **THEN** the action reads *Delete all 4*, and choosing it removes the line that draws them

#### Scenario: An element with no place in the code

- **WHEN** the open element's call site could not be found
- **THEN** Delete is disabled and says the studio could not find this element in the code

#### Scenario: Deleting with a draft

- **WHEN** a value is mid-edit and Delete is chosen
- **THEN** the draft is dropped, no property operation is written, and the object is removed
