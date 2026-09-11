## MODIFIED Requirements

### Requirement: The app menu carries the studio's own File and Project menus

The application menu SHALL offer New Video (⌘N), New Project (⇧⌘N) and Open Folder (⌘O) under File, followed by every known project as a checkable row that switches to it, and a Project menu with Project Settings, Rename, Locate Folder, Reveal in the file manager and Remove from Studio. A View menu SHALL offer Show or hide the sidebar (⌘B), Show or hide the preview (⌘\), the three sidebar views Videos, Assets and Components (⌘1, ⌘2, ⌘3) as checkable rows, Preview or Docs (⌘D), and Restart the studio's helper (⇧⌘R). A Video menu SHALL offer Export (⌘E), Inspect (⌘I), Snapshot (⇧⌘S), Stop the turn (⌘.), Previous video and Next video (⌥⌘↑, ⌥⌘↓). Every row SHALL come from the command registry in `shell/command-palette` with its shortcut beside it. A row that does not apply SHALL be disabled rather than dropped, so the menu keeps one shape. The standard Edit and Window menus SHALL be present, so the webview keeps its clipboard and window shortcuts.

#### Scenario: Switching project from the menu

- **WHEN** the person picks another project under File
- **THEN** the studio switches to it, exactly as clicking it in the sidebar would

#### Scenario: No project is open

- **WHEN** nothing is open
- **THEN** every Project row is disabled, New Video is disabled, and every Video row is disabled

#### Scenario: The open project's folder is gone

- **WHEN** the open project's folder is not on disk
- **THEN** Reveal in the file manager is disabled while Locate Folder stays available

#### Scenario: Docs is open

- **WHEN** the pane is in Docs
- **THEN** Inspect and Snapshot are disabled under Video, the palette carries the reason the header's buttons would carry, and Export stays enabled

#### Scenario: The sidebar view is checked

- **WHEN** the sidebar shows Assets
- **THEN** Assets is the checked row under View

#### Scenario: There is no Tauri core to install a menu into

- **WHEN** the page runs without the core
- **THEN** the install fails silently and the app keeps whatever menu it had
