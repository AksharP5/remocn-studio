## ADDED Requirements

### Requirement: Footage the renderer would show late is measured from the file

Every design check SHALL find the footage that an inspected frame shows through
`OffthreadVideo`, read that file's own frame timestamps, and report the frame slots
the export would fill with the previous frame. A slot is late when, on the video's
frame grid, a source frame starts after the slot's time by no more than one
millisecond. `OffthreadVideo` asks for exactly the slot's time, so it shows the frame
before, and `<Video>` from `@remotion/media` accepts that frame. The measurement is
made on the file, not on the sampled frames, so it covers every slot the clip
occupies, including slots between inspected frames. The preview host owns the
measurement. It adds one finding per file and, in the full mode, a status for the
footage-timing rule. It never fails the check the agent is waiting on.

#### Scenario: A file with late frames

- **WHEN** an inspected frame shows a local MP4 or MOV file from the project through `OffthreadVideo`, and at least one of its slots is late
- **THEN** a measured warning is raised naming the file, the number of late slots out of the slots the clip covers, the largest lateness in milliseconds, and the frames it was seen on
- **AND** it says what the export will show (the previous frame repeated, then one skipped), and says to embed the clip with `<Video>` from `@remotion/media`

#### Scenario: A clean file

- **WHEN** every source frame of the file starts on or before its slot, or more than a millisecond after it
- **THEN** no finding is raised for that file
- **AND** in the full mode the footage-timing rule is marked completed

#### Scenario: One file seen on many frames

- **WHEN** the same file appears on several inspected frames, or behind several `OffthreadVideo` elements
- **THEN** it is measured once and reported as one finding covering every frame it was seen on

#### Scenario: No footage through OffthreadVideo

- **WHEN** no inspected frame shows footage through `OffthreadVideo`, including when all footage uses `<Video>` from `@remotion/media`
- **THEN** nothing is added to the findings
- **AND** in the full mode the footage-timing rule is marked not applicable rather than passed

#### Scenario: A file that cannot be measured

- **WHEN** the footage is a remote address or lies outside the project, its container is not MP4 or MOV, or its frame table cannot be read
- **THEN** that file is left unmeasured and the rest of the check is returned
- **AND** in the full mode the rule is marked skipped with a sentence naming the file and the reason; in the sampled mode the same sentence is an information finding
- **AND** no finding claims the file is clean

#### Scenario: Footage played at another speed

- **WHEN** the times the page asks the file for do not fall on the video's frame grid, as with a playback rate other than one
- **THEN** that file is left unmeasured and reported the same way, saying that playback at another speed is not modelled

#### Scenario: A sampled check

- **WHEN** the check samples key frames rather than the whole video
- **THEN** only footage shown on an inspected frame is measured, and footage mounted only between the sampled frames is not seen
