## ADDED Requirements

### Requirement: Rows answer a secondary click and the keyboard

A video row and a chat row SHALL answer a secondary click with a native menu of the actions the row already offers, and a focused row SHALL take its own keys. Every action SHALL go through the same path its button or menu item uses, so deleting from the keyboard or the menu forgives exactly as deleting with the mouse does.

#### Scenario: Right-clicking a video

- **WHEN** the person right-clicks a video row
- **THEN** a menu offers Open, New Chat, Rename…, Register in this project for a video the code no longer renders, and Delete Video…
- **AND** New Chat is unavailable for a video the code no longer renders

#### Scenario: Right-clicking a chat

- **WHEN** the person right-clicks a chat row
- **THEN** a menu offers Open and Delete Chat, and Delete Chat is unavailable while that chat's turn is running or waiting

#### Scenario: Renaming a video from the keyboard

- **WHEN** a video row has focus and F2 is pressed
- **THEN** the rename dialog opens with the video's name

#### Scenario: Deleting from the keyboard

- **WHEN** a chat row has focus and ⌘⌫ is pressed
- **THEN** the chat is deleted with the same ten-second Undo as the row's delete button
- **AND** on a focused video row ⌘⌫ asks to delete the video, as Delete Video… does
