## Purpose

A turn is one exchange between a person and the agent inside one chat: what the message carries, what the agent streams back while it works, and what happens to the next message while the first is still running. Turns belong to their chat rather than to the window, so they keep running when the person looks somewhere else.

## ADDED Requirements

### Requirement: A turn carries the whole message and the settings it was sent under

The studio SHALL send, with every turn, the typed text, its attached images, media, library assets and element references, together with the chat and project it belongs to, the video it is about, the permission mode, the provider, the model, the reasoning effort, the plan tier and the frame the preview was paused on.

#### Scenario: A message is sent from a chat

- **WHEN** the person sends a message in a chat that has a project and a video
- **THEN** the turn carries the trimmed text, every reference the composer held, the chat's permission mode and provider, the model chosen for that provider, the app-wide effort and the composition and frame the preview is showing
- **AND** the chat id it carries is the one the webview minted and sent, rather than one the sidecar assigns

#### Scenario: The message is empty

- **WHEN** the person sends with no text, no images, no media, no assets and no element references
- **THEN** no turn starts and the composer keeps what it had

#### Scenario: The video does not belong to the project

- **WHEN** the turn names a video whose project is not the project it also names
- **THEN** the turn is refused with a sentence saying the video does not belong to the selected project

### Requirement: Attachments and media travel as paths

The studio SHALL carry images, video and audio as file paths rather than as bytes, and SHALL read and encode an image only where the provider's request is built.

#### Scenario: A picture is attached

- **WHEN** a turn carries an attached image
- **THEN** only its path, name and media type cross to the sidecar, and the bytes are read there

#### Scenario: A clip or a sound is attached

- **WHEN** a turn carries video or audio
- **THEN** the file is copied into the project's public folder before the turn starts and the agent is told the path it can load from inside the project, rather than the path on the person's own disk

#### Scenario: A referenced asset or clip cannot be copied

- **WHEN** copying a referenced asset or an attached clip into the project fails
- **THEN** the failure is reported as a notice naming what could not be copied, and the turn still runs with the words the person wrote

### Requirement: The turn's stream opens with the chat's own row

The studio SHALL emit the chat's stored row as the first chunk of a turn's stream, before any of the agent's own output.

#### Scenario: The first turn in a new chat

- **WHEN** a turn starts in a chat that has no stored row yet
- **THEN** the row is created and streamed at the head of that turn's stream, before any of the agent's output

#### Scenario: The chat's stored row cannot be opened

- **WHEN** the history store cannot open or write the chat's row
- **THEN** the failure is logged, no row is streamed, and the turn still runs

#### Scenario: The chat has history but no resume token

- **WHEN** a chat that has spoken before has no provider resume token to continue from
- **THEN** the stored transcript is appended to the prompt as historical conversation, a notice says a new provider session is starting in the current project folder and the studio history is preserved, and the turn runs

### Requirement: A turn streams what the agent is doing as it happens

The studio SHALL stream, for the life of a turn, the provider's session and model, text and thinking as they arrive, each tool call with its neutral verb and each tool result with whether it failed, permission asks, and notices; and SHALL answer the turn with the provider's resume token, a context-window reading and a failure when there was one.

#### Scenario: The agent writes an answer

- **WHEN** the agent produces text and thinking
- **THEN** both stream into the open chat as they arrive and are folded into the transcript

#### Scenario: The agent runs a tool

- **WHEN** the agent calls a tool
- **THEN** the call streams with a verb drawn from one neutral vocabulary, and its result streams with whether it was an error

#### Scenario: The turn ends in a provider failure

- **WHEN** the provider reports it is signed out, out of quota, or given a model it does not have
- **THEN** the turn answers with that failure worded for a person rather than raising, and the chat shows it

### Requirement: One turn at a time per video

The studio SHALL allow one running turn per video rather than per chat, and SHALL queue a message sent while any chat under that video is running.

#### Scenario: A second message during a running turn

- **WHEN** the person sends while this chat's own turn is running
- **THEN** the message is queued, the composer clears, and the queue drawer above the composer shows it

#### Scenario: A message in a sibling chat of a busy video

- **WHEN** the person sends in another chat under the same video while that video has a turn running
- **THEN** the message is queued rather than starting a second turn against the same folder

#### Scenario: Two different videos

- **WHEN** turns are sent in chats under different videos
- **THEN** both run at the same time

### Requirement: A queued message is captured whole

The studio SHALL capture a queued message complete at the moment it was written — its text, images, media, assets, element references, the model, the effort, the project, the video and the frame the preview was paused on — and SHALL re-read only the permission mode and the provider at the moment it is dispatched.

#### Scenario: A queued message goes out

- **WHEN** a queued message is dispatched
- **THEN** it carries the frame and the settings it was written under, and the mode and provider of the chat as they stand when the turn that just ended settled

#### Scenario: The plan changes between writing and sending

- **WHEN** the account's plan changes while a message is queued
- **THEN** the queued turn runs under the plan the account holds at dispatch, and the turn already running is unaffected

#### Scenario: A queued message is taken back

- **WHEN** the person clicks a queued row while the composer is empty
- **THEN** the row leaves the queue and its whole content is restored into the composer
- **AND** clicking a row while the composer holds a draft does nothing

