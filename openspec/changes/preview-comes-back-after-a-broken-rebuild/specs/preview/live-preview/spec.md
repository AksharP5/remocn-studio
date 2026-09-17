## MODIFIED Requirements

### Requirement: A rebuild reaches the pane

When the project's files change and the host recompiles, the page SHALL be told, SHALL apply the update or reload itself, and SHALL report the rebuild to the studio. Compile progress arriving after the first compile has settled SHALL NOT replace a playing preview with a progress screen. A compile that succeeds after a failed one SHALL be announced as ready again, so the pane that dropped the player for the compiler's messages mounts it again on its own.

#### Scenario: The agent writes to the project

- **WHEN** a turn edits a file the bundle includes and the host recompiles it
- **THEN** the page applies the update, or reloads when it cannot
- **AND** the studio is told the preview was rebuilt

#### Scenario: Progress after the preview is already serving

- **WHEN** the compiler reports progress once the preview has been served
- **THEN** the pane keeps playing
- **AND** the progress screen is not shown again

#### Scenario: A rebuild fails

- **WHEN** a recompile fails
- **THEN** the pane shows the compiler's messages
- **AND** the failure is remembered, so a render pinned to the bundle refuses rather than rendering from a broken one

#### Scenario: A failed rebuild is fixed

- **WHEN** the compile after a failed one succeeds
- **THEN** the studio is told the preview was rebuilt and then that it is ready
- **AND** the pane plays again without Restart being pressed, and no progress screen is left at 100%
