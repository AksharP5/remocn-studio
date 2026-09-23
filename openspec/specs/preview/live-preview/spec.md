# preview/live-preview Specification

## Purpose
The right pane plays the video the open chat is about, compiled by the project's own Remotion bundler with the studio's player in place of the Remotion Studio UI, so that source the studio has never seen renders live and the pixels are always the project's own.

## Requirements

### Requirement: Playback controls sit below the frame

The preview SHALL use a persistent playback panel below the frame, with a seek bar, Play/Pause, previous and next frame actions, elapsed and total time, and a mute control. Wider panels SHALL also show a volume slider. The embedded player's controls, click-to-play and double-click-to-fullscreen SHALL be disabled so playback interactions do not intercept editing gestures on the frame. The frame SHALL fit the resolved video dimensions while leaving room for the playback panel.

#### Scenario: Playback is controlled from the panel

- **WHEN** Play or Pause is pressed
- **THEN** the existing preview player changes its playback state
- **AND** the panel follows the player's reported frame, playback, buffering and sound state

#### Scenario: A precise frame is chosen

- **WHEN** the seek bar or a frame-step action is used
- **THEN** playback pauses and seeks to a whole frame within the video's bounds
- **AND** the action does not clear the selected object

#### Scenario: Playback shortcuts are used

- **WHEN** the preview has focus outside text inputs and other interactive controls
- **THEN** Space toggles playback and Left/Right move one frame
- **AND** those shortcuts do not intercept input elsewhere in the app

#### Scenario: The player is not ready

- **WHEN** no video is ready to receive playback commands
- **THEN** the playback panel keeps its space and disables its controls
- **AND** the time display shows placeholders

#### Scenario: Fullscreen is available

- **WHEN** fullscreen is supported and the person enters it
- **THEN** the frame and its playback panel enter fullscreen together
- **AND** a failed fullscreen request is described in the panel

#### Scenario: Playback reports an error

- **WHEN** the player reports a playback error
- **THEN** the panel shows a readable failure message without moving the frame

### Requirement: A preview host per project compiles the project's own bundle

Opening a Project SHALL start one preview host for it: a child process whose working directory is the project, which compiles the project with its own bundler and serves the result. The host SHALL report compile progress as a percentage while it compiles and SHALL report the origin it serves from once the first compile finishes. A Project whose folder is missing, or which is still being scaffolded, SHALL get no host at all.

#### Scenario: A project is opened

- **WHEN** a Project becomes the one the studio is showing
- **THEN** a preview host for it is started with the project as its working directory
- **AND** the pane reads *Building the project* with the compiler's percentage
- **AND** the pane plays as soon as the first compile settles

#### Scenario: The project does not compile

- **WHEN** the compiler reports errors
- **THEN** the pane shows the compiler's own messages rather than a player
- **AND** a Restart button is offered beside the other preview actions

#### Scenario: The folder is not a Remotion project

- **WHEN** the host cannot find an entry point in the project
- **THEN** the preview fails with a sentence naming the conventional paths it looked for and the option of setting one in the project's Remotion config
- **AND** nothing else about the studio is blocked, so the agent can still be asked to set the project up

### Requirement: Everything the preview runs is resolved from the project

The studio SHALL bundle no Remotion of its own. The bundler, its compiler, the player, the entry point and the configured build override SHALL all be resolved from the project's own installed packages and configuration. A build override that answers asynchronously SHALL be awaited before its result is used. A package that is not installed SHALL be reported by name, with the install command for the project's own package manager.

#### Scenario: The project declares a build override

- **WHEN** the project's Remotion config sets a build override
- **THEN** the override runs over the configuration the preview compiles with
- **AND** an override that answers asynchronously is awaited rather than being put into the configuration as it stands

#### Scenario: The project has no dependencies installed

- **WHEN** the bundler cannot be resolved from the project
- **THEN** the preview fails with a sentence naming the package and the command to install it in the project folder
- **AND** the command named is the one for the manager the project's own lockfile chose

#### Scenario: The entry point is declared rather than conventional

- **WHEN** the project sets its entry point in its Remotion config
- **THEN** that entry point is what is compiled
- **AND** the conventional paths are consulted only when the project's own tooling cannot answer

### Requirement: The Remotion root is found, not assumed

The folder a person opened SHALL NOT be assumed to be the Remotion root. The studio SHALL look for a Remotion config in the opened folder and, failing that, in its subfolders to a small depth, skipping dependency, output and hidden folders and never following symbolic links. Exactly one such folder SHALL be taken as the root. Failing that, the studio SHALL climb to the nearest enclosing folder holding a package manifest. When the root differs from the folder that was opened, that folder's name SHALL be remembered as a guess at which video to play.

