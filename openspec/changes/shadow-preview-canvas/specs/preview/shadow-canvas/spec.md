## Purpose

Provide a navigable video workspace in the main application and an explicit runtime
lifecycle so iframe-free editing can be evaluated on existing projects.

## ADDED Requirements

### Requirement: Hosting has an explicit lifetime
The app SHALL connect preview commands and events to one active surface and
ignore events from a replaced or disposed surface. The existing preview SHALL
retain its behavior during extraction of the hosting boundary.

#### Scenario: A surface is replaced
- **WHEN** the user changes the active video while an earlier preview is responding
- **THEN** only the current surface updates playback, selection and properties

#### Scenario: The surface disconnects
- **WHEN** the current preview is removed or fails to load
- **THEN** its subscriptions are released and stale commands are not delivered

### Requirement: Native preview is the main workspace
The main Studio SHALL display a real opened video without an iframe, retaining
its project dependencies. Loading and runtime failures SHALL be visible in the
workspace, and SHALL NOT reload the Studio window.

#### Scenario: A supported project loads
- **WHEN** the user opens its video in the main Studio
- **THEN** the native surface renders the project's video with playback controls

#### Scenario: Loading fails
- **WHEN** the project's native runtime or styles cannot be loaded
- **THEN** the canvas explains the failure and offers Retry and Restart preview

### Requirement: Navigation changes only the view
The canvas SHALL provide pan, pointer-anchored zoom, Fit and 100%. Zoom SHALL be
bounded, and Fit SHALL account for the inspector and playback overlays. Camera
changes SHALL NOT change video properties or create video Undo operations.

#### Scenario: Zooming beneath the pointer
- **WHEN** the user zooms at a point on the video
- **THEN** the same video point stays beneath the pointer until a zoom limit is reached

#### Scenario: The inspector opens
- **WHEN** selection opens the inspector
- **THEN** the inspector appears above the canvas without silently reframing the video

#### Scenario: The canvas is not measurable
- **WHEN** the workspace is hidden or has no positive available dimensions
- **THEN** it retains the last valid camera and does not produce invalid coordinates

### Requirement: Editing shares the camera model
Selection, direct geometry editing, text input and Snapshot SHALL account for
the camera. Handles SHALL retain usable screen-space sizes. Panel interactions
SHALL NOT trigger canvas gestures.

#### Scenario: Resizing at a zoomed view
- **WHEN** the user drags a geometry handle on a supported object
- **THEN** the edit is committed in video units through the existing operation system

#### Scenario: A rebuild arrives during an edit
- **WHEN** a rebuilt runtime is ready while a geometry gesture or inline text edit is in progress
- **THEN** the shown runtime stays until the edit has been committed or cancelled
- **AND** the element keeps following the pointer for the whole gesture

#### Scenario: A rebuilt runtime lags a saved edit
- **WHEN** a rebuilt runtime's objects document does not yet include the last operation the studio wrote, or a write is still in progress
- **THEN** the shown runtime stays, so the element does not return to an earlier position
- **AND** a later rebuild that includes the operation replaces it
- **AND** after 8 seconds without such a rebuild the lagging runtime is shown anyway

#### Scenario: A runtime is replaced during an edit
- **WHEN** the runtime is torn down for another reason, such as a retry or switching videos
- **THEN** the unfinished edit is cancelled and cannot modify the new video
