## Purpose

Provides persistent, independently addressable editable objects for Studio-generated videos without replacing React rendering.

## ADDED Requirements

### Requirement: A managed video has a validated independent object catalogue

The studio SHALL read a versioned catalogue independently of the current frame and SHALL reject duplicate IDs, missing definitions, parent cycles and invalid values without altering the source.

#### Scenario: An object is outside the frame
- **WHEN** a managed object is not mounted
- **THEN** its declared properties remain available in the catalogue

#### Scenario: An invalid document is read
- **WHEN** the document is malformed or incompatible
- **THEN** a descriptive failure is shown and no data is rewritten

### Requirement: Managed edits are checked and idempotent

The studio SHALL save one completed property operation directly, checking the addressed value and definition, preserving unrelated fields, and recording its operation ID atomically with the change. Undo SHALL apply the inverse with the same preconditions.

#### Scenario: An independent concurrent edit
- **WHEN** another writer changes a different property
- **THEN** both changes survive

#### Scenario: A conflicting edit
- **WHEN** the addressed value or definition changed
- **THEN** the operation is refused and the newer data remains intact

### Requirement: An operation retry has one result

The studio SHALL remember completed operation IDs in the document and reject reusing an ID for different contents.

#### Scenario: An answer was lost
- **WHEN** the same completed operation is retried
- **THEN** it is not applied twice

#### Scenario: An ID is reused incorrectly
- **WHEN** an existing operation ID carries different contents
- **THEN** it is refused

