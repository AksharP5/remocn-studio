## ADDED Requirements

### Requirement: Native runtime failures retain their cause

The native preview SHALL preserve a nonempty runtime failure message in its failed state, falling back to its generic render failure when no readable message is provided.

#### Scenario: A running composition fails

- **WHEN** the active native runtime reports a failure with a readable cause
- **THEN** the preview shows that cause so the project can be corrected

### Requirement: Native looped media waits for a usable duration

The native preview SHALL defer a loaded-metadata event reporting zero duration until the media reports a positive duration, including unbounded live duration. It SHALL release its event handlers with the runtime.

#### Scenario: Audio metadata settles after a rebuild

- **WHEN** connected audio initially reports zero duration after a native rebuild
- **THEN** the preview remains usable without passing that zero to Remotion's loop
- **AND** the metadata event is delivered once when a positive duration arrives
