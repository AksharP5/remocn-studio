## MODIFIED Requirements

### Requirement: Settings takes the window and the shell stays alive underneath

Settings SHALL cover the whole window with a section rail on the left and one readable column on the right, with nothing floating over the shell and nothing dimmed behind it. It SHALL crossfade in and out briefly and without moving, like switching a tab rather than opening a window. The shell SHALL stay mounted underneath and SHALL take no keys and no focus while Settings is open, and the preview's page, a running turn and the sidecar's connection SHALL be exactly where they were when Settings closes.

#### Scenario: Opening Settings during a turn

- **WHEN** Settings is opened while a turn is running
- **THEN** the turn keeps running and its transcript keeps growing underneath
- **AND** closing Settings returns to it with nothing reloaded

#### Scenario: Reaching the shell while Settings is up

- **WHEN** the person tabs or clicks where the shell would be
- **THEN** nothing in the shell receives the key or the click

#### Scenario: The page is named

- **WHEN** assistive technology reads the window
- **THEN** the page is one region named Settings, not a dialog

#### Scenario: Closing Settings

- **WHEN** Settings is closed
- **THEN** it fades out over the shell in a fraction of a second and takes no clicks while it fades
