## ADDED Requirements

### Requirement: The active stage's instructions ride on the turn

While a stage is active the turn SHALL carry that stage's brief: its title, the stages already done, its goal, its done-condition, the files to write, its checklist where it has one, and the discovery order.

#### Scenario: A stage is active

- **WHEN** a turn starts in a chat with an active stage
- **THEN** the brief is appended to the turn's instructions with the video's own folder substituted into every path it names

#### Scenario: No stage

- **WHEN** no stage is active
- **THEN** no brief is attached and the turn is an ordinary one

## REMOVED Requirements

### Requirement: The active stage's instructions ride on a Pro turn

**Reason**: No paid plan remains (REM-520), so the brief no longer depends on one, and the old scenario *No stage, or Free* has no Free half left.

**Migration**: Replaced by `The active stage's instructions ride on the turn`, which attaches the brief to every turn with an active stage.
