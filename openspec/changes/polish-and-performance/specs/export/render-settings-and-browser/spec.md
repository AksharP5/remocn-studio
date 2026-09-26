## MODIFIED Requirements

### Requirement: One browser policy for every renderer-backed operation

The export, the stills behind Snapshot, the hover clip, the agent's design check and the source capture SHALL all take their browser options from one place, so a graphics backend is decided once per preview host and measured once. The reading SHALL be held against the browser options it was taken with, and SHALL be measured again only when those options change. An export and a hover clip SHALL each open one browser with those options, SHALL measure the video and render it in that same browser, and SHALL close it when they end, whether they finished, failed or were cancelled. When the chosen resolution scales the video, the export SHALL close the browser it measured in and render in one opened at that scale, as the project's own renderer opens its browser for a scaled render.

#### Scenario: A second operation in the same project

- **WHEN** a still is taken after an export has already decided the backend, with the same browser options
- **THEN** the held reading is used and no second browser is opened to measure it

#### Scenario: The project changes its browser settings

- **WHEN** the project's configured backend, browser executable or Chrome mode changes
- **THEN** the next operation measures again rather than trusting the old reading

#### Scenario: An export measures and renders

- **WHEN** an export is started at the video's own resolution
- **THEN** one browser is opened with the policy's options, the video is measured in it and rendered in it
- **AND** the browser is closed when the export ends, including when it fails or is cancelled

#### Scenario: An export at a smaller or larger resolution

- **WHEN** an export is started at a resolution that scales the video
- **THEN** the browser the video was measured in is closed and the render runs in a browser opened at that scale

#### Scenario: A renderer that cannot open a browser for the studio

- **WHEN** the project's renderer does not expose a way to open a browser, or opening one fails
- **THEN** measuring and rendering each open their own browser as the renderer does by default

### Requirement: The settings are read in a process of their own, fresh for every export

Reading the project's render settings SHALL happen in a separate process, so the configuration and everything it imports are read afresh. An export SHALL always read fresh; a still, a hover clip or a design check SHALL read through a cache keyed on the modification time and size of the configuration file, of each local file it imports directly, and of the project's `package.json`, and SHALL read again as soon as any of them changes. The read SHALL be given a bounded time, and a read that fails, times out or answers unreadably SHALL fail with a sentence naming what went wrong.

#### Scenario: A configuration edited since the last render

- **WHEN** the project's Remotion config is edited and an export is started
- **THEN** the edited settings are what the render uses

#### Scenario: An export after an export

- **WHEN** a second export is started and nothing the settings are read from has changed
- **THEN** the settings are read again, so a change the cache cannot see, such as one in a file the configuration reaches through another, still reaches the render

#### Scenario: A file the configuration imports is edited

- **WHEN** a local file imported by the project's Remotion config is edited and a still is taken
- **THEN** the settings are read again and the still uses them

#### Scenario: Remotion is upgraded in the project

- **WHEN** the project's `package.json` changes and a still is taken
- **THEN** the settings are read again rather than taken from the cache

#### Scenario: A still after a still

- **WHEN** a still is taken and the configuration file has not changed
- **THEN** the settings held from the previous read are used rather than read again

#### Scenario: The read takes too long

- **WHEN** reading the project's configuration does not answer in time
- **THEN** the operation fails saying the studio gave up on reading the project's Remotion config

#### Scenario: The read answers with nothing readable

- **WHEN** the reading process answers with nothing, or with something that is not the expected answer
- **THEN** the operation fails saying the settings came back unreadable, quoting what came back
