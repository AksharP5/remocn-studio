## ADDED Requirements

### Requirement: Linux consent uses the native app data location

The Linux core SHALL read crash consent from the same XDG application data location as the settings store, before building the app. Missing, malformed or disabled consent SHALL send nothing.

#### Scenario: No consent file

- **WHEN** Linux starts with no settings file
- **THEN** the core sends no crash report
