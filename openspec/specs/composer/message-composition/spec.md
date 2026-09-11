# composer/message-composition Specification

## Purpose
The composer is where a message to the agent is written, carried and sent. This capability covers the text field itself, what sending does when a turn is already running, the two drawers stacked behind the composer, the Mode, Model and Effort chips, and every state in which the composer refuses to take a message and says why.

## Requirements

### Requirement: The composer's text is taken verbatim
Every field whose content the agent reads or that is written back into the project's code SHALL have the platform's automatic text substitution and automatic capitalisation switched off, so what the person typed is what is sent and what is stored. Spellchecking SHALL be left as the platform's own setting.

#### Scenario: A command is typed into the composer
- **WHEN** the person types text containing a double hyphen, a straight quote or three dots
- **THEN** the message that reaches the agent and the message stored in the transcript hold exactly those characters, unsubstituted

#### Scenario: A reopened chat shows a past message
- **WHEN** a stored message is rendered
- **THEN** it reads as the raw text that was sent

### Requirement: Enter sends and Shift+Enter opens a line
Pressing Enter with no Shift SHALL send the message; Shift+Enter SHALL insert a newline. When the file-mention list is open, its own key handling SHALL be consulted first (see `composer/file-mentions`).

#### Scenario: Enter is pressed with text in the field
- **WHEN** the person presses Enter without Shift
- **THEN** the message is submitted and the default newline is suppressed

#### Scenario: Shift+Enter is pressed
- **WHEN** the person presses Enter with Shift
- **THEN** a newline is inserted and nothing is sent

#### Scenario: Escape is pressed
- **WHEN** the person presses Escape and the composer has an escape action
- **THEN** that action runs instead of anything being sent

### Requirement: A send clears the composer only when it was taken
Submitting SHALL answer whether the message was taken. The text, attachments, element selections, assets and media SHALL be cleared only on a yes, and left exactly as they were on a no.

#### Scenario: The message is accepted
- **WHEN** submit is answered with a yes
- **THEN** the text field and every carried list are emptied

#### Scenario: No project is open
- **WHEN** there is no open project or video to send into
- **THEN** the message is refused and nothing in the composer is cleared

#### Scenario: A message carrying code edits is refused
- **WHEN** the studio's writes into the project's code are refused and the person cancels
- **THEN** the composer is left exactly as it was, with its text and its chips

#### Scenario: The composer is empty
- **WHEN** the field holds only whitespace and nothing is attached
- **THEN** there is nothing to send and the send control is unavailable

### Requirement: A send during a running turn queues the message
One turn at a time SHALL run per video. A send while any chat of the same video is running SHALL add the message to that chat's queue rather than dropping it, and the send control SHALL say it will queue.

#### Scenario: A message is sent while this chat is running
- **WHEN** the person sends during a running turn
- **THEN** the message joins the queue, the composer clears, and the control reads Queue rather than Send

#### Scenario: A message is sent while a sibling chat of the same video is running
- **WHEN** another chat under the same video has a turn running
- **THEN** the message is queued rather than started

#### Scenario: Different videos
- **WHEN** the running turn is in another video
- **THEN** the message starts immediately

### Requirement: A queued message is captured whole
A queued message SHALL carry its text, attachments, element selections, assets, media, and the model, reasoning effort, preview frame and project the composer was set to at the moment it was written. The permission mode and the provider SHALL be re-read at dispatch from the chat as it stands then.

#### Scenario: The frame matters to the message
- **WHEN** the person writes about what is on the preview at that moment and queues it
- **THEN** the message carries that frame, not the frame on screen when it is finally dispatched

#### Scenario: A plan is approved before the queued message goes out
- **WHEN** approving a plan changes the mode the chat is in
- **THEN** the queued message is dispatched in the mode the chat is now in

#### Scenario: A chat's provider was switched
- **WHEN** a queued message is dispatched
- **THEN** it runs under the chat's provider as it stands at dispatch, not under one captured when the message was written

### Requirement: The queue drains in order and stops for three things
When a turn ends, the head of its own queue SHALL be dispatched; with nothing of its own left, the video SHALL be handed to the sibling chat that has been waiting longest. The queue SHALL be held where it is when the turn was stopped by hand, when the turn failed, or when something is still waiting on an answer.

#### Scenario: A turn ends cleanly with a queue
- **WHEN** the running turn settles and its queue is not empty
- **THEN** the head of the queue is dispatched as an ordinary turn

#### Scenario: A turn fails
- **WHEN** the running turn fails or is stopped by hand
- **THEN** nothing is dispatched and the queue stays as it is

#### Scenario: A permission or a question is outstanding
- **WHEN** the turn settles with a card or a question still unanswered
- **THEN** the queue is not drained

#### Scenario: The queue outlives the turn but not the app
- **WHEN** the studio is relaunched
- **THEN** nothing that was queued is still queued

### Requirement: The queue is a drawer behind the composer
While a chat has queued messages, a strip SHALL sit directly against the composer showing, on one line, the message that goes out next and how many are queued. Opening it SHALL show every queued message with its text wrapping. Whether it is open SHALL NOT be remembered across launches, and it SHALL start collapsed.

#### Scenario: One message is queued
- **WHEN** a message is queued
- **THEN** the strip reads that message truncated to a line and the count beside it

#### Scenario: The drawer is opened
- **WHEN** the person opens the queue
- **THEN** every queued message is listed, wrapping rather than truncating, each with a control to remove it

#### Scenario: A queued row is clicked with an empty composer
- **WHEN** the person clicks a queued message and the composer holds nothing
- **THEN** that message leaves the queue and is restored whole into the composer — its text, attachments, element selections, assets and media

