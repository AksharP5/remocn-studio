## ADDED Requirements

### Requirement: Linux attention survives the absence of a Dock

The Linux studio SHALL display its waiting count and export status in the native window title. It SHALL retain the same unread markers and opt-in notifications. Clicking a Linux notification SHALL raise the studio without guessing a chat.

#### Scenario: A permission is waiting

- **WHEN** a card is waiting on Linux
- **THEN** the count is visible in the window title even on a desktop without a Dock

#### Scenario: The notification service is unavailable

- **WHEN** a Linux notification cannot be sent
- **THEN** the transport reports its failure and in-app attention remains intact
