## ADDED Requirements

### Requirement: Linux native menus operate on the studio

The Linux menu SHALL expose the studio's file, editing and window actions using supported native APIs. Clipboard editing SHALL work on Wayland without X11 keystroke injection. Shortcut labels and file-manager wording SHALL match Linux.

#### Scenario: Editing a focused field

- **WHEN** Cut, Copy, Paste, Select All, Undo or Redo is chosen from the Linux menu
- **THEN** the action applies to the focused editable field

#### Scenario: A menu action fails

- **WHEN** the native action cannot complete
- **THEN** the existing menu error handler reports the failure
