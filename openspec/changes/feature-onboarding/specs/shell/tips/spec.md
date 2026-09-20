## REMOVED Requirements

### Requirement: A tip appears when its feature does, not at first launch
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: One tip at a time, in catalog order
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: Nothing competes with something already asking
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: A tip points at its own anchor, or shows nothing
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: "Got it" is remembered, clicking away is not
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: "Show me" only reveals, and counts as an answer
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

### Requirement: Tips can be replayed from Settings
**Reason**: Replaced by the feature overview.
**Migration**: Use Explore Studio in Settings.

## ADDED Requirements

### Requirement: A six-chapter feature overview replaces tips
The webview SHALL offer Inspect and properties, Snapshot, Assets and stock, Components, Brand and DESIGN.md, and Export, in that order, with bundled silent video, poster and a short English chapter label. It SHALL NOT include project/chat tutorials, background work or unfinished integrations.

#### Scenario: Choosing a chapter
- **WHEN** a person chooses any chapter or uses Back/Next
- **THEN** its video appears, the previous video stops and the chosen chapter is remembered

### Requirement: Introduction waits for an idle workspace
The overview SHALL open automatically only after settings load, a working project opens, setup completes and no task or blocking surface needs attention. Closing via X, Escape, Skip or Done SHALL persist dismissal; an outside click SHALL NOT dismiss it.

#### Scenario: Setup or work in progress
- **WHEN** the project is not ready, settings are loading, Settings is open, or a task/blocker is active
- **THEN** the automatic overview is withheld until those conditions clear

#### Scenario: Returning after closing
- **WHEN** the person closes the overview and restarts
- **THEN** it does not automatically return, even if some chapters were not viewed

#### Scenario: Persistence fails
- **WHEN** saving an overview preference fails
- **THEN** a plain-language notice and retry action remain available

### Requirement: Replay is always available
Settings SHALL offer Explore Studio regardless of previous viewing, project availability or setup problems; an explicit request takes precedence over automatic-show blockers. It SHALL reopen the last selected chapter. Old tip answers SHALL NOT mark this overview dismissed.

#### Scenario: Older installation
- **WHEN** an installation has answered old tips but never dismissed the overview
- **THEN** it receives the new overview once an idle workspace is ready

#### Scenario: Unknown saved chapter
- **WHEN** the stored chapter is unavailable
- **THEN** the overview opens Inspect

### Requirement: Video never blocks learning
The active silent video SHALL play once, retain its last frame, offer native playback controls, and never advance chapters automatically. Closing or changing chapters SHALL stop the previous video. Reduced motion SHALL use a poster and manual play. Media SHALL be bundled for offline playback.

#### Scenario: Playback fails
- **WHEN** video cannot load or autoplay is refused
- **THEN** chapter navigation remains usable, with retry for errors and manual play for refused autoplay

#### Scenario: Reduced motion
- **WHEN** reduced motion is enabled
- **THEN** the poster is shown without automatic playback

### Requirement: Overview is keyboard accessible and fits the window
The modal SHALL use a compact layout with a single short header, no eyebrow or instructional body text, and no custom playback controls. Chapter labels SHALL remain readable in both themes with a neutral selected state and constant font weight. The modal SHALL hold focus, support keyboard navigation, restore focus when closed and provide compact chapter selection on narrow windows.

#### Scenario: Closing from Settings
- **WHEN** the person closes the overview opened from Settings
- **THEN** focus returns to Explore Studio


#### Scenario: Chapter transition
- **WHEN** a person chooses another chapter with a pointer
- **THEN** the selection highlight moves to the chapter and its video fades in with a small directional hint, while the previous video stops immediately
- **AND** keyboard chapter changes are instant and reduced motion removes positional movement
