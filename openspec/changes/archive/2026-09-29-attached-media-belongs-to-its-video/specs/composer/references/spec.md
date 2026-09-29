## MODIFIED Requirements

### Requirement: Video and audio are carried with no reference kind
Attached video and audio SHALL live in their own list, outside the reference numbering, and SHALL be copied into the open video's own media folder under the project's public folder, `public/library/<video-slug>/`, before the turn starts. The agent SHALL be told, per file, where it now sits and how to reference it from the project's code, and the path it is told SHALL always hold the file that was attached, never a different file that happened to share its name. When the name is already taken in that folder, the sidecar SHALL compare contents: an identical file SHALL be reused without a second copy, and a different one SHALL be copied under the lowest free numbered name (`<name>-2.<ext>`, `<name>-3.<ext>`, …), an identical numbered copy being reused in the same way. Nothing already in the project SHALL be overwritten or moved. Only playable media SHALL enter that list. A video card SHALL show a frame from the clip rather than an icon, and an attached sound SHALL be analysed once it lands so its reading can travel with the turn.

#### Scenario: A clip is attached
- **WHEN** a video is attached and the message is sent
- **THEN** the clip is copied into the open video's media folder and the agent is given its in-project path rather than the path on the person's disk
- **AND** no `[Media #N]` token exists anywhere

#### Scenario: Two videos are given clips with the same name
- **WHEN** `footage.mp4` was attached in video A's chat and a different `footage.mp4` is attached in video B's chat
- **THEN** B's clip lands in B's media folder, A's clip is left where it was, and B's turn is pointed at B's clip only

#### Scenario: A different file arrives under a name already taken in the video
- **WHEN** a clip is attached in a video whose media folder already holds a file of that name with different contents
- **THEN** the clip is copied under the lowest free numbered name, the existing file is untouched, and the agent is given the numbered path

#### Scenario: The same file is attached again
- **WHEN** a clip is attached in a video whose media folder already holds an identical file under that name or under one of its numbered names
- **THEN** no new copy is made and the agent is pointed at the file already there

#### Scenario: Media from before this rule
- **WHEN** a project already holds attached media directly in `public/library/` from earlier turns
- **THEN** those files stay where they are and code that references them keeps working

#### Scenario: A clip cannot be copied
- **WHEN** copying an attached clip into the video's media folder fails
- **THEN** the turn still runs, the person sees a notice saying the attached media could not be copied into the project and why, and the agent is not pointed at any path for it

#### Scenario: A picture is offered to the media list
- **WHEN** an image path reaches the media list
- **THEN** it is refused there and travels as an attachment instead

#### Scenario: The same file is attached twice
- **WHEN** a path already in the list arrives again
- **THEN** it is taken once

#### Scenario: A message carries only a clip
- **WHEN** nothing but a video is attached
- **THEN** the message can still be sent

#### Scenario: A video is attached
- **WHEN** the card is drawn
- **THEN** a frame taken a fraction of a second in is shown, or half-way in for a clip too short for that

#### Scenario: A sound is attached and sent immediately
- **WHEN** the message goes out before the analysis finishes
- **THEN** it goes without the audiomap and the turn is unaffected

#### Scenario: A sound is analysed
- **WHEN** the analysis lands while the sound is still attached
- **THEN** the turn carries the reading, and the agent is given it in words
