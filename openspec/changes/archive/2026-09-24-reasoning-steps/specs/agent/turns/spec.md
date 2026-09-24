## MODIFIED Requirements

### Requirement: A running turn says what it is doing

The studio SHALL show, while a turn is running and nothing is waiting on the person, a marker naming the task the agent says it is working on and how long the turn has been running, and beneath it the latest three lines of what the agent is doing: its tool steps written as sentences and the reasoning it streams, in the order they arrived. Reasoning SHALL be shown only while its turn runs and SHALL NOT be stored in the transcript or in history. When the turn ends, the marker SHALL be replaced by a summary of the turn's work that expands into its steps.

#### Scenario: The agent is working

- **WHEN** a turn is running and the last thing in the transcript is not an assistant message
- **THEN** the marker shows the running task's present-continuous phrase, falling back to a plain "Thinking…" when the agent has named no task, with the elapsed time beside it

#### Scenario: A card is waiting to be answered

- **WHEN** the turn is waiting on a permission card or another ask
- **THEN** the marker is not shown, and the card is what stands on screen to be answered

#### Scenario: The agent reads a file and thinks

- **WHEN** the agent streams reasoning and then reads a file
- **THEN** the lines under the marker show the latest reasoning sentences followed by "Reading" and the file's name
- **AND** a fourth line pushes the oldest one out

#### Scenario: Reasoning is not kept

- **WHEN** a turn that streamed reasoning ends, or the chat is reopened after a relaunch
- **THEN** no reasoning text is shown for it, and none was written to history

#### Scenario: The turn ends

- **WHEN** a turn that ran tools ends
- **THEN** a "Worked for" row with the turn's duration replaces the marker, or with its step count when the duration is not known
- **AND** expanding it lists the turn's steps

#### Scenario: Reduced motion

- **WHEN** the system asks for reduced motion
- **THEN** the lines appear and leave without moving and the task phrase does not shimmer
