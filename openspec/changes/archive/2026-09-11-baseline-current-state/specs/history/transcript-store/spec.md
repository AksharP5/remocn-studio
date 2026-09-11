## Purpose

The studio keeps its own record of every chat and everything said in it, so the left pane and a reopened chat do not depend on any agent CLI's transcript files. This capability covers where that record lives, what a row is, how a turn writes into it as it streams, and what happens when it cannot be written at all.

## ADDED Requirements

### Requirement: The core decides where the history lives
The Rust core SHALL resolve the application's data directory, create it, and pass it to the sidecar as `REMOCN_STUDIO_DATA_DIR`; the sidecar SHALL open its history database inside that directory and never choose a location of its own.

#### Scenario: The core names a directory
- **WHEN** the sidecar starts with `REMOCN_STUDIO_DATA_DIR` set
- **THEN** the history database is opened in that directory
- **AND** the sidecar logs the path it opened and the schema version it found

#### Scenario: The sidecar is run by hand with no data directory
- **WHEN** `REMOCN_STUDIO_DATA_DIR` is not set
- **THEN** the sidecar falls back to a folder under the system temporary directory
- **AND** it says so on its log, rather than failing to start

### Requirement: A folder is a project row and a video is a folder row
The studio SHALL store a project as one row keyed by its canonical folder path, a video as one row under that project keyed by the composition id it registers, and a chat as one row under both. Removing a project SHALL remove its videos, chats and blocks, and SHALL never touch the folder on disk.

#### Scenario: The same folder is opened twice
- **WHEN** a folder is opened again, by the same path or through a symlink
- **THEN** it resolves to the one existing project row rather than creating a second history for the same tree

#### Scenario: A project is removed
- **WHEN** a project row is deleted
- **THEN** its videos, chats, transcript blocks and pipeline rows go with it
- **AND** nothing on disk is deleted or written

#### Scenario: A chat names a project that does not exist
- **WHEN** a chat is opened against a project id with no row
- **THEN** the store refuses with a message naming the problem, rather than writing an orphan row

### Requirement: A chat row carries what a later turn needs to resume
A chat row SHALL carry its title, the project and video it belongs to, the provider it last ran under, the permission mode it last ran in, and the provider's own resume id. The provider defaults to `claude` and the mode to `auto` for a row written before those fields existed.

#### Scenario: The first turn opens the chat
- **WHEN** a turn runs in a chat that has no row yet
- **THEN** the row is created with the title taken from the first message, flattened to one line and cut to 60 characters with an ellipsis
- **AND** the mode and provider stored are the ones that turn ran under

#### Scenario: A later turn reopens the same chat
- **WHEN** a second turn runs in a chat that already has a row
- **THEN** the title is kept as it was
- **AND** the project, video, mode and provider are updated to what this turn ran under

#### Scenario: A message carries only attachments
- **WHEN** the first message has no words at all
- **THEN** the chat is titled after its first attachment, or "Untitled session" when there is none

#### Scenario: The resume id is remembered
- **WHEN** the provider reports the id of the conversation it opened
- **THEN** that id is stored on the chat row so the next turn can resume it
- **AND** it is the only thing kept from the provider's own transcript format

### Requirement: A block is one transcript entry at one ordinal
A transcript SHALL be stored as blocks keyed by the chat and an ordinal, each holding one entry's kind and payload. Entry ids SHALL NOT be stored: a block read back SHALL take the id `block-<ordinal>`, so a chat loaded from disk cannot collide with a turn folded live.

#### Scenario: A transcript is read back
- **WHEN** a chat's blocks are requested
- **THEN** they come back in ordinal order with ids rebuilt from their ordinals
- **AND** every entry decodes to the same kinds the live stream produces — the person's message, the agent's text, an activity row, or a notice

#### Scenario: A second turn continues the transcript
- **WHEN** a new turn starts in a chat that already has blocks
- **THEN** its first block takes the ordinal after the highest one already stored, so the earlier turn is appended to rather than overwritten

#### Scenario: A chat is asked for that was never opened
- **WHEN** blocks are requested for an unknown chat
- **THEN** the request fails with a message naming the chat, rather than answering an empty transcript

### Requirement: One derivation serves both the live stream and the store
The transcript on screen during a turn and the transcript written to the store SHALL be derived from the agent's events in exactly the same way, so the two cannot differ. Storing SHALL write only the entries whose identity changed, which is at most one block per event.

#### Scenario: A turn streams text and tool calls
- **WHEN** a turn emits text deltas, a tool call and its result
- **THEN** consecutive text is folded into one agent entry, a tool call becomes an activity entry that later takes its result and its done-or-failed state, and a notice becomes its own entry
- **AND** the blocks stored are byte-for-byte what the live transcript showed

#### Scenario: A turn is stopped halfway
- **WHEN** a turn is interrupted mid-stream
- **THEN** the blocks already written stay, and the chat reopens on everything that was recorded before the interruption

