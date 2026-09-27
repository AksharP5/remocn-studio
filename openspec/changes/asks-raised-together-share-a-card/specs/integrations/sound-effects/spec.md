## ADDED Requirements

### Requirement: Several sound effects are one call and one card

The sound-effect tool SHALL accept a list of sounds on one connection and SHALL be described to the agent as the way to ask for every sound the person wants at once. The sidecar SHALL prepare every sound in the list, raise an ask for each one before waiting on any of them, send only the approved sounds, one at a time, and answer the agent with the outcome of each. Each sound SHALL remain its own operation with its own approval and at most one paid request.

#### Scenario: The person asks for several sounds

- **WHEN** the agent calls the tool with three sounds
- **THEN** one permission card lists all three, each with the connection, description, duration, format and the notice that the ElevenLabs account is charged
- **AND** nothing is sent before the card is answered

#### Scenario: Some sounds are approved

- **WHEN** the person approves two of the three sounds
- **THEN** only those two are sent, one after the other, and the agent is told the third was declined and must not be requested again

#### Scenario: Every sound is declined

- **WHEN** the person declines all, the card goes unanswered for ten minutes, or the turn stops
- **THEN** no paid request is sent and the agent receives a sentence saying the person declined them

#### Scenario: One approved sound fails

- **WHEN** a sent sound fails or its outcome is uncertain
- **THEN** its failure is reported in words beside the other sounds' results, the others are still sent, and nothing is retried automatically

#### Scenario: A sound in the list is invalid

- **WHEN** one sound in the list fails validation before any card is raised
- **THEN** no card is raised, every prepared sound is cancelled, and the agent is told which parameter was refused

#### Scenario: The agent calls the tool once per sound anyway

- **WHEN** the agent sends the sounds as separate calls
- **THEN** each call raises its own card after the previous call has returned, and no approval carries over from one to the next
