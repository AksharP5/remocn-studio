## Purpose

A project holds several videos, and a video is a folder in the project's own source tree that Remotion renders as one composition. This capability covers what that folder is, how the studio registers it without editing the person's own root file, how the rows in the pane are reconciled against what the compiled project actually renders, and how videos are created, named, deleted, restored and opened.

## ADDED Requirements

### Requirement: A video is a folder the project's own scan renders

The studio SHALL treat every folder under the Remotion root's `src/videos/` as one video, identified by the folder name, whose module default-exports the component and exports a `meta` carrying width, height, frames per second and duration, and may additionally export default props and a schema that are forwarded to the composition. Scenes SHALL live inside a video rather than beside it.

#### Scenario: A video folder is compiled
- **WHEN** the project is compiled and a folder under `src/videos/` holds a video module
- **THEN** that folder SHALL be registered as a composition named after the folder, at the dimensions, frame rate and duration its `meta` declares
- **AND** its default props and schema SHALL be passed to that composition when it declares them

#### Scenario: A folder with no video module
- **WHEN** a folder under `src/videos/` holds no video module
- **THEN** the scan SHALL skip it rather than failing the project's compile

### Requirement: The scan is spliced at the entry point, never into the person's root file

The studio SHALL place its own scan file into `src/videos/` and SHALL register it by rewriting the project's Remotion entry point to wrap the registered root, adding exactly one import. It SHALL NOT write to the project's own root component under any circumstance, and SHALL refuse by name any entry point whose shape it cannot recognise.

#### Scenario: An ordinary entry point
- **WHEN** the entry point registers a root by naming an identifier
- **THEN** the studio SHALL add one import for its scan and wrap that identifier, leaving everything else in the file untouched

#### Scenario: The entry point already registers the scan
- **WHEN** the import is already present
- **THEN** the studio SHALL change nothing

#### Scenario: The entry point has a shape the studio cannot read
- **WHEN** the entry point does not register a root in a recognisable shape, or has no import to anchor to
- **THEN** the studio SHALL refuse with a sentence saying the entry point cannot be extended and that the video can be registered by hand or by asking the agent
- **AND** SHALL NOT rewrite the file on a guess

#### Scenario: No entry point at all
- **WHEN** the Remotion root holds none of the entry points Remotion itself looks for
- **THEN** the studio SHALL say so and name the candidates it expected

#### Scenario: A scan file the project already has
- **WHEN** `src/videos/` already holds the scan file
- **THEN** the studio SHALL leave it exactly as it is

#### Scenario: The versioned motion foundations
- **WHEN** the scan is registered in a project
- **THEN** the studio SHALL also place its versioned motion foundation modules under the project's own source tree
- **AND** SHALL leave any file of theirs the project already holds exactly as it is, so that reopening a project never changes the film it renders

### Requirement: Registering is only done where the person asked for it

The studio SHALL place the scan and splice the entry point only when creating a project, creating a video, opening a project from a bundled template, or when the person presses Register in this project on a video's menu. Reconciling the pane against the compiled project SHALL never write anything into the project.

#### Scenario: Register in this project
- **WHEN** a video the compiled project does not render is on screen
- **THEN** its menu SHALL offer Register in this project
- **AND** choosing it SHALL place the scan and splice the entry point, and SHALL say that the video appears in the preview once the project rebuilds rather than claiming it is already there

#### Scenario: A video the project does render
- **WHEN** a video is named by the compiled project
- **THEN** Register in this project SHALL NOT be offered

### Requirement: The slug is minted once and never moves

The studio SHALL mint a video's slug from its name when the video is created, and SHALL use that slug as the folder name, the composition id and the value the preview is opened with. The slug SHALL transliterate non-Latin letters, SHALL lift accents rather than dropping the letter they sit on, SHALL reduce anything else to hyphens, and SHALL be given a numeric suffix until it clears both the project's recorded videos — deleted ones included — and the folders already under `src/videos/`.

#### Scenario: A name in another script or with accents
- **WHEN** a video is named with Cyrillic letters, or with accented Latin letters
- **THEN** the slug SHALL carry the transliterated or unaccented letters rather than collapsing to the fallback

#### Scenario: A name whose slug is taken
- **WHEN** the minted slug matches a recorded video, a deleted video, or a folder already on disk
- **THEN** the studio SHALL append the lowest free numeric suffix

#### Scenario: A name that yields nothing
- **WHEN** nothing in the name survives slugging
- **THEN** the studio SHALL use a fallback slug and suffix it past anything taken

#### Scenario: The video is renamed
- **WHEN** a video is renamed
- **THEN** only its displayed name SHALL change
- **AND** its slug, its folder and its composition id SHALL stay exactly as they were

### Requirement: Creating a video writes its folder and its row together

The studio SHALL offer New video from the second video of a project onward, with two fields — a name and an aspect ratio — and SHALL, in one call, ensure the scan is registered, expand the video template into the new folder with the chosen dimensions and name written into its `meta`, capture the project's current brand for it, and create the row. It SHALL NOT overwrite a file the folder already holds.

#### Scenario: New video is completed
- **WHEN** a name and ratio are submitted
- **THEN** the studio SHALL create the folder at the minted slug with those dimensions, create the row, expand it in the pane and open a new chat on it

