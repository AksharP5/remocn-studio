## ADDED Requirements

### Requirement: An update leaves nothing of the old account behind

On a launch that finds a plan cache left by an earlier version, the core SHALL delete the remocn session token from the login keychain and then delete the cache. The token is `com.remocn.remocn-studio` / `session-token`, and the cache is `entitlement.json` in the app's data folder. It SHALL do this once, SHALL send nothing to any server, and SHALL NOT show the person anything. It SHALL NOT touch any other keychain item under the same service, since the integrations keep their secrets there.

#### Scenario: Updating from a version that was signed in

- **WHEN** the studio starts and `entitlement.json` exists in its data folder
- **THEN** the `session-token` keychain item is deleted and `entitlement.json` is removed
- **AND** no request is made and nothing is shown

#### Scenario: A later launch

- **WHEN** the studio starts and `entitlement.json` does not exist
- **THEN** the keychain is not touched

#### Scenario: There is no token to delete

- **WHEN** the cache exists but the keychain holds no `session-token` item
- **THEN** the cache is still removed, and the missing item is not an error

#### Scenario: The keychain refuses

- **WHEN** deleting the token fails for any other reason
- **THEN** the failure is logged, the cache is still removed so the attempt is not repeated on every launch, and the studio starts normally

#### Scenario: Integration secrets are left alone

- **WHEN** the cleanup runs on a Mac with Figma or ElevenLabs connected
- **THEN** every `integration:<connectionId>` item is still in the keychain afterwards
