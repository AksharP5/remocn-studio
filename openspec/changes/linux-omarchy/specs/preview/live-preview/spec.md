## ADDED Requirements

### Requirement: Native runtime failures retain their cause

The native preview SHALL preserve a nonempty runtime failure message in its failed state, falling back to its generic render failure when no readable message is provided.

#### Scenario: A running composition fails

- **WHEN** the active native runtime reports a failure with a readable cause
- **THEN** the preview shows that cause so the project can be corrected
