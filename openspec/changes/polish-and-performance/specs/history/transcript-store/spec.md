## MODIFIED Requirements

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
- **THEN** the chat is titled after its first attachment, or "Untitled chat" when there is none

#### Scenario: The resume id is remembered
- **WHEN** the provider reports the id of the conversation it opened
- **THEN** that id is stored on the chat row so the next turn can resume it
- **AND** it is the only thing kept from the provider's own transcript format

### Requirement: One derivation serves both the live stream and the store
The transcript on screen during a turn and the transcript written to the store SHALL be derived from the agent's events in exactly the same way, so the two cannot differ. Storing SHALL write only the entries whose identity changed. Streamed text and thinking SHALL be written at most every quarter second while they stream, and SHALL be written in full before any other event is stored and when the turn ends, however it ends. The frames that carry streamed text and thinking to the webview MAY join consecutive pieces of the same kind into one frame, at most a few tens of milliseconds late, and SHALL never let them overtake an event that came after them.

#### Scenario: A turn streams text and tool calls
- **WHEN** a turn emits text deltas, a tool call and its result
- **THEN** consecutive text is folded into one agent entry, a tool call becomes an activity entry that later takes its result and its done-or-failed state, and a notice becomes its own entry
- **AND** the blocks stored are byte-for-byte what the live transcript showed once the turn has ended

#### Scenario: A long answer streams token by token
- **WHEN** a turn streams hundreds of text deltas into one entry
- **THEN** the entry is written a handful of times, not once per delta, and what is stored at the end is the whole text

#### Scenario: A turn is stopped halfway
- **WHEN** a turn is interrupted mid-stream
- **THEN** the blocks already recorded stay, the text streamed up to the interruption is written before the turn ends, and the chat reopens on everything that was recorded before the interruption

#### Scenario: A block is written again at the same ordinal
- **WHEN** an event changes an entry that is already stored
- **THEN** the block at that ordinal is replaced rather than duplicated

### Requirement: A crash costs at most the in-flight block
Every event other than streamed text and thinking SHALL commit its block as it arrives; streamed text and thinking SHALL be committed at most a quarter second after they arrive. A force quit SHALL NOT lose a block that was already committed.

#### Scenario: The app is force-quit mid-turn
- **WHEN** the process dies during a turn
- **THEN** every block committed before that moment is present on the next launch, and at most the last quarter second of streamed text is missing
- **AND** the next turn in that chat resumes numbering after the highest ordinal on disk

## ADDED Requirements

### Requirement: A chat nobody is looking at is read back rather than kept
The webview SHALL keep the transcripts of the five chats opened most recently, and SHALL release any other chat read from history once it is not open, not running, holds no queued message, no permission card or question, no unread result and no error. A released chat SHALL be read back from history when it is opened again and SHALL render exactly as it did. Only a chat whose transcript was read from history SHALL be released; a chat begun since the app opened is kept.

#### Scenario: Many chats are opened in turn
- **WHEN** a seventh chat is opened after six others that have settled
- **THEN** the two opened longest ago are released
- **AND** their rows in the sidebar keep their place and read as settled

#### Scenario: A released chat is opened again
- **WHEN** the person opens a chat that was released
- **THEN** its transcript is read back from history, with the loading rows shown while it is read, and renders exactly as before

#### Scenario: A chat is still working
- **WHEN** a chat is running, waiting on an answer, holding a queued message, or showing an unread result or an error
- **THEN** it is kept however many chats are opened after it

#### Scenario: History cannot be read back
- **WHEN** a released chat is opened and history cannot be read
- **THEN** the chat shows the history error in place of its transcript, as any chat that fails to load does