#### Scenario: A queued row is clicked with a draft in the composer
- **WHEN** the composer already holds something
- **THEN** the row cannot be clicked and says the composer has to be cleared first

#### Scenario: Nothing is queued
- **WHEN** the queue is empty
- **THEN** no strip is drawn at all

### Requirement: The plan is the other drawer, and its state is remembered
The plan the agent wrote SHALL be a strip in the same stack, above the queue, collapsed to the task in hand with how many of the plan are done. Opening it SHALL reveal the whole checklist upwards. Whether it is open SHALL be remembered in `settings.json` under `taskDock`.

#### Scenario: A plan has a task in progress
- **WHEN** a plan is open with one task in progress
- **THEN** the strip reads that task's present-continuous phrase and the done-out-of-total count

#### Scenario: Everything in the plan is done
- **WHEN** every task is completed
- **THEN** the strip reads that it is all done

#### Scenario: The app is relaunched
- **WHEN** the plan was left open
- **THEN** it comes back open

#### Scenario: The video's production pipeline has unfinished stages
- **WHEN** the video's pipeline has not finished
- **THEN** the strip shows the pipeline's own progress in place of the turn's plan, between turns and in a reopened chat alike

### Requirement: The Mode chip reads the mode the turn will run in
The composer SHALL offer Auto, Accept edits and Plan for a provider that claims permission modes, SHALL show the mode the open chat is in, and SHALL report the mode a turn will *really* run in rather than the one that was picked. A mode the chosen model cannot run SHALL be disabled with the reason on its row, and the chat SHALL keep the mode the person picked.

#### Scenario: The chat is in Accept edits
- **WHEN** the chat's stored mode is Accept edits
- **THEN** the chip reads Accept edits without the person choosing again

#### Scenario: A model that cannot run Auto is chosen
- **WHEN** the chat is in Auto and the chosen model does not offer it
- **THEN** the chip reads the mode the turn will really run in, names the model on its tooltip as the reason, and the Auto row in the menu is disabled
- **AND** the chat still holds Auto, so a model that offers it restores the mode without the person choosing again

#### Scenario: The provider claims no modes
- **WHEN** the open chat's provider does not offer permission modes
- **THEN** no Mode chip is drawn

### Requirement: The Model chip is where the provider is chosen
One menu SHALL offer models grouped by provider. Picking a model in another provider's group SHALL switch the chat's provider. Groups other than the chat's SHALL be disabled once the chat has spoken, and a provider whose account probe failed SHALL be disabled with a way into the account settings. The model choice SHALL be remembered per provider.

#### Scenario: A model of another provider is picked on a fresh chat
- **WHEN** the chat has not spoken yet
- **THEN** picking a model in another provider's group switches the chat to that provider and remembers the model for it

#### Scenario: The chat has already spoken
- **WHEN** the chat has a resume id
- **THEN** the other providers' groups are disabled, with the reason that a resume token is not portable between providers

#### Scenario: A provider is signed out
- **WHEN** a provider's account probe reported it is not signed in
- **THEN** its group offers a way into the account settings rather than a model to pick

### Requirement: The Effort chip offers the provider's reasoning levels
For a provider that claims a reasoning effort, the composer SHALL offer Default, Low, Medium, High, Extra high and Max, remember the choice application-wide, and send it with the turn. A provider with no effort SHALL show no chip.

#### Scenario: A level is picked
- **WHEN** the person picks a level
- **THEN** the chip reads it and it is remembered for the next launch

#### Scenario: Default is picked
- **WHEN** the person picks Default
- **THEN** no effort is sent with the turn at all

### Requirement: Every single-select chip menu closes on a pick
Each of the composer's chip menus SHALL dismiss itself the moment a value is chosen.

#### Scenario: A menu is open over the text field
- **WHEN** a value is chosen from the Mode, Model or Effort menu
- **THEN** the menu closes, so the next click reaches the text field beneath it

### Requirement: The composer is locked with the reason on screen
The text field and its controls SHALL be disabled while no project is open, while the open project's folder is missing, while the environment checklist is blocking, and while a permission card or a source question is unanswered. Sending SHALL additionally be refused while the sidecar is down.

#### Scenario: A permission card is up
- **WHEN** the turn is waiting on an answer
- **THEN** the field is disabled and its placeholder asks for the approval request to be answered

#### Scenario: The sidecar is down
- **WHEN** the sidecar is not running
- **THEN** sending is refused and the line under the composer says so and offers to restart it

#### Scenario: The sidecar is coming up
- **WHEN** the sidecar is starting or restarting
- **THEN** the line under the composer says so rather than waiting silently

### Requirement: A message carrying code edits waits rather than queueing
A message whose element chips carry values the studio would write into the project's code SHALL NOT go out while a turn is running on that video, and SHALL NOT be queued. The send control SHALL carry the reason.

#### Scenario: A turn is running and the message carries writes
- **WHEN** the person tries to send a message whose chips carry code edits
- **THEN** the message stays in the composer, the control carries the reason on its tooltip, and nothing is written to disk

#### Scenario: The turn ends
- **WHEN** the video has no turn running
- **THEN** the same message sends, writing its values at Send

#### Scenario: Every change went into the code and nothing else was carried
- **WHEN** the person sends with nothing left to ask for
- **THEN** no turn is started and the message is recorded in the chat instead (see `history/transcript-store`)

#### Scenario: Some edits were refused
- **WHEN** an edit could not be written and became a request
- **THEN** a turn does run, and the refused chips reach the agent as requests rather than as records
