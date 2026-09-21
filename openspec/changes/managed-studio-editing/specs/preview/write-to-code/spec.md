## ADDED Requirements

### Requirement: Managed values bypass JSX call-site edits

Managed property edits SHALL address the video object document rather than a shared JSX call site. Existing unmanaged Studio videos SHALL keep their legacy code editing path until explicitly converted.

#### Scenario: Repeated components
- **WHEN** one managed card among repeated cards is edited
- **THEN** only its object values change

#### Scenario: A field is unsupported
- **WHEN** a definition uses an unsupported field type
- **THEN** the managed contract is refused instead of silently dropping the field

