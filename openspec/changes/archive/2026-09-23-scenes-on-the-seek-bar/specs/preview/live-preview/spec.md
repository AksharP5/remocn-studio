## ADDED Requirements

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
