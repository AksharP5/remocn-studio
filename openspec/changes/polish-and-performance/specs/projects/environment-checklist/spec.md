## MODIFIED Requirements

### Requirement: The dependencies row reads the disk, and drift is a bun-only claim
The studio SHALL decide what is missing by looking for each declared package under `node_modules` on disk, walking up so a copy hoisted to a workspace root still counts, and SHALL NOT accept a package that only a package manager's global cache could resolve. It SHALL report a drift between the manifest and the lockfile only for a bun project, and SHALL say nothing at all rather than guess for any other manager. The drift answer SHALL be kept against the modification time and size of the manifest and the lockfile, and bun SHALL be asked again only when one of them changes.

#### Scenario: Packages are missing
- **WHEN** some declared packages are not under `node_modules`
- **THEN** the row fails, says how many of how many are missing, names up to four of them and says how many more there are, and offers to install

#### Scenario: Everything resolves but the lockfile disagrees
- **WHEN** the project is a bun project and the lockfile does not match the manifest
- **THEN** the row warns with what bun said and offers to install

#### Scenario: The report is read again with nothing changed
- **WHEN** the report is read again and neither `package.json` nor the lockfile has changed since the last drift check
- **THEN** the previous drift answer is given and bun is not started

#### Scenario: The manifest or the lockfile changed
- **WHEN** either file has been written since the last drift check
- **THEN** bun is asked again

#### Scenario: The drift check could not run
- **WHEN** bun is not there, the machine is offline, or bun failed for a reason that does not mention the lockfile
- **THEN** no drift is reported

#### Scenario: The project's package manager is not on the machine
- **WHEN** the manager row has failed
- **THEN** the dependencies row does not offer an install button

### Requirement: The sign-in probe is measured once per run of the sidecar
The studio SHALL cache the answer to a provider's sign-in probe for the life of the sidecar process, SHALL reuse it across projects, and SHALL clear it only when Recheck is pressed. The provider row SHALL be worked out at the same time as the project's own rows, so a slow probe does not hold up the checks that read the disk. A fresh sidecar MAY answer from the last signed-in probe kept on disk, as the `agent/providers` capability specifies.

#### Scenario: Projects are switched
- **WHEN** a second project's report is read
- **THEN** the provider row is answered from the cache and no command-line tool is launched again

#### Scenario: A slow probe
- **WHEN** the provider's probe takes several seconds
- **THEN** the project's own rows are worked out while it runs, and the report is ready as soon as the probe answers

#### Scenario: Recheck is pressed
- **WHEN** the report is re-read with force
- **THEN** the cache is cleared first, and a sign-in that has just happened is seen

#### Scenario: The probe does not answer
- **WHEN** the provider's tool cannot be started, or does not answer in time
- **THEN** the row fails with what it said and how to see more, rather than hanging the report

### Requirement: The videos row is the preview's answer
The studio SHALL take the videos row from what the preview's compiled project reported, and SHALL fold it in only while the preview is showing the project the open chat belongs to. Until the preview has compiled, the row SHALL be pending, which shows nothing. The row SHALL name the open chat's agent by its provider's name when it suggests asking for a change, and SHALL NOT use the words composition or Root.

#### Scenario: The preview has not compiled yet
- **WHEN** the report is shown
- **THEN** the videos row is pending, and a project whose preview is still building wears no checklist on its account

#### Scenario: The project registers no videos
- **WHEN** the preview reports none
- **THEN** the row fails saying the project compiled but registers no videos yet, and suggests asking the chat's agent, by name, to add one

#### Scenario: The video that was asked for is not in the code
- **WHEN** the preview reports that the composition the pane asked for is missing
- **THEN** the row fails naming that video, rather than reporting the substitute that played

#### Scenario: The preview is showing another project
- **WHEN** the preview's project is not the open chat's project
- **THEN** the videos row stays pending rather than reporting another project's compositions
