## Purpose

The shape of the window: the sidebar beside the resizable chat, preview and properties panes, how each is shown, hidden and remembered, the Preview and Docs switch in the preview's header, the theme, and the title bar band the shell breathes through.

## ADDED Requirements

### Requirement: The window is a sidebar beside a resizable group

The window SHALL hold a fixed-width sidebar and, beside it, a resizable group of the chat pane and the preview pane, with the properties pane as a third member of that group while it has something in it. The divider between chat and preview SHALL be draggable, and each pane SHALL keep a minimum width of its own.

#### Scenario: Resizing the panes

- **WHEN** the person drags the divider between the chat and the preview
- **THEN** both panes resize and neither goes below its own minimum width

#### Scenario: The sidebar is not resizable

- **WHEN** the person looks for a divider between the sidebar and the panes
- **THEN** there is none: the sidebar has one width and only ever collapses

#### Scenario: A pane slide is running

- **WHEN** the sidebar or the preview is opening or closing
- **THEN** the preview keeps the width it had until the animation settles
- **AND** the compiled page inside it is not relaid out while the slide runs

### Requirement: A pane layout is remembered per pane combination

The width the person drags the panes to SHALL be remembered across launches, and SHALL be stored separately for each set of panes the resizable group holds — the chat with the preview, and the chat with the preview and the properties pane. A width stored for one set SHALL NOT be read back into another. Hiding the preview SHALL collapse it within the same set rather than storing a layout of its own.

#### Scenario: Coming back to a resized window

- **WHEN** the person resized the panes and relaunches
- **THEN** the panes come back at the widths they were left at

#### Scenario: The properties pane opens

- **WHEN** the properties pane appears beside a chat-and-preview layout
- **THEN** the layout stored for the three panes is read back, not the one stored for two

#### Scenario: Nothing was ever dragged

- **WHEN** the person has never moved a divider
- **THEN** the panes take their default proportions and nothing is stored

### Requirement: The preview is shown by default and toggled from either header

The preview SHALL be shown by default once there is a project, SHALL be hidden and shown from a button in the preview's own header and a button in the chat pane's header, and the choice SHALL persist across launches as `previewPane` in `settings.json`.

#### Scenario: Hiding the preview

- **WHEN** the person presses *Hide the preview* in the preview's header
- **THEN** the preview slides away and the chat takes the window
- **AND** a *Show the preview* button appears in the chat pane's header

#### Scenario: A studio with no projects

- **WHEN** no project exists and the person has never chosen
- **THEN** the preview is not shown

#### Scenario: The preview is hidden, not unmounted, for Docs

- **WHEN** the pane is switched to Docs
- **THEN** the preview is hidden rather than taken down
- **AND** the page it holds is not reloaded when the person switches back

### Requirement: A preview dragged shut is the same as a preview hidden

Collapsing the preview panel by dragging the divider past its minimum SHALL be treated as hiding the preview, so the toggle that brings it back is the one already on screen. A collapse reported while the preview is already hidden SHALL be ignored, and a layout stored collapsed SHALL heal itself on the next launch.

#### Scenario: Dragging the divider all the way over

- **WHEN** the person drags the divider past the preview's minimum width
- **THEN** the preview is recorded as hidden
- **AND** *Show the preview* appears in the chat pane's header
- **AND** the choice survives a relaunch, and so does the way back

#### Scenario: The studio collapses the panel itself

- **WHEN** the panel reports a collapse that the studio asked for because the preview was already hidden
- **THEN** nothing more is recorded and the state does not change

### Requirement: The properties pane exists only while it has something in it

The properties pane SHALL be mounted only while an element with tunable properties is selected in the preview, and SHALL be unmounted when that selection is cancelled. What it contains and how it is closed belongs to preview/properties-pane.

#### Scenario: An element with a schema is picked

- **WHEN** Inspect selects an element that declares tunable properties
- **THEN** the properties pane appears as a fourth column beside the preview

#### Scenario: An element with no schema is picked

- **WHEN** the selected element declares no tunable properties
- **THEN** no properties pane appears and the compact comment card over the frame is used instead

#### Scenario: The preview is hidden

- **WHEN** the preview is hidden
- **THEN** the properties pane is not shown either

### Requirement: The sidebar collapses and is remembered

The sidebar SHALL be collapsible from the button on its own brand row and from a button in the chat pane's header, and the choice SHALL persist across launches as `projectsPane` in `settings.json`. While collapsed it SHALL take no focus and no keys.

