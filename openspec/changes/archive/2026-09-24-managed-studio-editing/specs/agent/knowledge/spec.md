## ADDED Requirements

### Requirement: New videos declare managed editable objects

The studio SHALL provide a versioned managed runtime and example document, and SHALL instruct generation to bind every intended editable object to independent stable data. Existing video conversion SHALL preserve existing visual behavior and IDs where present.

#### Scenario: A new video is generated
- **WHEN** the agent creates new video content
- **THEN** its editable objects have explicit definitions and values in the canonical document

#### Scenario: An old video is edited
- **WHEN** the existing video is not managed
- **THEN** conversion is treated as an explicit source change, never a silent source rewrite

