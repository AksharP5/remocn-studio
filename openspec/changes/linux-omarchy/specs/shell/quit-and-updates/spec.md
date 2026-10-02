## ADDED Requirements

### Requirement: The Linux fork updates within its own release channel

The Linux fork SHALL check its own GitHub release manifest and verify the signed AppImage with its own public key. Installation SHALL replace the user-local AppImage and restart, retaining app data.

#### Scenario: Updating the installed fork

- **WHEN** a newer signed Linux release is installed
- **THEN** the same launcher starts that release and existing projects and chats remain

#### Scenario: Verification fails

- **WHEN** a download cannot be verified with the fork's key
- **THEN** it is not installed and the currently installed app remains usable
