## ADDED Requirements

### Requirement: The key comes from the environment and only its presence crosses back
The API key SHALL be held by the sidecar, taken from `REMOCN_STUDIO_PEXELS_KEY` — the key the build ships being the value that variable carries in a release. The webview SHALL be able to ask whether stock search is configured; it SHALL NOT be able to set a key, forget one, or read one back, and the key SHALL NOT reach the agent.

#### Scenario: Asking whether stock search is configured
- **WHEN** the webview asks about stock search
- **THEN** it learns only whether a key is available, never its value

#### Scenario: The environment names no key
- **WHEN** no key is named in the environment
- **THEN** stock search reports itself unconfigured

#### Scenario: A key stored by an earlier version
- **WHEN** a key file written by an earlier version of the studio is present
- **THEN** it is ignored, and only the environment decides whether stock search is configured

## MODIFIED Requirements

### Requirement: The pane says what is missing before it says nothing was found
The stock view SHALL distinguish four states: no key, an empty query, a search that found nothing, and a search that failed. With no key it SHALL say stock search is unavailable in this build and name `REMOCN_STUDIO_PEXELS_KEY` as what supplies one, and SHALL offer nothing to open.

#### Scenario: No key is configured
- **WHEN** the stock view is opened with no key
- **THEN** it says stock search is unavailable because no Pexels key is configured, and names the environment variable that supplies one
- **AND** no request is made
- **AND** nothing offers to open Settings

#### Scenario: The field is empty
- **WHEN** no query has been typed
- **THEN** the view explains that results land in the library with their licence and author remembered, rather than showing an empty grid

#### Scenario: A query matches nothing
- **WHEN** the search answers with no items
- **THEN** the view says nothing on Pexels matches that query, naming it

### Requirement: A refused or failing search is worded, never raw
The studio SHALL word the three failures the API distinguishes: a key that was refused, a key that is being rate-limited, and any other status. A page entry that does not decode SHALL be dropped from the results rather than failing the whole page. No wording SHALL send the person to Settings to change a key.

#### Scenario: The key is refused
- **WHEN** the search is answered with an unauthorised or forbidden status
- **THEN** the message says Pexels refused the key this build is using, and does not offer to change it

#### Scenario: The key is rate-limited
- **WHEN** the search is answered with a too-many-requests status
- **THEN** the message says the key is being rate-limited and to try again in a minute

#### Scenario: One result in a page is malformed
- **WHEN** an entry in the answer cannot be read, or a clip names no downloadable file
- **THEN** that entry is left out and the remaining results are shown

## REMOVED Requirements

### Requirement: The key lives in the sidecar and only its presence crosses back

**Reason**: The webview can no longer set or forget a key, so the requirement that described a key being written into the library folder and taken back out no longer describes anything the studio does. What survives of it — the sidecar holds the key, only its presence crosses back, the agent never sees it — is restated as *The key comes from the environment and only its presence crosses back*.

**Migration**: None for the person: stock search keeps working on the key the build ships. A key stored by an earlier version is ignored rather than migrated, and a different key is supplied through `REMOCN_STUDIO_PEXELS_KEY`.