#### Scenario: The template no longer declares its dimensions
- **WHEN** the video template does not carry width and height as literals the wizard can rewrite
- **THEN** the studio SHALL fail with a sentence naming the file that drifted, rather than silently creating a video at the wrong size

#### Scenario: A folder that is already there
- **WHEN** the target folder already holds files
- **THEN** the studio SHALL leave every existing file alone

#### Scenario: No project is open, or the project's folder is gone
- **WHEN** there is no open project, or the open project's folder is missing
- **THEN** New video SHALL be disabled

### Requirement: The rows draw the pane and the compiled bundle corrects them

The studio SHALL draw the video list from its own records as soon as a project is opened, and SHALL reconcile that list against the compositions the compiled project reports once it has compiled. A composition with no row SHALL become a row; a row the compiled project does not name SHALL be marked as absent and kept; a video the person deleted SHALL never be brought back; nothing SHALL be deleted by a reconcile.

#### Scenario: The compiled project names a composition nothing recorded
- **WHEN** the compiled project reports a composition that has no row
- **THEN** the studio SHALL create a row for it, named after the composition

#### Scenario: The compiled project stops naming a recorded video
- **WHEN** a video's composition is no longer among the ones the project reports
- **THEN** that video SHALL be marked absent and listed under a heading saying nothing in the project renders it any more
- **AND** its chats SHALL remain readable and its row SHALL NOT be deleted

#### Scenario: A deleted video is still on disk
- **WHEN** the compiled project still reports the composition of a video the person deleted
- **THEN** the studio SHALL NOT bring that video back into the list

#### Scenario: The answer arrives for a project that is no longer open
- **WHEN** the compiled project answers after the person has moved to another project
- **THEN** the studio SHALL discard that answer rather than showing one project's compositions in another's list

#### Scenario: Another project's videos
- **WHEN** one project is reconciled
- **THEN** no other project's videos SHALL be changed

### Requirement: Deleting a video is soft, reversible and writes nothing into the project

The studio SHALL delete a video by marking its row, SHALL NOT remove any folder or write any marker into the project, and SHALL allow the video and its chats to be restored at any later time. The confirmation SHALL say so before the decision is made.

#### Scenario: Delete is confirmed
- **WHEN** Delete is confirmed for a video
- **THEN** the video SHALL leave the list with its chats
- **AND** the files in the project SHALL be left exactly as they are
- **AND** a notice SHALL name the video and offer Undo

#### Scenario: Undo, now or much later
- **WHEN** the video is restored, from the notice or afterwards
- **THEN** it SHALL return to the list with its chats intact
- **AND** restoring SHALL NOT depend on any window of time having been met

#### Scenario: The costs are stated
- **WHEN** the delete confirmation is shown
- **THEN** it SHALL say that the video leaves the list with its chats, that the project's files are untouched, and that Undo brings the video back

#### Scenario: Deleting the code itself
- **WHEN** the person wants the folder removed from the project
- **THEN** that SHALL be a request made in a chat, carried out by the agent through the ordinary permission card, and SHALL NOT be something this deletion does

### Requirement: The row opens a chat and the chevron expands the list

The studio SHALL make a video's row open that video's most recent chat, and SHALL give the chevron beside it its own hit area for expanding and collapsing the chats. There SHALL be no state in which a video is highlighted while an unrelated chat drives the preview.

#### Scenario: A video with chats is clicked
- **WHEN** a video's row is clicked
- **THEN** the studio SHALL open the most recent chat of that video, as its own store orders them, and SHALL select and expand the video

#### Scenario: A video with no chats is clicked
- **WHEN** a video that has never been used is clicked
- **THEN** the studio SHALL only expand it, showing that it has no chats yet

#### Scenario: The chevron is clicked
- **WHEN** the chevron is clicked
- **THEN** the studio SHALL toggle the chats of that video without changing which chat is open

#### Scenario: New chat here
- **WHEN** the new-chat action on a video's row is used
- **THEN** the studio SHALL select and expand that video and open an empty chat on it
- **AND** the action SHALL be unavailable for a video the compiled project no longer renders

### Requirement: Videos are ordered by their most recent chat and their expansion is remembered

The studio SHALL order a project's videos by the most recent activity in their chats, falling back to when the video was created, newest first, and SHALL remember which videos are expanded across launches.

#### Scenario: A video's chat receives a turn
- **WHEN** a turn runs in one video's chat
- **THEN** that video SHALL lead the project's list on the next read

#### Scenario: Two videos created moments apart with no chats
- **WHEN** neither video has a chat
- **THEN** the more recently created one SHALL lead

#### Scenario: The studio is relaunched
- **WHEN** videos were left expanded
- **THEN** they SHALL come back expanded

#### Scenario: Deleted videos in the list
- **WHEN** a project's videos are listed
- **THEN** deleted videos SHALL be left out

### Requirement: One turn at a time is per video

The studio SHALL treat a video, not a chat, as the unit that may have one turn running in it. The queueing and hand-off that implement this belong to agent/turns.

#### Scenario: A sibling chat is running
- **WHEN** a message is sent in a chat whose video already has a turn running in another of its chats
- **THEN** the message SHALL be queued rather than started

#### Scenario: Two different videos
- **WHEN** turns are started in chats belonging to two different videos
- **THEN** both SHALL run at the same time
