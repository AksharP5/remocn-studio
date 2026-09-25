## ADDED Requirements

### Requirement: A queued message is captured whole, and re-reads only its mode and provider

The studio SHALL capture a queued message complete at the moment it was written — its text, images, media, assets, element references, the model, the effort, the project, the video and the frame the preview was paused on — and SHALL re-read only the permission mode and the provider at the moment it is dispatched.

#### Scenario: A queued message goes out

- **WHEN** a queued message is dispatched
- **THEN** it carries the frame and the settings it was written under, and the mode and provider of the chat as they stand when the turn that just ended settled

#### Scenario: A queued message is taken back

- **WHEN** the person clicks a queued row while the composer is empty
- **THEN** the row leaves the queue and its whole content is restored into the composer
- **AND** clicking a row while the composer holds a draft does nothing

## REMOVED Requirements

### Requirement: A queued message is captured whole

**Reason**: The scenario about the plan changing while a message is queued has nothing left to describe. A MODIFIED block cannot drop a scenario, so the requirement is restated under a new name.

**Migration**: Replaced by `A queued message is captured whole, and re-reads only its mode and provider`, which carries the same text and scenarios minus the plan one.
