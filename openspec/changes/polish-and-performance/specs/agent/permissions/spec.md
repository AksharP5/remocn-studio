## MODIFIED Requirements

### Requirement: Remembered approvals live only in the running studio

The studio SHALL remember an "always allow" only for the exact call it was given for, only for the life of the sidecar process, and SHALL NOT write it to disk or remember a denial. The card SHALL name that lifetime truthfully — *Always allow until quit* — and SHALL NOT call it a session.

#### Scenario: The same command again

- **WHEN** a call whose exact signature was approved with *Always allow until quit* is made again
- **THEN** it runs with no card, in any chat of that studio run

#### Scenario: A denial

- **WHEN** a call is declined
- **THEN** nothing is remembered, and the same call asks again

#### Scenario: The sidecar restarts

- **WHEN** the sidecar restarts or the app is relaunched
- **THEN** every remembered approval is gone
