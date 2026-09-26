## MODIFIED Requirements

### Requirement: Inspect is offered only when it can work, and says why not

Element selection SHALL be unavailable while the plan is Free, while the preview pane is hidden, while the pane is showing documents, with no Project open, with the Project's folder missing, while a permission card is waiting to be answered, while the preview is not yet serving, and when the preview is showing a different Project from the open chat's. A visible, serving preview SHALL explain the reason in its status area. Losing availability SHALL disable picking immediately. The Inspect menu command SHALL focus the preview and open the managed object catalogue when available, rather than toggle selection off. A move to another Project SHALL drop element references in the composer while preserving text, pictures and assets, as specified by `composer/references`.

#### Scenario: The plan is Free

- **WHEN** a preview is shown on the Free plan
- **THEN** element selection is disabled
- **AND** its status explains that Inspect and Snapshot are part of Pro

#### Scenario: The preview is on another project

- **WHEN** the preview is showing a Project other than the open chat's
- **THEN** the status reads *The preview is showing another project, not the one this chat belongs to.*

#### Scenario: The pane moves to documents while armed

- **WHEN** the pane's mode moves to Docs
- **THEN** element selection is disabled until the pane returns to Preview

#### Scenario: The open chat moves to another project

- **WHEN** the open chat moves to a different Project
- **THEN** the element references in the composer are dropped and renumbered away
- **AND** the pictures, assets and the text that was typed are left alone
