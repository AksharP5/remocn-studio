## Purpose

The first second of the app: a window that is never shown empty, an in-window splash that covers the waits before the shell can be drawn, and the difference between a project list that is empty and one that could not be read.

## ADDED Requirements

### Requirement: The window is revealed, never drawn empty

The studio's main window SHALL start hidden and SHALL be revealed only once the page has had a chance to paint, so no frame of an unpainted or system-coloured window is ever on screen. The native window background SHALL be the dark sidebar colour, so a live resize cannot expose the system's light window colour.

#### Scenario: The page asks to be shown

- **WHEN** the page's document has loaded
- **THEN** the webview asks the core to reveal the window on the second animation frame after that
- **AND** the window becomes visible with the splash already painted

#### Scenario: The page never gets that far

- **WHEN** the page fails before it can ask to be revealed
- **THEN** the core shows the window itself 1.5 seconds after start-up
- **AND** the window is visible with whatever the page did manage to draw, rather than staying hidden

#### Scenario: The window is resized during start-up

- **WHEN** the window is resized while the page has not yet painted its full area
- **THEN** the area the page has not painted is the window's own dark background
- **AND** no light system colour appears

### Requirement: The splash is part of the page, not a second window

The splash SHALL be part of the studio's own page, drawn before anything else is interactive, and SHALL cover the whole window while the shell is being assembled. It SHALL announce itself as a loading status.

#### Scenario: The first paint

- **WHEN** the window is revealed
- **THEN** the splash covers the window with the studio's wordmark over the animated field
- **AND** the shell being assembled underneath is not visible until the splash leaves

#### Scenario: Dragging while it is up

- **WHEN** the person drags the window by the splash
- **THEN** the window moves, as it does when dragged by the title bar band

### Requirement: The splash waits for the shell to be ready

The splash SHALL stay up until every start-up wait has settled: the stored settings hydrated, the project list answered, the chats of the open project answered, and the videos of the open project loaded. A project list that is briefly empty because it has not answered yet SHALL NOT be shown as an empty studio.

#### Scenario: A returning person with projects

- **WHEN** the project list has not answered yet
- **THEN** the splash is still up
- **AND** first-run onboarding is not drawn underneath it

#### Scenario: Chats still arriving

- **WHEN** settings, projects and videos have settled but the chats of the open project have not
- **THEN** the shell is not yet considered ready and the splash stays

### Requirement: The splash holds a minimum and leaves at a cap

The splash SHALL stay for at least 1.5 seconds, so its draw lands and is seen, and SHALL leave no later than 6 seconds after it appeared whether or not the shell has settled. Between those two, it SHALL leave as soon as the shell settles.

#### Scenario: Everything settles quickly

- **WHEN** the shell is ready before the first 1.5 seconds have passed
- **THEN** the splash keeps drawing until 1.5 seconds have passed
- **AND** it then leaves

#### Scenario: Something is slow

- **WHEN** the shell is still not ready at 1.5 seconds
- **THEN** the splash holds, without restarting its draw
- **AND** it leaves at 6 seconds regardless, revealing the shell and whatever the sidecar's status row says

#### Scenario: Reduced motion is asked for

- **WHEN** the operating system asks for reduced motion
- **THEN** the splash holds from the start instead of drawing its entrance
- **AND** the same minimum and cap still apply

### Requirement: A list that failed is not a list that is empty

A failure to read the project list SHALL be reported as its own screen naming the failure, with a way to try again. It SHALL NOT be rendered as first-run onboarding.

#### Scenario: The project list cannot be read

- **WHEN** the project list fails and no project is open
- **THEN** the conversation reads *The project list could not be read* with the failure's own message
- **AND** a Try again button re-reads the list
- **AND** the start-up backdrop is not drawn

#### Scenario: The splash still dissolves

- **WHEN** the project list has failed
- **THEN** the splash still leaves rather than holding over a known failure
- **AND** the failure card is what the person sees

#### Scenario: A folder that would not open

- **WHEN** opening a folder fails but the project list itself is intact
- **THEN** the list keeps its projects and the failure is reported without replacing the conversation
- **AND** first-run onboarding is not shown in place of the list

### Requirement: First run explains the studio before a project exists

With no project open, no transcript to show and no list failure, the conversation SHALL show the four-step start-up screen — start a project, describe the video, watch it and point at it, export the mp4 — with New Project and Open an existing project, and SHALL say that a signed-in agent is required.

#### Scenario: A studio with no projects

- **WHEN** the project list has answered with nothing
- **THEN** the start-up screen is shown with its four steps and both buttons
- **AND** the animated backdrop is drawn behind it

#### Scenario: A project is open but has no conversation yet

- **WHEN** a project is open and its chat has no entries
- **THEN** the start-up screen SHALL NOT be shown, and the empty conversation invites a first message instead

#### Scenario: The new-project wizard is open

- **WHEN** the new-project or new-video wizard is open
- **THEN** the wizard replaces the conversation body
- **AND** the animated backdrop stays drawn behind the wizard
