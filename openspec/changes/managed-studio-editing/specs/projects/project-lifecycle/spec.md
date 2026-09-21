## ADDED Requirements

### Requirement: New folder imports require Studio provenance

The studio SHALL refuse a new external folder lacking Studio identity while preserving access to existing registered projects and creation through Studio.

#### Scenario: A Studio project is opened
- **WHEN** the folder carries its Studio manifest
- **THEN** it can be registered subject to identity checks

#### Scenario: An arbitrary external folder is opened
- **WHEN** the folder is neither registered nor a Studio project
- **THEN** it is refused without writing into it