#### Scenario: Hiding the sidebar

- **WHEN** the person hides the sidebar
- **THEN** it slides away, the panes take the space, and *Show the project list* appears in the chat pane's header

#### Scenario: Tabbing while it is closing

- **WHEN** the sidebar is hidden or hiding
- **THEN** nothing inside it can be reached by keyboard

### Requirement: The sidebar shows one of three views

The sidebar SHALL show exactly one of Videos, Assets or Components at a time, SHALL remember which across launches as `paneView` in `settings.json`, and SHALL move between them with a direction taken from their order — Videos is the root, so entering another view pushes and coming back pops.

#### Scenario: Opening Assets

- **WHEN** the person switches the sidebar to Assets
- **THEN** the view slides in from the direction its position implies
- **AND** the choice comes back on the next launch

#### Scenario: Picking the view already open

- **WHEN** the person picks the view that is already showing
- **THEN** nothing moves and nothing is written

### Requirement: The preview's header switches between Preview and Docs

The preview pane's header SHALL carry a two-way switch between Preview and Docs in place of a title. The choice and the open document SHALL be kept per video for as long as the app runs and SHALL NOT be written to disk, so moving to another video and back lands on the tab that was open and a relaunch starts on the preview.

#### Scenario: Reading a document and coming back

- **WHEN** the person opens Docs on one video, moves to another video, and returns
- **THEN** the first video is still in Docs, on the document that was open
- **AND** the second video is on its own choice

#### Scenario: Relaunching

- **WHEN** the app is relaunched
- **THEN** every video starts on the preview

#### Scenario: Docs is open

- **WHEN** the pane is in Docs
- **THEN** Inspect and Snapshot leave the header
- **AND** Export stays

### Requirement: The studio is dark by default and follows the system only if asked

The theme SHALL be dark until a choice is made, and Appearance SHALL offer Dark, Light and System. The choice SHALL persist across launches and SHALL be applied to the document without a flash of the wrong theme.

#### Scenario: A first launch

- **WHEN** nobody has chosen a theme
- **THEN** the studio is dark, whatever the operating system's appearance is

#### Scenario: Choosing System

- **WHEN** the person picks System
- **THEN** the studio follows the operating system's appearance from then on

### Requirement: The title bar band carries a shader that can be turned off

The band under the traffic lights SHALL carry an animated field whose speed and hue follow what the studio is doing — calm while idle, faster while a turn runs, another hue while something waits or has failed. Showing the field SHALL be a preference (`titlebarShader`), animating it SHALL be a second preference (`titlebarMotion`), both on by default and both remembered. The band SHALL keep the same height either way, so nothing below it moves.

#### Scenario: Turning the shader off

- **WHEN** the person turns *Show the shader* off in Appearance
- **THEN** the band is the sidebar's own plain colour
- **AND** *Animate it* is disabled, since there is nothing left to animate
- **AND** both choices come back on the next launch

#### Scenario: Turning only the motion off

- **WHEN** the person turns *Animate it* off
- **THEN** the field holds one frame and its hue still follows the mood

#### Scenario: The system asks to reduce motion

- **WHEN** the operating system asks for reduced motion
- **THEN** the field holds one frame regardless of the preference

#### Scenario: No project yet, or no WebGL

- **WHEN** no project has been opened, or the webview cannot give the page a WebGL context
- **THEN** the band is drawn plain rather than failing

### Requirement: The app menu carries the studio's own File and Project menus

The application menu SHALL offer New Video (⌘N), New Project (⇧⌘N) and Open Folder (⌘O) under File, followed by every known project as a checkable row that switches to it, and a Project menu with Project Settings, Rename, Locate Folder, Reveal in the file manager and Remove from Studio. A row that does not apply SHALL be disabled rather than dropped, so the menu keeps one shape. The standard Edit, View and Window menus SHALL be present, so the webview keeps its clipboard and window shortcuts.

#### Scenario: Switching project from the menu

- **WHEN** the person picks another project under File
- **THEN** the studio switches to it, exactly as clicking it in the sidebar would

#### Scenario: No project is open

- **WHEN** nothing is open
- **THEN** every Project row is disabled, and New Video is disabled

#### Scenario: The open project's folder is gone

- **WHEN** the open project's folder is not on disk
- **THEN** Reveal in the file manager is disabled while Locate Folder stays available

#### Scenario: There is no Tauri core to install a menu into

- **WHEN** the page runs without the core
- **THEN** the install fails silently and the app keeps whatever menu it had