#### Scenario: A folder inside a project is opened

- **WHEN** the opened folder sits inside a Remotion project
- **THEN** the host works from the project root rather than from the opened folder
- **AND** the opened folder's name becomes the fallback guess at which video to play

#### Scenario: The opened folder holds several Remotion projects

- **WHEN** more than one nested Remotion project is found under the opened folder
- **THEN** the preview refuses with a sentence asking for the specific Remotion project folder to be opened
- **AND** no project is chosen on the studio's behalf

### Requirement: The pane plays the video the open chat names

The preview page SHALL be asked for one video by its composition id, and SHALL play that one. A composition id the project does not register SHALL NOT be substituted: nothing plays, and the pane SHALL say which video was asked for. With no video asked for, the page SHALL fall back in order to the opened folder's name, then to a composition named `Main`, then to the first one the project registers.

#### Scenario: The open chat's video is registered

- **WHEN** the page is opened for a video the project registers
- **THEN** that video plays
- **AND** the pane says nothing further about the choice

#### Scenario: Nothing in the project renders that video

- **WHEN** the page is opened for a composition id the project does not register
- **THEN** no player is mounted
- **AND** the pane reads that nothing in this project renders that video, naming it, and suggests asking the agent to register it or opening a video that is in the code

#### Scenario: The project registers nothing at all

- **WHEN** the project's own root registers no compositions
- **THEN** the pane reads *This project registers no videos.*

#### Scenario: No video was asked for

- **WHEN** the page is opened with no composition id
- **THEN** the composition matching the opened folder's name plays, and the pane says it was matched from the folder
- **AND** with no such match, `Main` plays, and failing that the first registered composition plays with the pane saying none was asked for

### Requirement: The page reports what it picked and what it resolved

Every time the page's pick or its resolved metadata changes, the page SHALL report to the studio: the composition id it settled on or none, the reason it settled on it, the full list of composition ids the project registers, how many there are, whether the metadata could be resolved, and any failure the resolution raised. When the metadata resolves, the report SHALL carry the width, height, frame rate and duration the player is really mounted with, so the same numbers are what an Export forecasts from. The list of registered compositions is what the studio reconciles its own list of Videos against, which is specified by the `projects/videos` capability; the same report is what the environment checklist's composition row reads, which is specified by the `projects/environment-checklist` capability.

#### Scenario: A video computes its own metadata

- **WHEN** the composition declares a metadata calculation rather than fixed numbers
- **THEN** the page resolves it and reports the resolved numbers
- **AND** while it cannot be resolved the pane reads that this video computes its metadata, which the preview cannot resolve yet

#### Scenario: Resolving the metadata throws

- **WHEN** the metadata calculation fails
- **THEN** the report carries the failure's own message as trouble
- **AND** no player is mounted for that video

#### Scenario: The catalogue is momentarily empty

- **WHEN** the page reports an empty list of compositions before the project's root has registered its own
- **THEN** the studio holds that report for a short settle window rather than publishing it
- **AND** a report with compositions in it cancels the wait and is published at once, so a transient empty list never renders as an empty project

### Requirement: One host per project, and stopping it releases it

There SHALL be at most one preview host per Project, serving one compiled bundle for every video in it: moving between Videos of one Project SHALL be a page load and not another compile. The preview's request SHALL be its lifetime: there is no separate stop, and cancelling the request SHALL stop the host. No host SHALL be kept running for a Project that is not being previewed.

#### Scenario: Another video of the same project is opened

- **WHEN** the open chat moves to a different Video of the same Project
- **THEN** the same host serves it and the page is reloaded for the new composition id
- **AND** the project is not compiled again

#### Scenario: Another project is opened

- **WHEN** the studio moves to another Project
- **THEN** the previous Project's host is asked to stop, and is killed outright if it has not exited within a two-second grace
- **AND** anything still waiting on that host is failed with *the preview stopped before it finished*

#### Scenario: The project folder is moved

- **WHEN** a Project's folder changes on disk while it is the one being previewed
- **THEN** the preview is stopped and started again against the new location

### Requirement: A rebuild reaches the pane

When the project's files change and the host recompiles, the page SHALL be told, SHALL apply the update or reload itself, and SHALL report the rebuild to the studio. Compile progress arriving after the first compile has settled SHALL NOT replace a playing preview with a progress screen.

#### Scenario: The agent writes to the project

- **WHEN** a turn edits a file the bundle includes and the host recompiles it
- **THEN** the page applies the update, or reloads when it cannot
- **AND** the studio is told the preview was rebuilt

