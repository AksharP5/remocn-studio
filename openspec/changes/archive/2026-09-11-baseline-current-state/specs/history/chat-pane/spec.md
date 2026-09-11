## Purpose

The left pane lists a project's videos with their chats under them, and it is the only place that shows a turn running or waiting somewhere the person is not looking. This capability covers how those rows are grouped, ordered, rolled up, capped, worded and deleted, so the pane can never hide something that needs an answer.

## ADDED Requirements

### Requirement: A video is a group and a chat is a row
The pane SHALL render one group per video of the open project, with that video's chats as rows under it. A chat SHALL NOT appear outside the video it belongs to.

#### Scenario: A project's videos are listed
- **WHEN** a project is open
- **THEN** each of its videos is a group, and each chat is a row under the video it was created in

#### Scenario: A video has no chats yet
- **WHEN** a video's group is expanded and it holds no chats
- **THEN** the group says there are no chats yet rather than rendering an empty list

#### Scenario: A video is clicked
- **WHEN** the person clicks a video row
- **THEN** that video's most recent chat opens, taken from the store's own order rather than from the pane's display order
- **AND** the chevron beside the row expands or collapses the list without opening anything

### Requirement: Attention beats recency, and only where it exists
Inside a group, rows SHALL be ordered waiting first with the longest wait leading, then running, then everything else in the order the store gave. Across groups, the store's order SHALL be the base, and a group holding a waiting chat SHALL be promoted above the rest with the base order preserved within each half.

#### Scenario: A chat is waiting on an answer
- **WHEN** one chat in a group has a permission card or a source question outstanding
- **THEN** it leads its group, and its group is promoted above groups with nothing waiting

#### Scenario: Two chats are waiting
- **WHEN** two chats in a group are waiting
- **THEN** the one that has been waiting longest leads

#### Scenario: Nothing is running anywhere
- **WHEN** no turn is running or waiting
- **THEN** the pane's order is exactly the order the store gave, unchanged

### Requirement: A video the code no longer renders leaves the list
The pane SHALL split its groups into the videos the project's compiled bundle still names and the videos it does not, rendering the second half under a heading reading "Not in the code". The split SHALL happen after promotion, so a missing video with a waiting chat rises within its own half and can never outrank a live one.

#### Scenario: A video is no longer registered
- **WHEN** nothing in the project renders a video's composition id
- **THEN** its group moves under the "Not in the code" heading, its name is dimmed, and it keeps its chats, their transcripts and their rollup
- **AND** a hint names the composition id nothing renders any more

#### Scenario: A missing video is waiting
- **WHEN** a chat under a missing video is waiting
- **THEN** it is promoted within the missing half only, never above a live group

### Requirement: The cap counts only quiet rows
A group SHALL show at most eight quiet chats. Waiting, running, failed and unread rows SHALL always render and SHALL NOT count toward the hidden total, so the number in "Show N more" always matches what expanding reveals.

#### Scenario: A video has many settled chats
- **WHEN** a group holds more than eight quiet chats
- **THEN** eight render and the rest are offered as "Show N more"
- **AND** clicking it reveals exactly N further rows, after which the control reads "Show less"

#### Scenario: A group is over the cap and something is running
- **WHEN** a group holds more than eight quiet chats and one running chat
- **THEN** the running chat renders regardless of the cap and is not counted in N

### Requirement: A collapsed group carries a worst-of rollup
While a group is collapsed, it SHALL carry one marker for the most urgent state among its chats, in the order waiting, then running, then failed, then unread. Waiting SHALL carry the number of chats waiting. An expanded group SHALL carry no rollup.

#### Scenario: A group holds a waiting chat and a failed one
- **WHEN** the group is collapsed
- **THEN** the rollup reads as waiting with its count, not as failed

#### Scenario: A group holds only chats with news
- **WHEN** nothing is waiting, running or failed and one chat is unread
- **THEN** the rollup is the unread marker

#### Scenario: A group is expanded
- **WHEN** the person expands a group
- **THEN** the rollup disappears and each row says what its own chat is doing

### Requirement: Rows are adaptive and never truncate what is urgent
A settled chat SHALL be one line: its title and the time since it was last updated. A waiting, running or failed chat SHALL take a second line instead of that time, wording what it is waiting for, what it is doing, or the first non-empty line of its error.

