## ADDED Requirements

### Requirement: Paid sound generation is approved per operation across agent providers

The studio's common service SHALL require approval for each paid sound generation regardless of agent provider or permission mode. The card SHALL show the verified connection identity, description, duration, format and a notice that the selected ElevenLabs account is charged. Approval SHALL bind to those exact values and SHALL NOT be remembered or supplied by the model itself.

#### Scenario: The agent requests sound generation
- **WHEN** Claude, Codex, Copilot or Grok calls the generation tool in auto, acceptEdits or plan
- **THEN** a card shows the actual connection and exact parameters before a paid request is sent
- **AND** only explicit approval permits dispatch

#### Scenario: A model supplies an approval flag or misleading summary
- **WHEN** tool input claims approval or names a different account in its prose
- **THEN** the service still asks and displays its own resolved connection and parameters

#### Scenario: The person declines or never answers
- **WHEN** approval is denied, times out or is cancelled with the turn
- **THEN** no paid request is sent and the agent receives a sentence explaining the refusal

#### Scenario: A second generation is requested
- **WHEN** a new operation repeats the same description and settings
- **THEN** it requires its own approval and offers no option to remember the decision
