## ADDED Requirements

### Requirement: Linux can install a missing Node.js runtime

The sidecar SHALL download the newest official LTS archive for the machine, verify its checksum and install it in the studio's application data directory. It SHALL discover that runtime immediately and after a restart without changing system packages or shell configuration.

#### Scenario: Installation succeeds

- **WHEN** Install Node.js completes on Linux
- **THEN** Node.js and npm are available to project setup and the checklist is rechecked

#### Scenario: A fallback package-manager shim conflicts with the active runtime

- **WHEN** PATH contains the active package manager and a home-directory fallback contains another copy
- **THEN** project setup uses the executable selected by PATH, including the managed Node.js bin directory
- **AND** non-executable files and directories do not mask a working package manager later in the search

#### Scenario: Download or verification fails

- **WHEN** the archive cannot be downloaded or its checksum does not match
- **THEN** the checklist shows the reason and an existing managed runtime remains usable
- **AND** partial downloads and staging directories are removed before another installation starts

#### Scenario: Installation is cancelled before activation

- **WHEN** the request is cancelled during release discovery, download, extraction or verification
- **THEN** pending network and child-process work stops and its temporary files are removed before the request finishes
- **AND** the existing managed runtime remains usable
