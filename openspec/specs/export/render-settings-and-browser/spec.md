# export/render-settings-and-browser Specification

## Purpose
What the studio renders with when it drives the project's own renderer: the project's render settings read out of its own configuration, the graphics backend the headless browser is opened with, and the reading the studio puts under a render failure so a person is told what actually went wrong.

## Requirements

### Requirement: One browser policy for every renderer-backed operation

The export, the stills behind Snapshot, the hover clip, the agent's design check and the source capture SHALL all take their browser options from one place, so a graphics backend is decided once per preview host and measured once. The reading SHALL be held against the browser options it was taken with, and SHALL be measured again only when those options change.

#### Scenario: A second operation in the same project

- **WHEN** a still is taken after an export has already decided the backend, with the same browser options
- **THEN** the held reading is used and no second browser is opened to measure it

#### Scenario: The project changes its browser settings

- **WHEN** the project's configured backend, browser executable or Chrome mode changes
- **THEN** the next operation measures again rather than trusting the old reading

### Requirement: A backend the project chose is carried through and never substituted

When the project configures its own graphics backend, the studio SHALL use it, SHALL record that the project chose it, and SHALL NOT replace it with one of its own even when it cannot draw. When the project configures nothing, the studio SHALL choose a hardware backend on macOS and Windows and a software one elsewhere, and SHALL record that the studio chose it.

#### Scenario: The project configured a backend

- **WHEN** the project's Remotion config sets a graphics backend
- **THEN** the render browser is opened with exactly that backend

#### Scenario: The project configured nothing

- **WHEN** the project's Remotion config sets no backend
- **THEN** the studio opens the render browser with a hardware backend on macOS and Windows and a software one on other platforms

#### Scenario: The configured backend cannot draw

- **WHEN** the project's own backend cannot make a graphics context in the render browser
- **THEN** the studio reports it and leaves the backend alone rather than choosing another

### Requirement: The choice is measured in the browser that will do the rendering

The studio SHALL provision the renderer's browser before it asks that browser anything, then SHALL open a browser with exactly the options a render will use and ask a page whether it can make a graphics context. A studio-chosen hardware backend that cannot SHALL fall back once to the software backend and say so as a notice on the export. A renderer too old to expose what the probe needs SHALL simply not be probed.

#### Scenario: The backend works

- **WHEN** the probe makes a graphics context with the chosen backend
- **THEN** that backend is used and nothing is said

#### Scenario: The studio's own choice cannot draw

- **WHEN** the studio chose the backend and the probe cannot make a context with it
- **THEN** the studio probes the software backend, renders with it, and says on the export that the first backend could not make a context here so the render browser draws in software

#### Scenario: Neither backend can draw

- **WHEN** neither the chosen backend nor the software one can make a context
- **THEN** the chosen backend is kept and a notice says neither could make a graphics context in the render browser

#### Scenario: A renderer that cannot be probed

- **WHEN** the project's renderer does not expose what opening a page for the probe needs
- **THEN** no probe is made, the backend stands, and the reading is recorded as unknown

### Requirement: A render failure is classified and its own text is always kept

A render failure SHALL be classified as a graphics context that could not be created, a graphics context that was lost, a browser that died, a frame that never resolved, an asset that did not arrive, an encoder refusal, the scene's own code throwing, or unknown. The studio SHALL add its reading below the renderer's own message and SHALL NOT replace it. A failure it cannot read SHALL be passed through with nothing added.

#### Scenario: A scene that never finished

- **WHEN** the render fails because nothing resolved a frame in time, and the probe found the browser could make a graphics context
- **THEN** the reading names fonts, network requests, media and shaders as the usual causes and points at the project's own frame timeout setting, and does not blame the graphics backend

#### Scenario: The same failure with no graphics context available

- **WHEN** the same failure happens in a browser that could not make a graphics context at all
- **THEN** the reading says a scene that draws with the GPU never finishes compiling and names the setting that picks another backend

#### Scenario: The backend was the project's own

- **WHEN** a graphics failure is reported and the project chose the backend
- **THEN** the reading says it is the project's own setting, which the studio left alone, and suggests what the project could change

#### Scenario: Nothing to say

- **WHEN** the failure matches none of the known shapes
- **THEN** the renderer's own message is shown alone, with no reading under it

### Requirement: The project's render settings are read from the project's own option registry

The studio SHALL read the project's render settings through the option registry of the project's own renderer, taking the value and the source that renderer reports for each. It SHALL forward only the options the installed render function actually accepts, worked out from that function itself; when it cannot work that out it SHALL fall back to the set it knows and SHALL report that it did. Options that no configuration file can set SHALL be skipped without being reported.

#### Scenario: A healthy project

- **WHEN** the project's settings are read and every option answers
- **THEN** the settings are forwarded and nothing is reported

#### Scenario: The accepted set cannot be read

- **WHEN** the installed render function's accepted options cannot be worked out
- **THEN** the studio applies the set it knows and records that it could not read which options this renderer takes

#### Scenario: An option the renderer cannot answer for

