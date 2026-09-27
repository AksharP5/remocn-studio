## MODIFIED Requirements

### Requirement: The reporter is loaded only when it will be used, and a failed load is never a failed boot

The sidecar and the webview SHALL each load their reporting library only once consent, the build and the destination have all agreed, never on the way to deciding. A library that cannot be loaded SHALL be one more reason that reporter is off and SHALL NOT stop the process or the window from starting; the sidecar SHALL record it with the reason. The webview's render-error screen SHALL NOT depend on the reporting library.

#### Scenario: The library cannot be loaded

- **WHEN** the reporting library cannot be resolved and consent is on
- **THEN** the sidecar records that the reporter is off because the library could not be loaded
- **AND** the sidecar starts normally and serves requests

#### Scenario: Consent is off

- **WHEN** consent is off
- **THEN** the reporting library is not loaded at all, by the sidecar or by the window

#### Scenario: The window opens on a build that will not report

- **WHEN** the window opens with consent withheld, on a development build, or with no destination configured
- **THEN** the window never loads the reporting library, and a render that throws still shows the screen offering a reload
