## ADDED Requirements

### Requirement: Snapshot is offered whenever it can work, and says why not

The Snapshot button SHALL carry the reason it is unavailable on its tooltip rather than being silently dead, and SHALL remain focusable so that reason can be read. It SHALL be unavailable while the preview pane is hidden, while the pane is showing documents, with no Project open, with the Project's folder missing, while a permission card is waiting to be answered, while the preview is not yet serving, and when the preview is showing a different Project from the open chat's.

#### Scenario: Nothing is in the way

- **WHEN** the preview is visible and serving the open chat's Project, and no permission card is waiting
- **THEN** Snapshot can be armed, with no account, sign-in or plan involved

#### Scenario: The preview has not compiled yet

- **WHEN** the preview is still building
- **THEN** the tooltip reads *The preview is not running yet.*

#### Scenario: A permission card is waiting

- **WHEN** a turn is waiting on a permission card
- **THEN** the tooltip reads *Answer the approval request first.*

#### Scenario: The pane is showing documents

- **WHEN** the pane's mode is Docs
- **THEN** the Snapshot button is not in the header at all, and anything armed is disarmed

## REMOVED Requirements

### Requirement: Snapshot is offered only when it can work, and says why not

**Reason**: The plan is no longer a reason for Snapshot to be unavailable (REM-520), and a MODIFIED block cannot drop the *The plan is Free* scenario.

**Migration**: Replaced by `Snapshot is offered whenever it can work, and says why not`, which has the same reasons minus the plan.