- **WHEN** asking the renderer for an option's value throws
- **THEN** that option is left out and a record names it and the renderer's own error

#### Scenario: A value that cannot cross a process boundary

- **WHEN** a configured value is a function or otherwise cannot be carried between processes
- **THEN** it is not applied and a record says so

### Requirement: Browser options and per-call options are routed to where the renderer takes them

An option the renderer declares as belonging to the browser SHALL be routed into the browser options rather than sent beside them, under the spelling the renderer actually reads. Two options that share one name but belong to different calls SHALL be kept apart by which call they belong to, and SHALL NOT reach the other one.

#### Scenario: A browser option

- **WHEN** the project configures a browser option, whether the renderer declares it with a browser prefix or bare
- **THEN** it is placed in the browser options under the spelling the renderer reads, not sent as a top-level option

#### Scenario: The still and video image formats

- **WHEN** the project configures a still image format and a video image format
- **THEN** each is kept against its own call and neither is offered to the other

### Requirement: Incompatible values are dropped with a notice each

Before a render the studio SHALL drop a configured value the chosen codec would refuse and SHALL raise one notice per drop, naming the option and the reason. It SHALL drop a rate factor for a codec that has none, a ProRes profile for anything but ProRes, GIF loop counts for anything but a GIF, an audio codec the container cannot hold, a video bitrate sitting beside a quality, and a maximum encoding rate with no buffer size beside it. An option that is simply unset SHALL NOT be reported.

#### Scenario: A rate factor on a codec that has none

- **WHEN** the project configures a rate factor and the export is ProRes or GIF
- **THEN** it is left out and a notice says the option belongs to the codecs that have one, not to this codec

#### Scenario: An audio codec the container cannot hold

- **WHEN** the project configures an audio codec the chosen format cannot carry
- **THEN** it is left out and a notice names what that format does take, or says the format carries no audio at all

#### Scenario: A bitrate beside a quality

- **WHEN** both a video bitrate and a rate factor would be sent
- **THEN** the bitrate is left out and a notice says a video bitrate and a quality cannot both be set

#### Scenario: An unset option

- **WHEN** an incompatible option is configured with no value
- **THEN** nothing is dropped and nothing is said

### Requirement: What the studio decides itself is never taken from the project

The scale and the codec SHALL always be the studio's, taken from the resolution and the format chosen in the dialog rather than from the project's configuration. Once a quality is picked the studio's own rate factor or ProRes profile SHALL replace the project's. With Project default picked, the project's own quality settings SHALL reach the renderer untouched.

#### Scenario: A configured scale

- **WHEN** the project configures a scale and an export is run
- **THEN** the render uses the scale the chosen resolution implies and the configured one is not forwarded

#### Scenario: A quality is picked

- **WHEN** the person picks Draft, Standard or High and the project also configures a rate factor
- **THEN** the render carries the studio's rate factor for that quality and not the project's

#### Scenario: Project default

- **WHEN** the person leaves the quality on Project default
- **THEN** the project's own rate factor reaches the renderer as it stands

### Requirement: The settings are read in a process of their own, fresh for every export

Reading the project's render settings SHALL happen in a separate process, so the configuration and everything it imports are read afresh. An export SHALL always read fresh; a still or a design check SHALL read through a cache keyed on the configuration file's own modification time and size. The read SHALL be given a bounded time, and a read that fails, times out or answers unreadably SHALL fail with a sentence naming what went wrong.

#### Scenario: A configuration edited since the last render

- **WHEN** the project's Remotion config is edited and an export is started
- **THEN** the edited settings are what the render uses

#### Scenario: A still after a still

- **WHEN** a still is taken and the configuration file has not changed
- **THEN** the settings held from the previous read are used rather than read again

#### Scenario: The read takes too long

- **WHEN** reading the project's configuration does not answer in time
- **THEN** the operation fails saying the studio gave up on reading the project's Remotion config

#### Scenario: The read answers with nothing readable

- **WHEN** the reading process answers with nothing, or with something that is not the expected answer
- **THEN** the operation fails saying the settings came back unreadable, quoting what came back

### Requirement: A configured ffmpeg override is reported and not applied

When the project's configuration installs its own ffmpeg override, the studio SHALL detect it and SHALL say on the export that an export from the studio does not apply it. The export SHALL still run.

#### Scenario: A project with an ffmpeg override

- **WHEN** an export runs in a project whose Remotion config sets an ffmpeg override
- **THEN** a notice says the studio's export does not apply it and the render goes ahead

### Requirement: The project's settings apply to a still as they do to its own renderer

A still rendered by the studio SHALL carry the project's own configured render options for a still, including the frame timeout, the browser executable and the Chrome mode, so a still matches what the project's own tooling would produce. The studio SHALL NOT invent a default for a setting the project could make itself.

#### Scenario: A configured frame timeout

- **WHEN** the project configures a longer frame timeout
- **THEN** a still and an export both wait that long before giving up on a frame

#### Scenario: A setting the project did not make

- **WHEN** the project configures no graphics backend
- **THEN** the studio's own choice is used, recorded as the studio's, and can be overridden by the project at any time