#### Scenario: A block is written again at the same ordinal
- **WHEN** an event changes an entry that is already stored
- **THEN** the block at that ordinal is replaced rather than duplicated

### Requirement: The history never fails a turn
A history that cannot be written SHALL be tolerated: the recorder SHALL log the reason and become inert, and the turn SHALL run to completion. A database that cannot be opened at all SHALL answer every direct history request with the reason it could not be opened, so the pane can say why it is empty.

#### Scenario: The database cannot be written during a turn
- **WHEN** opening the chat row or reading the next ordinal fails
- **THEN** the failure is logged, nothing is recorded for that turn, and the agent still answers

#### Scenario: The database cannot be opened at launch
- **WHEN** the history file cannot be opened
- **THEN** the sidecar logs that history is unavailable and still starts
- **AND** every history request answers with a message naming the file that could not be opened

### Requirement: A crash costs at most the in-flight block
Every event SHALL commit its block as it arrives. A force quit SHALL NOT lose a block that was already committed.

#### Scenario: The app is force-quit mid-turn
- **WHEN** the process dies during a turn
- **THEN** every block committed before that moment is present on the next launch
- **AND** the next turn in that chat resumes numbering after the highest ordinal on disk

### Requirement: Schema changes are applied once, in one transaction
The store SHALL apply outstanding schema migrations in a single transaction, SHALL check for rows left pointing at nothing before committing, and SHALL roll back rather than leave a half-migrated database. Applying the migrations again SHALL be a no-op.

#### Scenario: An up-to-date database is opened
- **WHEN** the stored schema version already matches
- **THEN** nothing is applied and the version is reported unchanged

#### Scenario: A migration leaves an orphan
- **WHEN** the foreign-key check finds rows pointing at nothing
- **THEN** the whole migration is rolled back and the failure is reported

### Requirement: A message that starts no turn is still recorded
A send that has nothing to ask the agent — every change already written into the project's code, and no words typed — SHALL open the chat row and write the person's message into the transcript without running a turn, and SHALL answer with the chat row it opened.

#### Scenario: Every change was written into the code
- **WHEN** the person sends a message whose only content is edits the studio wrote into the project
- **THEN** the chat row is opened or updated and the message is recorded as the transcript's next entry
- **AND** no turn is started and the agent is not called

#### Scenario: The history is unavailable for such a message
- **WHEN** the chat row cannot be opened
- **THEN** the answer carries no chat row, and the send is not reported as a failure

### Requirement: The chat row reaches the webview at the head of its turn
When a turn opens or updates a chat row, the row SHALL be emitted on that turn's own stream before the agent's output, so the pane can show a chat that has just been created without a second request.

#### Scenario: A brand-new chat's first turn starts
- **WHEN** the turn opens the chat row
- **THEN** the row is emitted as the first chunk of that turn's stream
- **AND** the id in it is the one the webview minted and sent, so the pane already has a key for the turn

#### Scenario: A plan is approved mid-turn
- **WHEN** approving a plan changes the mode the chat is in
- **THEN** the stored mode is updated and the row is emitted again on the same stream

### Requirement: A reopened chat renders exactly as the live turn did
How a transcript is grouped for display SHALL depend only on the stored entries, so a chat loaded from disk and a turn folded live produce the same rows.

#### Scenario: Consecutive tool calls are folded
- **WHEN** two or more consecutive activity entries succeeded
- **THEN** they render as one row showing the last of them with a count of how many it stands for
- **AND** expanding that row reveals exactly the rows it replaced, in transcript order

#### Scenario: A tool call failed
- **WHEN** an activity entry is in the failed state
- **THEN** it is never folded into a run and keeps its own row with its error text

#### Scenario: A single call stands between two messages
- **WHEN** only one activity entry sits between other entries
- **THEN** it renders as a plain row rather than a run of one

### Requirement: The plan the agent writes is one checklist
Task-creating and task-updating tool calls SHALL be folded out of the transcript into a checklist anchored at the first creation after the person's last message. Task identity SHALL come from the id the tool reports in its result, falling back to the task's position among the creations while that result is still in flight.

#### Scenario: A plan is written and then moved
- **WHEN** a turn creates several tasks and later updates their status
- **THEN** the creations and updates leave the transcript and one checklist stands in their place at the first creation
- **AND** an update naming a task written in an earlier turn reaches that task wherever it was written

#### Scenario: A second plan is written later
- **WHEN** a later turn creates more tasks
- **THEN** those open a checklist of their own at their first creation, in the order the conversation happened

#### Scenario: An update names a task nothing created
- **WHEN** an update carries an id no creation produced
- **THEN** nothing in the checklist changes and the update is not folded away

#### Scenario: A task call failed
- **WHEN** a task creation or update is in the failed state
- **THEN** it stays an ordinary activity row with its error, and is never folded into a checklist
