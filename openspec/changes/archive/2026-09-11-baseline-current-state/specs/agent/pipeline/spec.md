## Purpose

Making a video here runs through a fixed seven-stage production pipeline rather than a single prompt: each stage has a goal, a way of finding out what is already known, a done-condition and a document it writes into the video's own folder. The Docs pane is where those documents are read, so the first four stages produce something the person can correct before any frame exists.

## ADDED Requirements

### Requirement: Seven stages, in one order

The studio SHALL define exactly seven stages in this order — Analysis, Brand, Script, Motion, Build, Choreography, Review — each carrying its goal, what it must discover first, what to ask only when discovery answers nothing, the condition under which it is done, and the files it writes.

#### Scenario: What each stage is for

- **WHEN** a stage becomes active
- **THEN** its goal is one of: work out what is given (Analysis); collect the visual language (Brand); plan how the material develops within the target duration (Script); prove the direction in keyframes and plan the central action (Motion); verify a representative passage and then build the full editable video (Build); review the film end to end for readable actions, transitions and framing (Choreography); review the result against the script and close every note (Review)

#### Scenario: What a stage writes

- **WHEN** a stage finishes its work
- **THEN** the result is a file in the project rather than only a message, so a reopened chat loses nothing
- **AND** the six documents are `analysis.md`, `brand.md`, `script.md`, `motion.md`, `choreography.md` and `review.md`, with Build writing the video's own source and proof instead of a document

#### Scenario: Discovery before asking

- **WHEN** a stage starts
- **THEN** it first reads its own document and the project for what is already known, treats what it infers as a working assumption it writes down and says plainly, and asks the person only when neither source answers
- **AND** asking and ending the turn is a normal way to finish, with the stage left open for the answer

### Requirement: Stage status belongs to the chat and is moved by the agent

Each stage SHALL be stored per chat as pending, active or done. Stages SHALL move only through the studio's own pipeline tool, they SHALL move as soon as a done-condition holds without waiting for another turn, and an earlier stage SHALL be reopenable by being set active again.

#### Scenario: Starting the pipeline

- **WHEN** the person asks to create a video, or to rework one from the ground up, and no pipeline is active
- **THEN** the agent starts the pipeline first and follows what it returns
- **AND** a small, pointed edit needs no pipeline

#### Scenario: A stage moves mid-turn

- **WHEN** a stage's done-condition holds
- **THEN** the agent marks it done and the next one active and keeps working in the same turn, stopping only for something only the person can give
- **AND** the new stage list rides out on the turn's own stream, so the Video dock updates at once rather than at the end of the turn

#### Scenario: Reading the stages back

- **WHEN** a chat is opened
- **THEN** its stored stages are read back in the pipeline's own order, whatever order the rows were written in

### Requirement: The active stage's instructions ride on a Pro turn

While a stage is active the turn SHALL carry that stage's brief: its title, the stages already done, its goal, its done-condition, the files to write, its checklist where it has one, and the discovery order. On Free no brief is attached.

#### Scenario: A stage is active

- **WHEN** a Pro turn starts in a chat with an active stage
- **THEN** the brief is appended to the turn's instructions with the video's own folder substituted into every path it names

#### Scenario: No stage, or Free

- **WHEN** no stage is active, or the turn runs on Free
- **THEN** no brief is attached and the turn is an ordinary one

### Requirement: A video's documents live in the video's own folder

Stage documents SHALL be written to `src/videos/<slug>/docs/`, so deleting a video's folder takes its documents with it and two videos in one project cannot overwrite each other's documents.

#### Scenario: A path in a brief

- **WHEN** a stage brief names a document or an asset folder
- **THEN** the path is resolved against this chat's own video slug

#### Scenario: The video is not known

- **WHEN** a chat is not attached to a video
- **THEN** the paths fall back to a placeholder rather than pointing at another video's folder

### Requirement: The right pane switches between the preview and the documents

The right pane's title SHALL be a Preview / Docs switch. Docs SHALL show the video's markdown as tabs, and the preview SHALL keep running behind the documents rather than being torn down, so switching back costs no rebuild and loses no frame.

#### Scenario: Opening Docs

- **WHEN** the person picks Docs
- **THEN** the documents replace the preview in the pane and the preview keeps running behind it

#### Scenario: A video with no documents

- **WHEN** the video's docs folder does not exist or holds no markdown
- **THEN** the pane says no documents yet and names the folder they will be written to, rather than showing an error

### Requirement: The tabs are what is on disk, in pipeline order

The tab strip SHALL be derived from the documents the stages declare: every declared document the folder actually holds, in stage order, then every other markdown file in the folder by name. A stage that has written nothing SHALL not be a tab.

#### Scenario: Half the pipeline has run

- **WHEN** only analysis and brand have been written
- **THEN** exactly those two tabs are shown, in that order

#### Scenario: A file nobody declared

- **WHEN** the folder holds a markdown file no stage declares
- **THEN** it is a tab after the declared ones, ordered by name

#### Scenario: The open tab leaves the folder

- **WHEN** the document that was open is no longer in the folder
- **THEN** the first tab opens instead

### Requirement: The documents are re-read on signals the studio already receives

The pane SHALL re-read the listing when a turn settles, and SHALL re-read the open document when a tool call in the turn creates or edits a file whose path it mentions. It SHALL NOT re-read on any other signal.

