## ADDED Requirements

### Requirement: Managed selection follows object identity

For managed videos the studio SHALL select declared semantic roots and preserve the selected object ID through rebuilds and temporary unmounts.

#### Scenario: Text is split into letters
- **WHEN** a letter inside a managed heading is picked
- **THEN** the heading object is selected

#### Scenario: The selected object is deleted
- **WHEN** the next valid catalogue no longer contains the ID
- **THEN** selection is cleared rather than moved to another object

