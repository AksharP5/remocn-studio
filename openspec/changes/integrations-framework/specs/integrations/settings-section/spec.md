## Purpose

The Integrations section of Settings: the catalogue a connection is created from, the list of
connections with what each can do and how it stands, and the AI accounts the studio only ever
probes.

## ADDED Requirements

### Requirement: Integrations holds two groups, and they behave differently on purpose

The Integrations section SHALL hold a group of services, whose connections the person creates
and removes, and a group of AI accounts, which the studio only probes. The AI accounts group
SHALL offer nothing to add and nothing to remove, and SHALL say that these are signed into
through the person's own tools.

#### Scenario: Opening Integrations

- **WHEN** the Integrations section is opened
- **THEN** the services group and the AI accounts group are both shown, each under its own heading

#### Scenario: Looking for a way to add an AI account

- **WHEN** the AI accounts group is read
- **THEN** it carries no Add and no Remove, and says these are signed in outside the studio

### Requirement: Adding an integration is choose, authorize, check, then name

*Add integration* SHALL offer the catalogue of services that can be connected; choosing one
SHALL present that service's own way in — a field for a key or token, or a trip to the browser.
The studio SHALL check the result before the connection is kept, and SHALL ask for a name it is
listed under. Cancelling at any point SHALL leave no connection behind.

#### Scenario: A key is accepted

- **WHEN** a key is entered and the check succeeds
- **THEN** the person is asked for a name and the connection joins the list as connected

#### Scenario: The check refuses the key

- **WHEN** the check answers that the key is rejected
- **THEN** the reason is shown beside the field, the key is not kept, and no connection is created

#### Scenario: Cancelling halfway

- **WHEN** the person cancels after entering a key but before the check finishes
- **THEN** nothing is stored and the list is as it was

### Requirement: A connection's row says what it is, what it can do and how it stands

Each row SHALL show the service, the name the person gave it, the account or workspace it
reaches, the capabilities it carries, and its state as words — being checked, connected, needs
authorization, or unavailable. A row SHALL NOT read as connected on the strength of having been
created.

#### Scenario: Two connections to one service

- **WHEN** two connections of one service are listed
- **THEN** each row names its own account, so the two are told apart without opening them

#### Scenario: A connection that needs authorizing again

- **WHEN** a connection's credential has been rejected
- **THEN** its row says authorization is needed, gives the service's reason as a sentence, and offers Reconnect

### Requirement: Every action on a connection is reachable from the keyboard

Check, reconfigure, reconnect, disable, enable and remove SHALL be offered for a connection and
SHALL each be reachable by keyboard alone, in the order the row reads. Removal SHALL be
confirmed before it happens, and the confirmation SHALL say that the secret on this Mac goes
with it.

#### Scenario: Working through the list without a mouse

- **WHEN** the person moves through the list with the keyboard
- **THEN** each connection's actions take focus in turn and can be triggered from the keyboard

#### Scenario: Removing a connection

- **WHEN** Remove is chosen
- **THEN** a confirmation says the connection and its stored secret will be removed from this Mac, and nothing happens until it is accepted

### Requirement: A secret is written, replaced, and never read back

The field for a key or token SHALL be for entering or replacing it. A secret already stored
SHALL NOT be shown, prefilled, or returned to the page in any form; the page SHALL say only that
one is held.

#### Scenario: Reopening a connection that holds a key

- **WHEN** a connection holding a key is reconfigured
- **THEN** the field is empty and says a key is stored, with entering a new one the way to replace it

### Requirement: A save that failed never reads as a save that worked

When a connection cannot be stored — the keychain refused, the check never answered, the write
failed — the section SHALL say what failed, SHALL leave the list unchanged, and SHALL NOT report
success.

#### Scenario: The keychain refuses while saving

- **WHEN** the secret cannot be written
- **THEN** the failure is shown where the person is working and no row is added

### Requirement: AI accounts keep their probe, their chips and their steps

The AI accounts group SHALL list every provider the studio knows with the answer of that
provider's own probe — the sentence, any detail, and a chip saying *Signed in*, *Action needed*,
*Check* or *Checking* — and SHALL offer Recheck for the whole group. A provider that has not been
probed SHALL read *Not checked yet*, never as signed out. Where a provider has setup steps, they
SHALL unfold under its sentence; where the fix is a command, it SHALL be shown and copyable.

#### Scenario: A provider that is not signed in

- **WHEN** a provider's probe says it is not signed in
- **THEN** its row says so, carries its sign-in steps, and its chip reads *Action needed*

#### Scenario: A provider with no answer yet

- **WHEN** a provider has no probe result
- **THEN** its row reads *Not checked yet* with no verdict chip

#### Scenario: Rechecking

- **WHEN** Recheck is pressed
- **THEN** every provider is asked again and the rows show they are being checked

### Requirement: Arriving from the model menu lands on the provider that was asked about

When *Sign in* is chosen on a provider in the model menu, Settings SHALL open on Integrations
with that provider's row in the AI accounts group scrolled into view and marked.

#### Scenario: Signing a provider in from the composer

- **WHEN** the person picks *Sign in* on a provider in the model menu
- **THEN** Settings opens on Integrations with that provider's row scrolled into view and outlined