### Requirement: A finished turn hands the video on

The studio SHALL, when a turn settles cleanly, dispatch the head of its own queue first, and otherwise hand the video to the sibling chat that has been waiting longest.

#### Scenario: The chat has its own queue

- **WHEN** a turn settles cleanly and its chat has queued messages
- **THEN** the head of that chat's queue starts as the next turn

#### Scenario: Only a sibling is waiting

- **WHEN** a turn settles cleanly, its own queue is empty, and another chat under the same video has a queued message
- **THEN** that message is dropped from the sibling's queue and dispatched into the sibling's chat, in the order the chats queued

#### Scenario: Nothing is waiting

- **WHEN** a turn settles and no chat under that video has a queued message
- **THEN** the video is free and nothing is dispatched

### Requirement: The queue is held when a turn did not finish cleanly

The studio SHALL leave a chat's queue untouched when its turn was stopped by hand, when it failed, or when it ended with an ask still unanswered.

#### Scenario: The turn was stopped

- **WHEN** the person stops a running turn
- **THEN** the queue stays where it is and nothing is dispatched

#### Scenario: The turn failed

- **WHEN** a turn ends with a failure
- **THEN** the queue stays where it is and the failure is shown in the chat

#### Scenario: An ask was never answered

- **WHEN** a turn ends while a permission card or another ask of that turn is still outstanding
- **THEN** the queue stays where it is

### Requirement: Turns keep running when you look away

The studio SHALL keep a turn running when its chat is not the one on screen, and SHALL mark that chat unread when the turn ends somewhere else.

#### Scenario: The person opens another chat mid-turn

- **WHEN** a turn is running and the person opens a different chat
- **THEN** the turn keeps running, its output keeps being recorded, and switching back shows everything that happened

#### Scenario: A background turn ends

- **WHEN** a turn ends in a chat that is not open
- **THEN** the chat's row carries an unread mark until the person opens it

#### Scenario: The person watched it finish

- **WHEN** a turn ends in the chat that is open
- **THEN** no unread mark is left

### Requirement: Stopping a turn is an explicit cancel

The studio SHALL treat stopping as a cancellation that reaches the agent and closes its process, SHALL settle that turn's outstanding permission cards before waiting for the agent to stop, and SHALL NOT report a deliberate stop as an error.

#### Scenario: The person presses Stop

- **WHEN** a running turn is stopped
- **THEN** the request is cancelled, the turn's own outstanding cards are refused before the agent is asked to stop, and the chat shows no error line

#### Scenario: Another chat's turn is stopped

- **WHEN** one chat's turn is stopped
- **THEN** only that chat's turn ends; turns in other chats are untouched

### Requirement: A turn refuses ground that has moved under it

The studio SHALL refuse to start a turn in a project whose folder is no longer on disk, naming the project and the path, and SHALL refuse a turn that asks to apply a project brand that has been edited since the composer read it.

#### Scenario: The folder was moved or deleted

- **WHEN** a turn is sent in a project whose folder is missing
- **THEN** the turn is refused with a sentence naming the project and the path that is gone

#### Scenario: The project's brand changed under the message

- **WHEN** a turn asks to apply the project's brand and the brand has been edited since the composer read it
- **THEN** the turn is refused with a sentence asking for settings to be reloaded, rather than applying a stale brand

### Requirement: The context-window reading is best-effort

The studio SHALL take the context-window reading from the live provider session before the turn closes it, SHALL abandon the reading rather than the turn if it does not answer, and SHALL show no meter when there is no reading.

#### Scenario: The provider answers with a reading

- **WHEN** a turn ends and the provider reports how full the context window is
- **THEN** the reading is carried back with the turn's result and the composer shows the meter

#### Scenario: The reading does not arrive

- **WHEN** the reading fails or does not answer within its own short window
- **THEN** the turn's result is unaffected, the previous reading is kept, and a chat that never had one shows no meter at all

### Requirement: A message that asks for nothing starts no turn

The studio SHALL write a message into the transcript without starting a turn when every change it carries has already been written into the project's code by the studio itself and there is nothing else to ask for.

#### Scenario: Every element edit was written to the code

- **WHEN** the person sends a message whose only content is element references the studio already wrote into the files, with no words, images, media or assets
- **THEN** the chat's row is opened, the message is recorded in the transcript with its references, and no agent turn runs

#### Scenario: Words accompany the written edits

- **WHEN** the same message also carries typed text or any other reference
- **THEN** an ordinary turn runs

### Requirement: A running turn says what it is doing

The studio SHALL show, while a turn is running and nothing is waiting on the person, a marker naming the task the agent says it is working on and how long the turn has been running.

#### Scenario: The agent is working

- **WHEN** a turn is running and the last thing in the transcript is not an assistant message
- **THEN** the marker shows the running task's present-continuous phrase, falling back to a plain "Thinking…" when the agent has named no task, with the elapsed time beside it

#### Scenario: A card is waiting to be answered

- **WHEN** the turn is waiting on a permission card or another ask
- **THEN** the marker is not shown, and the card is what stands on screen to be answered