#### Scenario: Progress after the preview is already serving

- **WHEN** the compiler reports progress once the preview has been served
- **THEN** the pane keeps playing
- **AND** the progress screen is not shown again

#### Scenario: A rebuild fails

- **WHEN** a recompile fails
- **THEN** the pane shows the compiler's messages
- **AND** the failure is remembered, so a render pinned to the bundle refuses rather than rendering from a broken one

### Requirement: The preview comes back after the sidecar does

A sidecar that restarts or goes down SHALL count as having lost the preview, and the studio SHALL start the preview again once the sidecar reaches ready. A sidecar that is merely starting SHALL NOT count as a loss. The relaunch SHALL happen once per loss, and a Restart button SHALL remain as the manual way back.

#### Scenario: The sidecar crashes and is restarted

- **WHEN** the sidecar goes to restarting and later reaches ready
- **THEN** the preview is started again exactly once
- **AND** the pane recompiles and plays without anyone pressing anything

#### Scenario: An ordinary boot

- **WHEN** the sidecar reaches ready for the first time in this session
- **THEN** the preview is not started a second time

#### Scenario: The relaunch does not take

- **WHEN** the preview is still failed after the sidecar came back
- **THEN** the Restart button beside the preview's actions starts it again

### Requirement: The pane never prints a protocol token or a raw renderer message

Anything the pane shows about a failed preview or a failed frame SHALL be a sentence. The reply the sidecar sends when a request is cut short SHALL be worded as the preview having stopped when the sidecar restarted. A renderer's own advice that does not apply to a desktop app SHALL be dropped, and a failure carrying a long encoded asset URL SHALL name the file instead of printing the URL.

#### Scenario: The sidecar dies mid-request

- **WHEN** the preview's request is answered with the cancellation reply
- **THEN** the pane reads *The preview stopped when the sidecar restarted.*
- **AND** the protocol token itself never appears on screen

#### Scenario: A frame fails on a video that would not load

- **WHEN** the renderer reports a failed fetch of a video with its encoded proxy URL and its stock advice about low disk space
- **THEN** the pane reads that the frame could not be rendered because that video would not load, naming the file
- **AND** the disk-space advice is not shown

#### Scenario: A failure the studio has nothing to say about

- **WHEN** the renderer's message matches none of the known shapes
- **THEN** it is shown as it stands, wrapped and scrollable rather than clipped

### Requirement: The project's files are served with ranges and revalidation

The host SHALL serve the project's public files and the compiled bundle over its own local server. Every response SHALL declare that byte ranges are accepted and SHALL carry a real content length. A range request SHALL be answered as a partial response with its range declared; a range that cannot be satisfied SHALL be refused as such; a range header that cannot be read SHALL be ignored rather than refused; a HEAD request SHALL carry no body. Public files SHALL carry a validator derived from their size and modification time and SHALL be answered as unchanged when the validator still matches. The compiled bundle and the pages SHALL be served without storing. A path resolving outside the folder it is served from SHALL be refused, and a path that is not a file there SHALL be answered as missing.

#### Scenario: A video element probes a clip

- **WHEN** the webview asks for the first bytes of a video
- **THEN** the answer is a partial response with its range and the file's full size declared
- **AND** the element is never handed one unranged response carrying the whole file

#### Scenario: The agent rewrites a public file

- **WHEN** a file in the project's public folder is rewritten and asked for again with the validator the host handed out before
- **THEN** the validator no longer matches and the file is sent in full

#### Scenario: A range past the end of the file

- **WHEN** a range asks for bytes at or beyond the file's size
- **THEN** the request is refused as unsatisfiable, with the file's size declared

#### Scenario: A path escaping the served folder

- **WHEN** a request resolves outside the folder it would be served from
- **THEN** it is refused

### Requirement: Footage previews from a proxy, and detached clips are released

A video asset that has a proxy in the library SHALL be served to the *preview* page under the original's own URL, with the proxy's own size and validator, so that a proxy landing mid-session invalidates what the webview had cached. The *render* page SHALL never be served a proxy, so a still or an Export always carries the original. A file SHALL be matched to a proxy by its content rather than by its path, and the set of known proxies SHALL be re-read on a timer so a proxy filed during a session is picked up. Making proxies is specified by the `library/asset-library` capability. A video or audio element the scene has really removed from the page SHALL have its source cleared so the webview releases it.

#### Scenario: A clip with a proxy plays in the pane

- **WHEN** the preview asks for a clip whose bytes match an asset in the library that has a proxy
- **THEN** the proxy is served under the URL that was asked for, with its own size and validator
- **AND** the media type stays the one the URL implies

