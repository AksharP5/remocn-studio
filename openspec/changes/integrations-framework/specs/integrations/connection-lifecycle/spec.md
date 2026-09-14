## Purpose

One layer through which every outside service reaches the studio: what a provider is, what a
named connection to it is, which capabilities that connection carries, and the states it moves
through from being created to being removed.

## ADDED Requirements

### Requirement: The catalogue is what has an adapter, never a promise

The studio SHALL offer a service for connection only when an adapter for it is registered and
reports itself ready. A service that is planned, half-built or unverified SHALL NOT appear as
something the person can connect, and SHALL NOT appear as a disabled or *coming soon* row.

#### Scenario: A service with no working adapter

- **WHEN** the catalogue is opened and a service has no registered adapter
- **THEN** that service is absent from the catalogue entirely

#### Scenario: A service whose adapter is registered

- **WHEN** an adapter is registered and ready
- **THEN** its service appears in the catalogue with the ways it can be authorized

### Requirement: A connection is a named account, and one service may have several

A connection SHALL carry a name the person gave it, the provider it belongs to, the account or
workspace it proved it reaches, and its capabilities. Several connections of one provider SHALL
be allowed, SHALL be told apart by their name and account, and SHALL NOT overwrite one another.

#### Scenario: A second connection to a service already connected

- **WHEN** a second connection to the same service is created under a different account
- **THEN** both connections exist side by side, each with its own name, account and secret

#### Scenario: Two connections named alike

- **WHEN** a name is given that another connection of that provider already carries
- **THEN** the studio says the name is taken and the connection is not created

### Requirement: A capability exists only where the provider offers it and a check confirmed it

A connection's capabilities SHALL be the intersection of what its provider implements and what
the last successful check proved the account is permitted to do. Where a provider does not
expose operation-specific key permissions, the connection SHALL distinguish verified account
access from operation access, which is verified by the first explicitly approved operation;
a paid probe SHALL NOT be used during connection checks. A capability that a provider
does not implement SHALL be absent rather than reported as failing, and an operation asked of a
connection that lacks its capability SHALL be refused with a sentence rather than attempted.

#### Scenario: A provider that implements only some capabilities

- **WHEN** a provider implements sound generation but not publishing
- **THEN** its connections carry the sound capability and no publishing capability

#### Scenario: An account whose permissions fall short

- **WHEN** a check succeeds but the account lacks the rights a capability needs
- **THEN** that capability is absent from the connection and the row says which right is missing

#### Scenario: Asking for a capability that is not there

- **WHEN** an operation needs a capability the connection does not carry
- **THEN** it is refused with a sentence naming the connection and the missing capability, and nothing is sent to the service

### Requirement: A connection reads as what it is, and never as working before it is proven

A connection SHALL be in exactly one of: being checked, connected, needs authorization, or
unavailable. A connection whose check has not yet succeeded SHALL NOT read as connected, and
SHALL NOT offer its capabilities for use.

#### Scenario: A connection created but not yet checked

- **WHEN** a connection has been created and its first check has not answered
- **THEN** it reads as being checked, and no operation may use it

#### Scenario: A check that fails

- **WHEN** a check answers that the credential is rejected
- **THEN** the connection reads as needing authorization, with the service's reason worded as a sentence

#### Scenario: A service that cannot be reached

- **WHEN** a check cannot reach the service at all
- **THEN** the connection reads as unavailable, and says so as a sentence rather than a status code

### Requirement: Connections come back after a restart, then a check brings them up to date

The studio SHALL restore every connection's identity, name and capabilities after a restart,
and SHALL present them as last known until a check answers. A restored connection SHALL NOT be
presented as freshly verified.

#### Scenario: Reopening the studio

- **WHEN** the studio is reopened
- **THEN** every connection made before is listed with its name, service and account

#### Scenario: A credential that expired while the studio was closed

- **WHEN** the check after a restart finds the credential no longer valid
- **THEN** that connection moves to needing authorization and its capabilities stop being offered

### Requirement: Disabling suspends a connection, removing ends it

A connection that is disabled SHALL keep its name, account and secret, and SHALL be refused for
every operation until it is enabled again. A connection that is removed SHALL stop being
available to every later operation and to the studio's tools, including a turn already running.

#### Scenario: Disabling a connection

- **WHEN** a connection is disabled
- **THEN** it stays in the list marked as disabled and no operation may use it

#### Scenario: Removing a connection a running turn was using

- **WHEN** a connection is removed while a turn is running
- **THEN** the turn's next call on it is refused with a sentence, and the turn is not killed

### Requirement: A new provider is an adapter, not a second lifecycle

Creating, checking, reconnecting, disabling and removing SHALL be carried out by one manager for
every provider. A provider SHALL contribute only the way it authorizes, the way it checks itself
and the capabilities it implements, and SHALL NOT carry its own copy of the lifecycle.

#### Scenario: Adding a provider

- **WHEN** a new adapter is registered
- **THEN** its connections can be created, checked, reconnected, disabled and removed with no lifecycle work of its own

### Requirement: A failure from a service is worded before it is shown

Every failure a service returns SHALL reach the person as a sentence that says what failed and
what to do next. A status code, a raw payload or a protocol token SHALL NOT be shown.

#### Scenario: A service answers with an error payload

- **WHEN** a check or an operation fails with a status and a body
- **THEN** the person is shown a sentence naming the service and the reason, and the raw answer goes only to the log

### Requirement: A turn learns which connections it may use, and never their secrets

The studio SHALL let a running turn ask which connections are available and what each can do,
answering with the service, the name, the account and the capabilities. The answer SHALL NOT
carry a secret in any form. A connection that is disabled, unchecked, needs authorization or has
been removed SHALL be absent from the answer.

#### Scenario: The agent asks what it can reach

- **WHEN** the agent asks which connections are available
- **THEN** it is told each connected connection's service, name, account and capabilities, and no credential material

#### Scenario: Nothing is connected

- **WHEN** no connection is in the connected state
- **THEN** the answer is an empty list worded as a sentence, not an error

#### Scenario: A connection is removed mid-turn

- **WHEN** a connection is removed and the agent asks again in the same turn
- **THEN** it is absent from the answer
