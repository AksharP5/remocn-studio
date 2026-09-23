## MODIFIED Requirements

### Requirement: The source's tunability is checked beside the pixels

Every design check SHALL also read the turn's own video source and report its tunability rules about whether the result can be tuned without code: a constant timing curve, a spring whose physics are nailed shut, a run of text in a plain element, one literal name shared by every instance a repetition renders, a curve that is never sampled, a schema component that never forwards its controls, a file that exports the unwrapped component, a scene sequenced without a name, a named scene with no scene object of the same label in `studio.json`, and a managed object that belongs to no scene. These findings SHALL be merged into the same findings list and counted in the same summary.

#### Scenario: Severities

- **WHEN** the source is scanned
- **THEN** a constant easing, a shared literal name, unforwarded controls, a raw export, an unnamed scene and a scene without its scene object are errors; a run of text in a plain element and an object outside every scene are warnings; a constant spring and an inert curve are information
- **AND** each finding names the file, the line and the snippet, what was expected and how to fix it

#### Scenario: Scenes are described

- **WHEN** the video's `index.tsx` sequences scenes with `<Series.Sequence>` or `<TransitionSeries.Sequence>`
- **THEN** each one without a `name` is reported, and each named one without a scene object of that label in `studio.json` is reported
- **AND** a managed object whose parents never reach a scene object is reported, unless the video's `index.tsx` renders it itself or the video has no scene objects at all

#### Scenario: Only this chat's video

- **WHEN** the scan runs
- **THEN** it reads only the folder of the video this chat is working on, never a sibling video's
- **AND** a chat with no video reads nothing

#### Scenario: The source could not be read

- **WHEN** the video's source cannot be read
- **THEN** the tunability rule is recorded as failed with that reason and the rest of the check is still returned
- **AND** the check the agent is waiting on is never failed over it