#### Scenario: The same clip is exported

- **WHEN** the render page asks for that clip
- **THEN** the original file is served

#### Scenario: A proxy is filed while the preview is running

- **WHEN** a proxy is written for an asset after the host has already looked and found none
- **THEN** a later request picks it up, once the known set has been read again

#### Scenario: A clip with no proxy

- **WHEN** the file matches no asset in the library, or the library is not there
- **THEN** the original is served and nothing about the preview changes

#### Scenario: A scene ends and its clip unmounts

- **WHEN** a video element leaves the page and is still gone once the page has settled
- **THEN** its source is cleared and it is reloaded, so the webview tears its player down
- **AND** an element that was merely moved within the page is left alone

### Requirement: The preview is hidden rather than unmounted

The preview SHALL keep its page loaded whenever the pane is showing something else, so that reading a document costs neither a page load nor the frame the person was looking at. Showing documents in the pane is specified by the `agent/pipeline` capability, and the panel's collapse and the toggle that brings it back by the `shell/layout-and-panes` capability.

#### Scenario: The pane is switched to Docs

- **WHEN** the pane's mode moves from Preview to Docs
- **THEN** the preview is hidden and keeps playing the page it had
- **AND** switching back shows the same frame without reloading

#### Scenario: The preview pane is hidden

- **WHEN** the preview pane is hidden from the header
- **THEN** the preview is unmounted with the pane, and showing it again starts the page afresh

### Requirement: The project's static files are listed for the pane

The host SHALL answer, on request, the names of the files in the project's public folder as the project's own code would name them. The listing SHALL be read at the moment it is asked for, so files the agent added during a turn are in it. It SHALL skip hidden entries, SHALL follow a symbolic link that points at a folder, SHALL stop at 2000 files and say that it stopped rather than trimming in silence, and SHALL be empty for a project with no public folder rather than a failure.

#### Scenario: The properties pane offers the project's pictures

- **WHEN** the listing is asked for
- **THEN** it names every file under the public folder in path form, sorted, up to the cap
- **AND** entries beginning with a dot are not in it

#### Scenario: A project with far too many static files

- **WHEN** the walk reaches its cap
- **THEN** the answer says it was truncated

#### Scenario: A project with no public folder

- **WHEN** the project has no public folder
- **THEN** the listing is empty and nothing fails

### Requirement: The seek bar shows the video's scenes

The playback panel's seek bar SHALL mark each scene of the playing video with a
boundary at the scene's first frame and SHALL show the scene's name directly
above its segment when the name fits, truncating it otherwise. A scene SHALL be a
sequence at the top level of the video that is shown in the timeline and is not
an audio or video clip; when the top level holds a single sequence spanning the
whole video, its children SHALL be the scenes instead. A video with fewer than
two scenes SHALL show a plain seek bar. The scene list SHALL follow a rebuild.

#### Scenario: A video with three scenes

- **WHEN** a video sequences an intro, a feature scene and a closing scene
- **THEN** the seek bar shows three segments with a boundary at each scene's start
- **AND** each segment's name is shown above it where it fits

#### Scenario: Jumping to a scene

- **WHEN** the person clicks a scene's name on the seek bar
- **THEN** playback pauses and the playhead moves to the scene's first frame
- **AND** the selected object stays selected

#### Scenario: A scene without a name

- **WHEN** a scene was sequenced without a name, or with only the placeholder Remotion gives it such as `<Series.Sequence>`, around a single component
- **THEN** its segment is labelled with that component's name made readable, "PricingScene" as "Pricing"
- **AND** a scene with neither is labelled "Scene" followed by its position

#### Scenario: A narrow scene

- **WHEN** a segment is too narrow for its name
- **THEN** only its boundary is drawn, and hovering the segment names it

#### Scenario: The video changes

- **WHEN** a rebuild adds, removes or retimes a scene
- **THEN** the seek bar shows the new scenes without a restart

### Requirement: Playback speed is chosen in the panel

The playback panel SHALL offer 0.25×, 0.5×, 1× and 2× playback speed for the
preview. The chosen speed SHALL apply to video and sound, SHALL survive a
rebuild of the same video, and SHALL reset to 1× when another video opens.
Export and Snapshot SHALL be unaffected.

#### Scenario: Watching an easing slowly

- **WHEN** the person chooses 0.25× and presses Play
- **THEN** the preview plays at a quarter speed
- **AND** the control shows 0.25×

#### Scenario: Another video opens

- **WHEN** the person opens another video after choosing 0.5×
- **THEN** the new video plays at 1×
