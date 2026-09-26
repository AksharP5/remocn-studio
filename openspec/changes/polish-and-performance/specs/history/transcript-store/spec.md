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
