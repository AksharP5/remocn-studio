## ADDED Requirements

### Requirement: Every turn is served all three servers

The studio SHALL hand every turn the design, library and pipeline servers, whatever the provider.

#### Scenario: A turn starts

- **WHEN** a turn starts
- **THEN** its CLI is given the design, library and pipeline servers
- **AND** the pipeline tools are in the agent's catalog

## REMOVED Requirements

### Requirement: A Free turn is served no pipeline server

**Reason**: No paid plan remains (REM-520), so no turn has the pipeline server withheld.

**Migration**: Replaced by `Every turn is served all three servers`.
