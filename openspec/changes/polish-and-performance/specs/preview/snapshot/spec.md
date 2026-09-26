## MODIFIED Requirements

### Requirement: A capture answers at the speed of a click

Once the render page for a video has been warmed, a capture SHALL reuse it rather than opening and navigating a page of its own. The warmed page SHALL be dropped whenever the bundle is rebuilt, and the measured composition forgotten with it, so a capture can never be taken against code that no longer exists. The warmed page SHALL also be closed once nothing has used it for ninety seconds, and never while a capture or a design check is using it; the next capture SHALL warm a page again. A Remotion that does not expose what a warm page needs SHALL fall back to rendering a page per capture, which still answers.

#### Scenario: A second capture of the same video

- **WHEN** a capture follows an earlier one of the same video with no rebuild between them, within ninety seconds
- **THEN** it is taken on the page that is already open, without navigating

#### Scenario: The project is rebuilt

- **WHEN** the bundle recompiles
- **THEN** the warm page is closed and the measurement forgotten
- **AND** Snapshot is disarmed, so re-arming warms again against the new bundle

#### Scenario: The warm page sits unused

- **WHEN** ninety seconds pass after the last capture, warm-up or design check without another one
- **THEN** the warm page and its browser are closed
- **AND** the next capture warms a page again and still answers

#### Scenario: A long design check

- **WHEN** a design check is still using the warm page after ninety seconds
- **THEN** the page stays open until the check ends, and the ninety seconds start from there

#### Scenario: The installed Remotion cannot be warmed

- **WHEN** the pieces a warm page needs cannot be resolved from the project
- **THEN** each capture renders through the ordinary per-capture path and still answers
