## ADDED Requirements

### Requirement: A tool that acts on an outside service through a connection always asks

A studio tool that reaches an outside service through a connection SHALL raise a permission card
before it runs, naming the service, the connection and what is about to happen. The silent
approval the studio's own tools enjoy SHALL NOT extend to it, and the mode SHALL NOT remove the
card: it is raised in auto, in acceptEdits and in plan alike.

#### Scenario: The agent asks to send something outward

- **WHEN** the agent calls a tool that publishes, uploads or otherwise sends material to a connected service
- **THEN** a card names the service, the connection and the material, and nothing is sent until it is allowed

#### Scenario: The turn is running in auto

- **WHEN** such a tool is called while the chat is in auto
- **THEN** the card is still raised

### Requirement: An outward action is never remembered

An approval of an outward-acting tool SHALL apply to that call alone. It SHALL NOT be remembered
for the rest of the turn, for the chat, or for the studio's run, and the card SHALL offer no way
to remember it.

#### Scenario: The same action a second time

- **WHEN** the agent calls the same outward tool again with the same material
- **THEN** a second card is raised and answered on its own

#### Scenario: Looking for a way to stop being asked

- **WHEN** an outward tool's card is shown
- **THEN** it offers Allow and Deny, and no option to remember the answer

### Requirement: A refused or unanswered outward action sends nothing

An outward-acting tool that is denied, that goes unanswered, or whose turn is stopped SHALL send
nothing to the service, and SHALL answer the agent with a sentence saying the person did not
allow it.

#### Scenario: The card is denied

- **WHEN** the person denies an outward tool's card
- **THEN** nothing reaches the service and the agent is told the person declined

#### Scenario: The turn is stopped with a card waiting

- **WHEN** the turn is stopped while an outward tool's card is unanswered
- **THEN** the card is settled as denied and nothing reaches the service
