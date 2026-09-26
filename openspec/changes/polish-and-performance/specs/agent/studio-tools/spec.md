## MODIFIED Requirements

### Requirement: Three servers, spawned by the provider's own CLI

The studio SHALL offer exactly three tool servers — `remocn-design`, `remocn-library` and `remocn-pipeline` — so every tool reaches the agent under a name of the form `mcp__remocn-<server>__<tool>`. For Claude Code, whose SDK runs in the sidecar, the servers SHALL be served inside the sidecar and no child process SHALL be spawned for them. For every other provider each server SHALL be spawned by the provider's CLI as a stdio MCP child, and a child SHALL load only the code a tool host needs rather than the whole sidecar.

#### Scenario: A turn is handed its servers

- **WHEN** a turn starts
- **THEN** the adapter is given one stdio transport per server it is entitled to, carrying the socket to talk to and the turn it belongs to, and an in-process link per server bound to that turn
- **AND** the server advertises exactly the tools the studio declares for it, with their wording, whichever way it is served

#### Scenario: A Claude turn

- **WHEN** a Claude turn starts
- **THEN** the three servers are served inside the sidecar under the same names, and no tool-host process is started for the turn
- **AND** the permission gate sees the same tool names it sees for a spawned server

#### Scenario: A Codex, Copilot or Grok turn

- **WHEN** a turn of any other provider starts
- **THEN** its CLI spawns one tool-host child per server, and each child loads only the tool host's own code

#### Scenario: A server that does not exist

- **WHEN** a child is asked to host a server name the studio does not carry
- **THEN** it refuses to start and says which name it was given

### Requirement: A long tool reports progress and can be cancelled

A tool that takes time SHALL stream progress to the CLI to surface — over the socket for a spawned server, directly for one served inside the sidecar — and an abort from the agent's side, or the end of the turn, SHALL reach the operation running in the sidecar.

#### Scenario: A long design check

- **WHEN** a design check is running
- **THEN** its stage and completed-of-total are forwarded to the agent as progress notifications

#### Scenario: The agent aborts

- **WHEN** the agent aborts the call, or the child's connection drops
- **THEN** the operation running in the sidecar is cancelled rather than left to finish

#### Scenario: The turn ends while a tool runs inside the sidecar

- **WHEN** the turn a call belongs to ends while the call is running
- **THEN** the operation is cancelled, and a call arriving after the turn ended is refused with a sentence saying the turn is no longer running
