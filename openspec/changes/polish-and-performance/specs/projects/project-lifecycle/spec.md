## MODIFIED Requirements

### Requirement: Scaffolding streams its two steps and never overwrites

The studio SHALL scaffold a project in two reported steps — copying the template, then installing dependencies — SHALL report each step as it starts and finishes, and SHALL skip any file the folder already holds. The package manifest it copies SHALL be renamed after the folder, using a name the package registry accepts. While a step runs, the studio SHALL show how long it has been running and SHALL offer Cancel, which stops the step and its install process. A failure SHALL be worded as which step failed, with the underlying output behind a Details disclosure that can be copied, and SHALL offer Try again.

#### Scenario: A file already exists
- **WHEN** the template is expanded into a folder that already holds one of its files
- **THEN** the studio SHALL leave that file exactly as it is
- **AND** SHALL write only the files that were absent

#### Scenario: The install is running
- **WHEN** dependencies are being installed
- **THEN** the row reads *Installing dependencies…* with the time it has been running, in seconds and then minutes, and a Cancel button

#### Scenario: The install is cancelled
- **WHEN** the person presses Cancel while a step runs
- **THEN** the studio SHALL stop the step and its install process, say that the step was cancelled rather than that it failed, and offer Try again
- **AND** SHALL leave the project in the list

#### Scenario: The scaffold fails
- **WHEN** the template copy or the install fails
- **THEN** the studio SHALL say which of the two steps failed, keep the underlying message behind Details with Copy details, and offer Try again
- **AND** SHALL leave the project in the list rather than removing it

#### Scenario: The chat is used while the install runs
- **WHEN** dependencies are still installing
- **THEN** the composer SHALL remain usable and a turn SHALL be allowed to start
- **AND** the preview SHALL NOT be started for that project until the scaffold has finished

#### Scenario: The folder cannot be created
- **WHEN** creating the folder or registering the project fails
- **THEN** the wizard SHALL close and the reason SHALL be shown beside the project list
- **AND** no project SHALL be added to the list

#### Scenario: Retry after the agent has edited the project
- **WHEN** Try again is pressed on a project whose files the agent has since changed
- **THEN** the studio SHALL re-run the same two steps and SHALL NOT overwrite any edited file
