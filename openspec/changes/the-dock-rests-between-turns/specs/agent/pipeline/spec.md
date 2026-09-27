## MODIFIED Requirements

### Requirement: The Video dock is the way into the documents

The Video dock SHALL show the seven stages with their status while the pipeline is unfinished, and a stage whose document exists on disk SHALL be a button that switches the pane to Docs and opens that document. A stage that has written nothing SHALL be a plain row. The dock's in-progress marks SHALL animate only while the open chat's turn is running; between turns the active stage SHALL keep its mark, drawn still.

#### Scenario: A stage with a document

- **WHEN** the person clicks a stage row whose document is on disk
- **THEN** the pane switches to Docs and opens that file

#### Scenario: A stage with nothing written

- **WHEN** a stage has written no document
- **THEN** its row is not clickable rather than being a dead button

#### Scenario: The dock's label

- **WHEN** the pipeline is running and a turn is working on it
- **THEN** the dock reads the running task's present-continuous phrase, or the active stage's, with the count of stages done
- **AND** a finished pipeline leaves the dock to the turn's own plan

#### Scenario: Between turns

- **WHEN** the pipeline is unfinished and no turn is running, for instance after a turn ended with Review still active
- **THEN** the dock reads the active stage's title, such as "Review", with the count of stages done
- **AND** the active stage's mark and any plan task a stopped turn left in progress are drawn still rather than animating
