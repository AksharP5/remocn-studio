## ADDED Requirements

### Requirement: Footage is embedded so every frame lands

The conventions SHALL tell the agent to embed video footage with `<Video>` from
`@remotion/media`, not `OffthreadVideo`. They SHALL also say that a project whose
manifest does not declare `@remotion/media` gets it through the project's own
package manager, pinned to the version of the project's `remotion`. The sidecar owns
this sentence. It rides on every turn, whether or not the skills bundle loaded.

#### Scenario: Footage is added to a scene

- **WHEN** the agent embeds a video file in a scene
- **THEN** it has been told to use `<Video>` from `@remotion/media`, because `OffthreadVideo` shows the previous frame whenever a file's frames start a fraction of a millisecond after their slot

#### Scenario: The project does not declare the package

- **WHEN** the project's manifest does not list `@remotion/media`
- **THEN** the conventions tell the agent to add it with the project's own package manager at the version of the project's `remotion`
- **AND** that install runs as a Bash command and raises a permission card like any other (see `agent/permissions`)

#### Scenario: Existing OffthreadVideo

- **WHEN** a component the agent did not write this turn already embeds footage with `OffthreadVideo`
- **THEN** the agent leaves it alone unless the person asks or the design check reports late frames for that file
- **AND** when the check reports late frames, the correction is to switch that component to `<Video>` from `@remotion/media`, not to rewrite the person's file

#### Scenario: A Remotion without the package

- **WHEN** the project's Remotion predates `@remotion/media`
- **THEN** the agent keeps `OffthreadVideo` rather than upgrading Remotion unasked, and the design check still reports late frames for that footage
