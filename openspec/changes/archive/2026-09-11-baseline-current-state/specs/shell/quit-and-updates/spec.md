## Purpose

Leaving the studio and replacing it: the guard that stops a quit while a turn is running, and the in-place update that downloads a newer release from the studio's own GitHub releases, installs it and restarts the app.

## ADDED Requirements

### Requirement: A quit is prevented until the webview has answered

Closing the window and quitting the app SHALL both be prevented by the core until the webview has said the quit may go ahead, and the core SHALL tell the webview that a quit was asked for. The core SHALL hold the flag that lets the confirmed attempt through, so that the app's own exit is never blocked by its own guard.

#### Scenario: Pressing the window's close button

- **WHEN** the person closes the window or quits the app
- **THEN** the close is prevented and the webview is told a quit was requested

#### Scenario: Nothing is in flight

- **WHEN** the webview is told and no turn is running
- **THEN** it asks the core to quit at once and the app exits

#### Scenario: The app exits

- **WHEN** the app is exiting
- **THEN** the sidecar is shut down as part of the exit

### Requirement: Quitting while a turn runs asks first

With at least one turn running, the quit SHALL raise a confirmation naming what is lost — turns are stopped where they are, whatever has already been written to disk stays, and the block being streamed is lost — offering *Keep working* and *Quit*.

#### Scenario: Quitting mid-turn

- **WHEN** a quit is requested while a turn is running
- **THEN** the confirmation appears and the app does not exit

#### Scenario: Keeping working

- **WHEN** *Keep working* is chosen
- **THEN** the confirmation closes and the app carries on with the turn untouched

#### Scenario: Quitting anyway

- **WHEN** *Quit* is chosen
- **THEN** the app exits without asking again

### Requirement: Updates come from the studio's own newest release

The studio SHALL check its own GitHub releases for a build newer than the one running, reading the manifest published with the newest release that is neither a draft nor a prerelease. The check SHALL be verified against the studio's own signing key before anything is installed.

#### Scenario: A newer release exists

- **WHEN** the check finds a newer release
- **THEN** its version, date and notes are read back and offered

#### Scenario: Nothing newer

- **WHEN** the check finds nothing newer
- **THEN** the studio reports this is the newest release

### Requirement: A development build never checks

A development build SHALL NOT check for updates, on launch or on demand, and SHALL say plainly that it updates when it is rebuilt. The check button SHALL be unavailable and SHALL carry that reason.

#### Scenario: Running from a development build

- **WHEN** the studio is a development build
- **THEN** no check is made and the summary reads that this build updates when it is rebuilt
- **AND** *Check now* is unavailable with that sentence on it

#### Scenario: A production build launches

- **WHEN** the studio is a production build and has not checked in this run
- **THEN** it checks once, on its own, without being asked

### Requirement: A missing build reading is not an error

Until the core has answered which build this is, the studio SHALL report that it is waiting for the core rather than showing a transport failure, and SHALL leave the check unavailable. A check that genuinely fails SHALL surface its message where the person asked for the check, and SHALL NOT put a banner on the shell.

#### Scenario: No core to ask

- **WHEN** the page runs without the Tauri core
- **THEN** the row reads that it is waiting for the core
- **AND** no error message is shown

#### Scenario: The check fails

- **WHEN** a check fails
- **THEN** its message is shown in the update surface only
- **AND** the app is otherwise unchanged

### Requirement: Download progress is folded into one reading

Progress SHALL be accumulated from the download's own events into a received count and, where the response declared one, a total. A download with no declared length SHALL report the bytes received rather than a percentage, and a finished download whose length was declared SHALL settle its received count on that total.

#### Scenario: A measured download

- **WHEN** the download declares its length and chunks arrive
- **THEN** the reading is the sum of the chunks against that length, as a whole percentage capped at a hundred

#### Scenario: An unmeasured download

- **WHEN** the download declares no length
- **THEN** the reading is the megabytes received, with no percentage

#### Scenario: A second download begins

- **WHEN** a new download starts after an earlier one
- **THEN** the count restarts from zero with the new total

#### Scenario: The download finishes

- **WHEN** the download reports it has finished
- **THEN** a measured download settles on its total, and an unmeasured one is left as it was

### Requirement: Installing replaces the build and restarts the studio

Installing SHALL download and install the update and then restart the app. The restart SHALL pass the quit guard and SHALL shut the sidecar down before it relaunches. A second install SHALL NOT be startable while one is running.

#### Scenario: Installing

- **WHEN** the person installs the waiting release
- **THEN** progress is reported while it downloads
- **AND** the app restarts into the new build when it lands

#### Scenario: The install fails

- **WHEN** the download or the install fails
- **THEN** progress is cleared, the failure's message is shown, and the app keeps running the build it has

#### Scenario: Pressing install twice

- **WHEN** install is pressed while an install is already running
- **THEN** nothing further is started

### Requirement: One update reading, two surfaces

The sidebar's version row and Settings' Updates section SHALL read one state, and SHALL NOT disagree about which release is waiting, whether a check is running, or how far a download has got.

#### Scenario: Checking from one surface

- **WHEN** a check is started from either surface
- **THEN** both show that a check is running and both show its result

#### Scenario: A release is waiting

- **WHEN** a release has been found
- **THEN** the sidebar row offers to update to that version and the Settings rail carries its marker
