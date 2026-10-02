## ADDED Requirements

### Requirement: Linux can install a missing Node.js runtime

The sidecar SHALL download the newest official LTS archive for the machine, verify its checksum and install it in the studio's application data directory. It SHALL discover that runtime immediately and after a restart without changing system packages or shell configuration.

#### Scenario: Installation succeeds

- **WHEN** Install Node.js completes on Linux
- **THEN** Node.js and npm are available to project setup and the checklist is rechecked

#### Scenario: Download or verification fails

- **WHEN** the archive cannot be downloaded or its checksum does not match
- **THEN** the checklist shows the reason and an existing managed runtime remains usable
