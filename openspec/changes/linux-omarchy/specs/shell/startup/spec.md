## ADDED Requirements

### Requirement: Linux starts the complete studio

The Linux app SHALL launch the same editor, agents, library, preview and export workflows as macOS, with its own bundled Bun runtime and resources. The core SHALL use platform application data directories and report the actual operating system.

#### Scenario: Launching from the desktop

- **WHEN** the installed app is launched on Omarchy
- **THEN** the studio and its helper become ready without a developer shell or repository checkout

#### Scenario: A native dependency is unavailable

- **WHEN** a platform integration cannot complete
- **THEN** the affected workflow reports the reason without silently substituting an in-memory credential store or a macOS command

#### Scenario: The AppImage's media helper is relocated

- **WHEN** the packaging hook points at a missing media plugin scanner and the AppImage contains the scanner at its Linux library path
- **THEN** the core uses the bundled scanner before loading the preview's media dependencies
- **AND** a working configured scanner or custom override remains unchanged

### Requirement: Linux keyboard editing uses the primary modifier

Canvas Undo and video/chat row deletion SHALL use Control on Linux and Command on macOS. Unmodified row deletion keys and keys owned by text editors SHALL retain their existing behavior.

#### Scenario: Undoing a canvas change on Linux

- **WHEN** the canvas has focus and Ctrl+Z or native Edit > Undo is invoked
- **THEN** the video's most recent undoable change is reverted once
- **AND** native menu acceleration does not consume Undo as a text-editor command

#### Scenario: Undoing text on Linux

- **WHEN** a text field or inline text editor has focus and native Undo is invoked
- **THEN** WebKit retains its text-editor Undo behavior

#### Scenario: Requesting deletion from a Linux row

- **WHEN** a video or chat row has focus and Ctrl+Backspace or Ctrl+Delete is pressed
- **THEN** the row's existing deletion action runs, including confirmation where required
