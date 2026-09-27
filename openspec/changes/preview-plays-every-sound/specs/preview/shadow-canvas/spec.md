## MODIFIED Requirements

### Requirement: Native preview is the main workspace
The main Studio SHALL display a real opened video without an iframe, retaining
its project dependencies. Loading and runtime failures SHALL be visible in the
workspace, and SHALL NOT reload the Studio window. A runtime failure SHALL be
worded and offer Retry; the player's own fallback symbol SHALL NOT stand in for
it. The preview SHALL play a video however many sounds it has mounted at once.

#### Scenario: A supported project loads
- **WHEN** the user opens its video in the main Studio
- **THEN** the native surface renders the project's video with playback controls

#### Scenario: Loading fails
- **WHEN** the project's native runtime or styles cannot be loaded
- **THEN** the canvas explains the failure and offers Retry and Restart preview

#### Scenario: The video throws while it plays
- **WHEN** the video throws an error while the preview renders one of its frames
- **THEN** the canvas says the video could not render and offers Retry
- **AND** no bare warning symbol is left in place of the video

#### Scenario: Many sounds at once
- **WHEN** a video keeps more sound elements mounted at the same time than the player's default pool of shared audio tags, as a score with twenty one-shot effects in open-ended sequences does
- **THEN** the preview plays it through, as the export renders it
