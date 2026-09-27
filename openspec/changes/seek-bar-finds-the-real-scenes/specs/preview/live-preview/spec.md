## MODIFIED Requirements

### Requirement: The seek bar shows the video's scenes

The playback panel's seek bar SHALL mark each scene of the playing video with a
boundary at the scene's first frame and SHALL show the scene's name directly
above its segment when the name fits, truncating it otherwise. A name SHALL stay
within its scene's segment, and a segment SHALL end where the next scene starts,
so no two names are ever drawn over each other. A scene SHALL be a sequence shown
in the timeline that is not an audio or video clip, taken from the top level of
the video. A sequence spanning the whole video SHALL be treated as a frame around
the scenes rather than as a scene, and the scenes SHALL be taken from inside it
when it holds at least two, preferring a `<Series>` over any other frame. A
sequence whose frames are all covered by other scenes SHALL NOT be a scene. Of
two sequences over the same frames only one SHALL be a scene, and the named one
when only one of them is named. A video with fewer than two scenes SHALL show a
plain seek bar. The scene list SHALL follow a rebuild.

#### Scenario: A video with three scenes

- **WHEN** a video sequences an intro, a feature scene and a closing scene
- **THEN** the seek bar shows three segments with a boundary at each scene's start
- **AND** each segment's name is shown above it where it fits

#### Scenario: A Series beside a soundtrack and an overlay

- **WHEN** a video lays out eight named scenes in a `<Series>` and, beside it, a score, a dozen short sound-effect sequences and an overlay that spans a cut
- **THEN** the seek bar shows the eight scenes by their names
- **AND** neither the Series itself, the score, the sound effects nor the overlay appear as scenes

#### Scenario: A sound effect between two scenes

- **WHEN** a video without a `<Series>` has a short sequence inside one top-level scene or across the cut between two
- **THEN** the short sequence is not shown as a scene

#### Scenario: Two scenes overlapping for a transition

- **WHEN** one scene starts before the previous one ends
- **THEN** both are shown, and the earlier scene's name stops where the later one starts

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

#### Scenario: An odd structure

- **WHEN** a video's sequences match none of these shapes
- **THEN** the seek bar shows the segments the rule yields or a plain bar, and nothing is reported as an error

#### Scenario: The video changes

- **WHEN** a rebuild adds, removes or retimes a scene
- **THEN** the seek bar shows the new scenes without a restart
