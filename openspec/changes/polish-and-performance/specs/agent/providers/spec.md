## MODIFIED Requirements

### Requirement: Probes are asked once per run, shared, and rechecked on demand

The studio SHALL probe each provider at most once per run of the sidecar, SHALL probe the providers at the same time rather than one after another, SHALL share a probe that is still running with every caller who asks for the same provider meanwhile, SHALL share the answer with the environment checklist, SHALL refresh every probe when the person asks for a recheck, and SHALL recheck by itself when the window regains focus while a provider is failing. A caller that stops waiting SHALL NOT stop the probe for the others. The last signed-in answer SHALL be kept on disk for a day, so that a fresh start can answer from it at once while the probe runs behind it; an answer that is not signed in SHALL never be kept, and a probe that contradicts a kept answer SHALL remove it.

#### Scenario: A warm answer

- **WHEN** a provider row is asked for again in the same run
- **THEN** the cached answer is given and no probe runs

#### Scenario: Two parts of the studio ask at once

- **WHEN** the model menu and the environment checklist ask for the same provider while its probe is still running
- **THEN** one probe runs and both are answered with its result

#### Scenario: All four at once

- **WHEN** every provider's row is asked for together
- **THEN** the four probes run at the same time, so the answer takes as long as the slowest one rather than the sum

#### Scenario: A fresh start after a signed-in run

- **WHEN** the sidecar starts and a provider was signed in at its last probe less than a day ago
- **THEN** the row is answered from that probe at once and a new probe runs behind it
- **AND** the next time the row is asked for, the new probe's answer is given

#### Scenario: A fresh start after a long break

- **WHEN** the kept answer is more than a day old
- **THEN** the row waits for a new probe rather than answering from it

#### Scenario: Recheck

- **WHEN** the person presses Recheck in Settings › AI Accounts
- **THEN** every cached and kept answer is dropped and all four providers are probed again

#### Scenario: Coming back from the terminal

- **WHEN** a provider row is failing and the window regains focus
- **THEN** the probes are run again, at most once every five seconds, so a sign-in done in a terminal turns the row green with no button
