## Purpose

Where a connection's secret lives and who may touch it: one keychain entry per connection, the
desktop authorization trips that produce it, and the rule that the secret never leaves the
process that makes the request.

## ADDED Requirements

### Requirement: The secret lives in the keychain, apart from what describes the connection

Each connection's secret SHALL be held as its own entry in this Mac's keychain, and what the
studio stores about the connection SHALL carry only a reference to that entry — never the secret
itself. Removing a connection SHALL remove its entry.

#### Scenario: A connection is created

- **WHEN** a connection's secret is accepted
- **THEN** it is written to a keychain entry of its own and the stored connection carries only the reference

#### Scenario: A connection is removed

- **WHEN** a connection is removed
- **THEN** its keychain entry is deleted, and a later read of that reference finds nothing

#### Scenario: Two connections of one service

- **WHEN** two connections of the same service each hold a secret
- **THEN** each has its own entry, and replacing one leaves the other untouched

### Requirement: The secret is never handed to anything that does not make the request

The secret SHALL be read only by the part of the studio that issues the request to the service.
It SHALL NOT be placed in a message to the webview, written to a log, written into the person's
project, included in a turn's transcript, or shown to a model. A secret that has been saved
SHALL NOT be readable back by the interface that set it.

#### Scenario: The interface asks about a saved secret

- **WHEN** the interface asks about a connection that holds a secret
- **THEN** it learns only that one is held, never its value

#### Scenario: A request to a service is logged

- **WHEN** a request to a service is logged
- **THEN** the log carries the service, the connection and the outcome, and no credential material

### Requirement: A secret that cannot be stored makes no connection

When the keychain refuses to hold a secret, the studio SHALL say the keychain refused, SHALL NOT
create the connection, and SHALL NOT report a connection as saved.

#### Scenario: The keychain refuses

- **WHEN** the keychain refuses to write
- **THEN** the failure is shown as a sentence and no connection appears in the list

### Requirement: Browser authorization is a trip the person can abandon

Where a provider authorizes in a browser, the studio SHALL open the person's own browser,
SHALL listen for the answer on this Mac only, and SHALL carry whatever proof of origin that
provider requires. A trip that is cancelled, that times out, or that the person never finishes
SHALL leave the connection in a stated failure, never waiting forever.

#### Scenario: The person closes the browser

- **WHEN** the person abandons the authorization and comes back to the studio
- **THEN** the attempt ends with a sentence saying it was not completed, and no connection is left pending

#### Scenario: The trip takes too long

- **WHEN** no answer arrives within the time the studio waits
- **THEN** the attempt ends as timed out and can be started again

#### Scenario: An answer from a different attempt

- **WHEN** an answer arrives that does not match the attempt in progress
- **THEN** it is ignored, and the attempt in progress is neither completed nor failed by it

### Requirement: Re-authorizing touches one connection and no other

Authorizing again SHALL replace the secret of the connection it was started for, and SHALL NOT
change the account, the secret or the state of any other connection — including another
connection of the same provider.

#### Scenario: Reconnecting one of two accounts

- **WHEN** one of two connections to the same service is reconnected
- **THEN** only that connection's secret and account are updated

#### Scenario: Reconnecting lands on a different account

- **WHEN** the person authorizes as an account other than the one the connection names
- **THEN** the studio says the account does not match and does not silently rebind the connection

### Requirement: Refreshing a credential happens once at a time, and is stored before it is used

Where a provider can refresh a credential, the studio SHALL refresh it without the person, SHALL
allow only one refresh of a connection at a time, and SHALL store the new credential before
relying on it. Where a provider offers no refresh, an expired credential SHALL put the connection
into needing authorization with a sentence asking for a new key.

#### Scenario: Two operations meet an expired credential together

- **WHEN** two operations on one connection both find the credential expired
- **THEN** the credential is refreshed once and both operations continue with it

#### Scenario: A key that cannot be refreshed expires

- **WHEN** a key with no refresh is rejected as expired
- **THEN** the connection asks for a replacement key, naming the service

### Requirement: No shared studio credential travels in the application

A credential belonging to the studio rather than to the person SHALL NOT be shipped inside the
application for a connection to use. Where a provider can only be reached with a registered
application's credential, the studio SHALL require the person's own and SHALL say so before the
connection is attempted.

#### Scenario: A provider that demands a registered application

- **WHEN** a service can only be connected with a registered application's own credential
- **THEN** the flow asks the person for theirs and explains why, rather than using one of the studio's

### Requirement: Removal is local and honest about the rest

Removing a connection SHALL end its use in the studio and clear its secret from this Mac.
Where the provider supports withdrawing the credential remotely, the studio SHALL attempt it and
SHALL say plainly when that attempt fails; the local removal SHALL still complete.

#### Scenario: Remote withdrawal fails

- **WHEN** the service refuses or cannot be reached while withdrawing the credential
- **THEN** the connection is still removed locally and the person is told the service was not told, and where to withdraw it themselves

#### Scenario: A provider with no way to withdraw

- **WHEN** the provider offers no way to withdraw a credential
- **THEN** removal clears it locally and says the credential may still be valid at the service
