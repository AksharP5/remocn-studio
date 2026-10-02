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
