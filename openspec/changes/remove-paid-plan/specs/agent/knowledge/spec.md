## MODIFIED Requirements

### Requirement: A knowledge failure is one notice, never a failed turn

A bundle that should have loaded and did not SHALL produce exactly one notice in the turn saying so and that the turn runs on the conventions alone; the attach SHALL always be logged, and a knowledge failure SHALL never be presented as a sign-in or model failure.

#### Scenario: The bundle failed to attach

- **WHEN** the attach reports the bundle not loaded, whatever the reason
- **THEN** the turn emits one notice naming that reason
- **AND** the turn proceeds and produces its answer

#### Scenario: The bundle loaded

- **WHEN** the attach succeeded
- **THEN** the attach is logged and the person sees nothing

### Requirement: New components must be tunable without code

Every turn's conventions SHALL require every component the agent writes new to expose its knobs: typed props with inline defaults, top-level composition props in a Zod schema with colours as `zColor()`, an `InteractivitySchema` on every nested scene, element and transition wrapper exported through `Interactive.withSchema()` with its generated `controls` passed to its own `<Sequence>`, and a file that exports only the wrapped component.

#### Scenario: A run of text

- **WHEN** the agent writes a headline, caption or line of a stack
- **THEN** it is one `Interactive.H1`, `Interactive.P` or `Interactive.Span` whose direct child is the string, with typography as literals in its own `style` and a `name` unique in the frame and equal to its `data-design-id`
- **AND** a component that splits a run into words keeps the split inside and takes the whole string as one `text` prop

#### Scenario: A timing curve

- **WHEN** the agent animates anything
- **THEN** the easing is a prop named `easing` or ending in `Easing`, defaulting inline and spread into `interpolate()` as a four-number cubic-bezier array
- **AND** an enum of easing names is forbidden

#### Scenario: A spring

- **WHEN** the agent uses a spring
- **THEN** its physics are exposed as numbers under a dotted `spring` group, one group per spring, prefixed where a component has more than one

#### Scenario: An existing component

- **WHEN** the agent edits a component that already exists
- **THEN** it is not rewritten around a schema unless the person asks
- **AND** on a Remotion too old for part of the shape, the discipline is kept and what the version cannot express is skipped

### Requirement: The design check is required before finishing

Every turn's conventions SHALL require a stable `data-design-id` on every animated element and a call to the studio's design check over the affected range before a scene or video is called finished, passing only the movements the video's motion document actually promises as assertions (see `agent/design-check`).

#### Scenario: Finishing a scene

- **WHEN** the agent believes a scene or video is finished
- **THEN** it has run the design check over the affected range and either fixed every mechanical finding or recorded a bounded exception with a purpose and visible evidence
- **AND** labelling a finding "intentional" alone does not close it

#### Scenario: A vendored skill disagrees

- **WHEN** a bundled skill tells the agent to hardcode an easing, inline the words a component splits, or avoid spreads
- **THEN** the conventions overrule it on exactly those points

### Requirement: A turn's briefs ride beside the conventions

A turn SHALL carry, beside the conventions, the briefs describing what the studio already did for it: the assets and media copied into the project, the project's brand snapshot (see `projects/project-settings-and-brand`), and the active pipeline stage's instructions (see `agent/pipeline`).

#### Scenario: A brand snapshot exists

- **WHEN** the project carries a brand snapshot
- **THEN** the turn is told it is authoritative after explicit instructions from the person, is not to be asked about again, and is never overridden by a moodboard

#### Scenario: No pipeline is active

- **WHEN** no stage is active
- **THEN** no pipeline brief is attached


## REMOVED Requirements

### Requirement: Free turns get the structure and the references only

**Reason**: No paid plan remains (REM-520). Every turn gets what a Pro turn did.

**Migration**: Every turn now gets the bundle, located as `One skills bundle, shipped with the app` describes, and the full conventions: structure, craft, references and production. Both are byte-for-byte what a Pro turn received before. The reduced Free set is gone.