#### Scenario: A turn ends

- **WHEN** the last running turn settles
- **THEN** the listing is read again, so a document written during the turn becomes a tab

#### Scenario: The agent writes the open document

- **WHEN** a create or edit tool call in the turn names the path of the document on screen
- **THEN** that document is read again and the pane shows the new text

### Requirement: The mode and the open tab are per video and not remembered across launches

Which mode the pane is in and which document is open SHALL be kept per video for the life of the app run only: moving to another video and back lands on the tab that was open, and a relaunch starts on the preview.

#### Scenario: Switching videos

- **WHEN** the person opens another video and comes back
- **THEN** the pane is in the mode and on the tab it was left in

#### Scenario: Relaunch

- **WHEN** the app is started again
- **THEN** the pane starts on the preview for every video

### Requirement: Reading a project file is contained

Reading a document SHALL resolve symlinks and `..` and refuse anything that is not inside the project, anything that is not a file, anything over one megabyte, and anything whose bytes contain a NUL.

#### Scenario: A path outside the project

- **WHEN** a read names a path that resolves outside the project folder
- **THEN** it is refused with a sentence saying so, and nothing is read

#### Scenario: A file that is too large, or not text

- **WHEN** the file is over a megabyte, or its content contains a NUL
- **THEN** the read is refused with a sentence naming the size or saying it is not a text file

#### Scenario: The folder does not exist

- **WHEN** the video's docs folder has never been created
- **THEN** the listing is empty and carries the folder it would be written to, which is not an error

### Requirement: Docs changes what the pane's actions can do

Inspect and Snapshot SHALL be unavailable while the pane shows the documents, with that as the stated reason, and arming either and then switching SHALL disarm it. Export SHALL stay available.

#### Scenario: Switching to Docs while armed

- **WHEN** Inspect or Snapshot is armed and the person opens Docs
- **THEN** it is disarmed down the same path a rebuild takes

#### Scenario: The buttons in Docs

- **WHEN** the pane is showing documents
- **THEN** Inspect and Snapshot carry the reason that the pane is showing the documents, and Export is still offered

### Requirement: The Video dock is the way into the documents

The Video dock SHALL show the seven stages with their status while the pipeline is unfinished, and a stage whose document exists on disk SHALL be a button that switches the pane to Docs and opens that document. A stage that has written nothing SHALL be a plain row.

#### Scenario: A stage with a document

- **WHEN** the person clicks a stage row whose document is on disk
- **THEN** the pane switches to Docs and opens that file

#### Scenario: A stage with nothing written

- **WHEN** a stage has written no document
- **THEN** its row is not clickable rather than being a dead button

#### Scenario: The dock's label

- **WHEN** the pipeline is running
- **THEN** the dock reads the running task's present-continuous phrase, or the active stage's, with the count of stages done
- **AND** a finished pipeline leaves the dock to the turn's own plan

### Requirement: Review cannot be closed without a revalidated report

Marking the Review stage done SHALL require the id of a full design-check report; the studio SHALL reload that report against the current sources and refuse the move while coverage is incomplete or cancelled, while a check failed, while the sources have changed since, while runtime motion boundaries are unverified, or while measured viewer errors are unresolved and unexcepted.

#### Scenario: No report id

- **WHEN** the agent marks review done without naming a report
- **THEN** the move is refused with a sentence saying a written summary cannot complete the check

#### Scenario: The sources changed

- **WHEN** the named report is stale against the current sources or render settings
- **THEN** the move is refused and the agent is told to run the full check again

#### Scenario: Unresolved measured defects

- **WHEN** the report still holds measured viewer errors with no recorded exception
- **THEN** the move is refused, the count and the codes are named, and the agent is told to fix and recheck or record a narrow exception

#### Scenario: The person's own export

- **WHEN** the agent's review is refused
- **THEN** Export stays available to the person, and the refusal applies only to the agent marking Review done

### Requirement: The brand stage starts from what already exists

The Brand stage SHALL work from the project's brand snapshot first, then from an existing moodboard, and SHALL create a moodboard only when unresolved imagery or art direction needs one. It SHALL recover each identity asset from its authoritative source rather than redrawing it.

#### Scenario: A complete snapshot

- **WHEN** the project's brand snapshot already names colours, typography and tone
- **THEN** identity collection can finish with no stock search and no new font pairing, and the snapshot is not asked about again

#### Scenario: A board already exists

- **WHEN** the project already has a moodboard
- **THEN** it is read and worked from, never regenerated unless the person asks to start over (see `library/moodboard`)

#### Scenario: An original cannot be recovered

- **WHEN** the source exposes no usable original after direct downloads, page image sources and linked vectors have been checked
- **THEN** the agent asks the person through the source-asset request (see `agent/studio-tools`)
- **AND** a newly drawn, traced or restyled replacement cannot complete the stage

### Requirement: Documents are read in the studio, not edited in it

The Docs pane SHALL render each document as markdown without the transcript's reveal animation, and SHALL offer no editing: a document is changed by asking in the chat.

#### Scenario: Opening a document

- **WHEN** a document is opened
- **THEN** it is rendered whole, with no word-by-word reveal

#### Scenario: Wanting a change

- **WHEN** the person wants a document changed
- **THEN** the pane offers no field to type in, and the change is asked for in the chat