#### Scenario: A chat is waiting
- **WHEN** a chat is waiting on an answer
- **THEN** its second line reads the time it has been waiting and the name of the thing that asked
- **AND** that timer counts up, and never counts down toward the ten-minute auto-deny

#### Scenario: A chat is running with a plan open
- **WHEN** a running turn has a plan with a task in progress
- **THEN** the second line reads the running task's present-continuous phrase, how many of the plan are done out of the total, and the elapsed time

#### Scenario: A chat is running with no plan
- **WHEN** a running turn has written no plan
- **THEN** the second line reads that it is running, with the elapsed time

#### Scenario: A settled chat is shown
- **WHEN** a chat is neither waiting, running nor failed
- **THEN** it is one line and no plan is derived for it, however many plans its transcript holds

### Requirement: Elapsed and relative times come from one tick
Every time in the pane SHALL be derived from a single clock reading refreshed once a minute, so no two rows can be reading different clocks.

#### Scenario: A minute passes with a turn running
- **WHEN** the tick fires
- **THEN** every waiting timer, running timer and relative timestamp in the pane advances together

#### Scenario: A chat was updated a moment ago
- **WHEN** less than a minute has passed
- **THEN** the row reads "just now" rather than a count of seconds

### Requirement: A turn that ends elsewhere marks its row
A turn that finishes in a chat that is not the one on screen SHALL mark that chat unread, and the pane SHALL show the mark until the chat is opened. Status per row — running, waiting, failed — SHALL be derived from the live turn state and never stored.

#### Scenario: A background turn finishes
- **WHEN** a turn ends in a chat the person is not looking at
- **THEN** its row carries an unread marker, and its group's rollup accounts for it while collapsed

#### Scenario: The chat is opened
- **WHEN** the person opens that chat
- **THEN** the unread marker goes

### Requirement: Hovering a row hides nothing
The status marker SHALL have its own column at the leading edge of the row and the delete control its own slot at the trailing edge, so pointing at a chat never removes the thing being checked.

#### Scenario: The pointer moves over a running chat
- **WHEN** the row is hovered
- **THEN** the running marker stays visible and the delete control appears beside it

#### Scenario: A chat is busy
- **WHEN** a chat is running or waiting
- **THEN** no delete control is offered for it at all

### Requirement: Deleting a chat forgives
Deleting SHALL remove the row from the list at once and hold the actual deletion behind a ten-second undo window. Undo SHALL put the row back at the index it left from, restoring the selection if that chat was open. Quitting inside the window SHALL drop the deletion rather than hurry it.

#### Scenario: A chat is deleted
- **WHEN** the person deletes a chat
- **THEN** the row leaves the list immediately and a notice offers Undo for ten seconds
- **AND** the chat is only removed from the store once that window has passed

#### Scenario: Undo is pressed
- **WHEN** Undo is pressed inside the window
- **THEN** the row returns at its old index, and if that chat was the open one it becomes open again

#### Scenario: The app quits inside the window
- **WHEN** the app quits before the window elapses
- **THEN** the deletion is abandoned and the chat is there on the next launch

#### Scenario: The project is closed inside the window
- **WHEN** the chat's project is removed from the list while the deletion is pending
- **THEN** the pending deletion is dropped along with its notice

### Requirement: Expansion is remembered and the open video is opened
Which video groups are expanded SHALL be remembered in `settings.json` under `expandedVideos`. Opening a chat SHALL expand the video it belongs to.

#### Scenario: The app is relaunched
- **WHEN** the studio starts again
- **THEN** the groups that were expanded are expanded

#### Scenario: A chat in a collapsed video is opened
- **WHEN** a chat becomes the open one and its video is collapsed
- **THEN** that video expands, and the expansion is remembered

### Requirement: The active row carries the emphasis
The open chat's row SHALL carry the emphasis, through its own background and full-contrast title. An inactive row's title SHALL use the muted foreground rather than a further fade of the sidebar's own colour.

#### Scenario: One chat of several is open
- **WHEN** the pane lists several chats
- **THEN** the open one is the readable, emphasised row and the others are muted but still meet the contrast floor for their size
