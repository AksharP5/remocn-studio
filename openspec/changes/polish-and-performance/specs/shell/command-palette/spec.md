## MODIFIED Requirements

### Requirement: The shortcut table

The studio SHALL bind exactly these shortcuts, and no reader SHALL add another:

| Shortcut | Command |
| --- | --- |
| ⌘K | Open the palette |
| ⌘T | New Chat |
| ⌘N | New Video |
| ⇧⌘N | New Project |
| ⌘O | Open Folder |
| ⌘, | Settings |
| ⌘E | Export |
| ⌘I | Inspect |
| ⇧⌘S | Snapshot |
| ⌘B | Show or hide the sidebar |
| ⌘\ | Show or hide the preview |
| ⌘1 ⌘2 ⌘3 | Sidebar: Videos, Assets, Components |
| ⌘D | Preview or Docs |
| ⌥⌘↑ ⌥⌘↓ | Previous or next video |
| ⌘. | Stop the running turn |
| ⇧⌘R | Restart the studio's helper |

A shortcut SHALL fire while the composer or any text field has focus, since none of the table's keys is one a macOS text field owns; a key the text field does own SHALL never be bound. A shortcut SHALL fire once per press whichever reader received it. Keys that act on a focused sidebar row belong to that row and are specified by `history/chat-pane`; they are not shortcuts.

#### Scenario: Export from the composer

- **WHEN** the caret is in the composer and ⌘E is pressed
- **THEN** the Export dialog opens and the composer's text is untouched

#### Scenario: Next video while typing

- **WHEN** the caret is in the composer and ⌥⌘↓ is pressed
- **THEN** the next video in the sidebar's order opens, and the draft in the composer stays with the chat it was typed in

#### Scenario: Stop with nothing running

- **WHEN** ⌘. is pressed and no turn is running in the open video
- **THEN** nothing happens and nothing is reported

#### Scenario: A sidebar view while the sidebar is hidden

- **WHEN** ⌘2 is pressed while the sidebar is hidden
- **THEN** the sidebar shows, on Assets

#### Scenario: A new chat from the keyboard

- **WHEN** ⌘T is pressed, or New Chat is chosen from the File menu or the palette, while a chat is open
- **THEN** a new chat starts on the open chat's video, exactly as the row's New chat button starts one
- **AND** with no video open the command is unavailable and says to open a chat first
- **AND** on a video the code no longer renders the command is unavailable and says nothing in the project renders that video anymore, as the row's New chat button is
