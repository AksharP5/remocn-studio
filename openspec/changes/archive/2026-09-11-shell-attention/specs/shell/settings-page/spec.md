## MODIFIED Requirements

### Requirement: The rail lists the sections and flags a waiting update

The rail SHALL list Project, Account, Appearance, Behavior, Notifications, Stock media, Updates, AI Accounts and Feedback, each with a one-line description shown as the heading of the section it opens, and SHALL mark the open one. The Updates row SHALL carry a dot whenever a release is waiting, so the page never hides it.

#### Scenario: Switching section

- **WHEN** the person picks a row in the rail
- **THEN** that section's heading, description and body replace the column on the right

#### Scenario: A release is waiting

- **WHEN** a newer release has been found
- **THEN** the Updates row carries a marker announcing that an update is available

## ADDED Requirements

### Requirement: Notifications is a section with one master switch, a way to permission, and a switch per event

Notifications SHALL offer a master switch that turns every notification on or off, a *Grant permission* button shown whenever macOS has not allowed the studio to notify, and one switch per event — a turn that ended, the agent waiting for an answer, an export that finished or failed, the studio's helper stopping — each on until turned off and shown as off while the master switch is off. The master switch and every event switch SHALL be remembered, so turning the master switch back on restores each event's own choice. *Grant permission* SHALL ask macOS when it has never been asked and SHALL open the studio's row in System Settings when macOS has already refused; see `shell/attention`.

#### Scenario: Turning notifications on for the first time

- **WHEN** the master switch is turned on and macOS has never been asked
- **THEN** macOS asks whether the studio may notify, and the section reads as on only if the answer is yes

#### Scenario: Permission is missing

- **WHEN** the section opens and macOS has not allowed the studio to notify
- **THEN** a *Grant permission* button is shown with a line saying why nothing will arrive until it is pressed

#### Scenario: macOS refused

- **WHEN** *Grant permission* is pressed and macOS has already refused
- **THEN** the studio's row in System Settings opens, and the line says notifications are off there

#### Scenario: The master switch goes off

- **WHEN** the master switch is turned off
- **THEN** every event switch reads as off and cannot be changed, and turning the master switch back on shows each event's own choice again

#### Scenario: One event turned off

- **WHEN** the switch for exports is turned off
- **THEN** an export that finishes posts nothing while a turn that ends still does

#### Scenario: No notification transport

- **WHEN** the page runs without the Tauri core
- **THEN** the master switch is unavailable, with the reason worded beside it, and *Grant permission* is not shown
