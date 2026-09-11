## MODIFIED Requirements

### Requirement: The rail lists the sections and flags a waiting update

The rail SHALL list Project, Account, Appearance, Behavior, Hotkeys, Stock media, Updates, AI Accounts and Feedback, each with a one-line description shown as the heading of the section it opens, and SHALL mark the open one. The Updates row SHALL carry a dot whenever a release is waiting, so the page never hides it.

#### Scenario: Switching section

- **WHEN** the person picks a row in the rail
- **THEN** that section's heading, description and body replace the column on the right

#### Scenario: A release is waiting

- **WHEN** a newer release has been found
- **THEN** the Updates row carries a marker announcing that an update is available

## ADDED Requirements

### Requirement: Hotkeys lists every shortcut and changes none

Hotkeys SHALL list every keyboard shortcut the studio binds, grouped as Studio, Project, View and Video, each row naming the command and showing its keys in the platform's glyphs. The section SHALL be read-only: no shortcut can be changed, cleared or added from it, and the list SHALL be the same table the palette and the menus read.

#### Scenario: Reading the list

- **WHEN** the person opens Hotkeys
- **THEN** Export is listed under Video with ⌘E, and the next video with ⌥⌘↓

#### Scenario: Nothing to edit

- **WHEN** the person looks for a way to change a shortcut
- **THEN** there is none; the rows carry no control
