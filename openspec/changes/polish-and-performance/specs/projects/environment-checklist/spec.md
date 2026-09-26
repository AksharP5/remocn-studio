## MODIFIED Requirements

### Requirement: The videos row is the preview's answer
The studio SHALL take the videos row from what the preview's compiled project reported, and SHALL fold it in only while the preview is showing the project the open chat belongs to. Until the preview has compiled, the row SHALL be pending, which shows nothing. The row SHALL name the open chat's agent by its provider's name when it suggests asking for a change, and SHALL NOT use the words composition or Root.

#### Scenario: The preview has not compiled yet
- **WHEN** the report is shown
- **THEN** the videos row is pending, and a project whose preview is still building wears no checklist on its account

#### Scenario: The project registers no videos
- **WHEN** the preview reports none
- **THEN** the row fails saying the project compiled but registers no videos yet, and suggests asking the chat's agent, by name, to add one

#### Scenario: The video that was asked for is not in the code
- **WHEN** the preview reports that the composition the pane asked for is missing
- **THEN** the row fails naming that video, rather than reporting the substitute that played

#### Scenario: The preview is showing another project
- **WHEN** the preview's project is not the open chat's project
- **THEN** the videos row stays pending rather than reporting another project's compositions
