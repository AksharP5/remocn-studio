## MODIFIED Requirements

### Requirement: Video and audio are carried with no reference kind
Attached video and audio SHALL live in their own list, outside the reference numbering, and SHALL be copied into the project's public folder before the turn starts. The agent SHALL be told, per file, where it now sits and how to reference it from the project's code. Only playable media SHALL enter that list. A video card, in the composer and in a sent message, SHALL show a still frame taken from the clip rather than an icon or a live player; frames SHALL be taken one clip at a time and kept for as long as the app runs, and a clip whose frame cannot be taken SHALL fall back to showing the clip itself. An attached sound SHALL be analysed once it lands so its reading can travel with the turn.

#### Scenario: A clip is attached
- **WHEN** a video is attached and the message is sent
- **THEN** the clip is copied into the project and the agent is given its in-project path rather than the path on the person's disk
- **AND** no `[Media #N]` token exists anywhere

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

#### Scenario: A chat holds many clips
- **WHEN** a chat with several sent videos is opened
- **THEN** each card shows a still picture rather than a live player
- **AND** the frames are taken one clip at a time, and a clip seen before shows its frame at once

#### Scenario: A clip whose frame cannot be taken
- **WHEN** the frame cannot be decoded
- **THEN** the card shows the clip itself instead of an empty box

#### Scenario: A sound is attached and sent immediately
- **WHEN** the message goes out before the analysis finishes
- **THEN** it goes without the audiomap and the turn is unaffected

#### Scenario: A sound is analysed
- **WHEN** the analysis lands while the sound is still attached
- **THEN** the turn carries the reading, and the agent is given it in words
