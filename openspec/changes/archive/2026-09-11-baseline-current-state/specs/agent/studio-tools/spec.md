## Purpose

The studio's own tools, offered to whichever agent runs the turn as ordinary stdio MCP servers: the asset library and stock search, the moodboard, the production pipeline and the source-asset ask, and the design check. The tools are declared where any CLI can spawn them while everything they touch stays inside the sidecar, bound to the turn that asked.

## ADDED Requirements

### Requirement: Three servers, spawned by the provider's own CLI

The studio SHALL offer exactly three tool servers — `remocn-design`, `remocn-library` and `remocn-pipeline` — each spawned by the provider's CLI as a stdio MCP child, so every tool reaches the agent under a name of the form `mcp__remocn-<server>__<tool>`.

#### Scenario: A turn is handed its servers

- **WHEN** a turn starts
- **THEN** the adapter is given one stdio transport per server it is entitled to, carrying the socket to talk to and the turn it belongs to
- **AND** the child advertises exactly the tools the studio declares for that server, with their wording

#### Scenario: A server that does not exist

- **WHEN** a child is asked to host a server name the studio does not carry
- **THEN** it refuses to start and says which name it was given

### Requirement: The child owns nothing

The spawned child SHALL hold no state of its own: it forwards every call over a unix socket to the sidecar, where the library store, the pipeline rows, the preview host and the turn's stream live, and the sidecar SHALL route the call to the turn the child was spawned for.

#### Scenario: A call is answered

- **WHEN** the agent calls a studio tool
- **THEN** the call crosses the socket, is executed against that turn's own project folder and stores, and the answer crosses back as the tool's text

#### Scenario: A call for a turn that is no longer running

- **WHEN** a call arrives naming a turn the sidecar is no longer serving
- **THEN** the call is answered with a sentence saying the turn is no longer running
- **AND** it never hangs

#### Scenario: The sidecar goes away

- **WHEN** the socket closes with calls still outstanding
- **THEN** each of them is answered with a sentence saying the studio went away before the call was answered

#### Scenario: A frame that cannot be read

- **WHEN** a line arriving on the socket cannot be decoded
- **THEN** it is logged and dropped, and no answer is invented

### Requirement: A gateway that cannot listen never fails the turn

If the sidecar cannot open its tool socket, the studio SHALL log that and run the turn anyway.

#### Scenario: The socket cannot be opened

- **WHEN** the gateway fails to listen
- **THEN** the failure is written to the log and the turn proceeds
- **AND** the turn is not failed and no auth or model error is reported

#### Scenario: The turn ends

- **WHEN** a turn finishes, fails or is stopped
- **THEN** the sidecar stops serving that turn, so a late call from a lingering child is refused rather than executed

### Requirement: The studio's tools run without a permission card

Every tool the studio declares SHALL be auto-allowed by the permission gate on its `mcp__remocn-*__*` name (see `agent/permissions`), and for providers whose approval policy is configurable these servers SHALL be pre-approved rather than left to the runtime's own destructiveness heuristics.

#### Scenario: Calling a studio tool

- **WHEN** the agent calls any tool on any of the three servers
- **THEN** the gate allows it without raising a card

#### Scenario: Codex

- **WHEN** a Codex turn is configured with the studio's servers
- **THEN** they are declared pre-approved rather than left to that runtime's own approval policy

### Requirement: The library server answers about assets and saves them

The `remocn-library` server SHALL offer a tool that lists everything in the studio's asset library — name, type, motion role, description, files and package dependencies — and a tool that saves something from the project into the library.

#### Scenario: Listing

- **WHEN** the agent asks what the library holds
- **THEN** it gets an inventory of every asset, and an empty library is answered as such rather than as a failure

#### Scenario: Saving a component

- **WHEN** the agent saves an asset, naming every file it needs, a name, an optional description, the npm packages it imports beyond react and remotion, an optional motion role and an optional type
- **THEN** the files are gathered into a new library asset, relative paths resolving against the project folder, and the answer names the asset, its slug, its type and how many files it holds
- **AND** the type is worked out from the file extensions when it is not given

### Requirement: The library server searches stock and keeps the moodboard

The `remocn-library` server SHALL offer stock search over Pexels and the two moodboard tools, with the network and the API key staying inside the sidecar.

#### Scenario: Searching stock

- **WHEN** the agent searches for photos or footage with a query and an optional page
- **THEN** it gets items with their id, dimensions, author, attribution page and download URL, and is told when more pages exist
- **AND** a search that found nothing says so and suggests different words

#### Scenario: Reading the moodboard

- **WHEN** the agent asks for this project's moodboard
- **THEN** an existing board comes back as its spec and the path of its rendered image, to be worked from rather than regenerated
- **AND** a project with no board is told so plainly

#### Scenario: Saving the moodboard

- **WHEN** the agent saves a board with its curated images, palette, typography pairs and tone words
- **THEN** the studio downloads the images, writes the spec, renders the board and stores it all as one library asset, replacing the project's existing board
- **AND** the answer points at the rendered image for the agent to read and judge

### Requirement: The pipeline server moves stages and asks for originals

The `remocn-pipeline` server SHALL offer a tool that starts the seven-stage pipeline for the chat, a tool that moves one stage's status, and a tool that asks the person for an identity asset the agent could not recover. Each stage move SHALL answer with the instructions for whatever stage is now active (see `agent/pipeline`).

#### Scenario: Starting

- **WHEN** the agent starts the pipeline
- **THEN** the stages are created with the first one active and the answer carries the first stage's instructions

#### Scenario: Moving a stage

- **WHEN** the agent marks a stage done and the next one active
- **THEN** the stored rows are updated, the new state rides out on the turn's own stream so the pane sees it at once, and the answer carries the newly active stage's instructions

### Requirement: A Free turn is served no pipeline server

On the Free plan the studio SHALL hand the turn only the design and library servers; the pipeline server's transport SHALL simply be absent rather than present and refusing.

#### Scenario: A Free turn

- **WHEN** a turn runs on Free
- **THEN** its CLI is given the design and library servers only
- **AND** the pipeline tools are absent from the agent's catalog rather than present and refusing

#### Scenario: A Pro turn

- **WHEN** a turn runs on Pro
- **THEN** all three servers are handed over

### Requirement: The source-asset ask waits for the person

When the agent has tried the authoritative source and cannot recover an identity asset, its request SHALL reach the person as a card in the chat offering exactly three answers — upload the original, capture the supplied page, or cancel — and the tool SHALL wait for one of them.

#### Scenario: The person uploads the original

- **WHEN** the person chooses a file
- **THEN** the file must be an SVG, PNG, JPEG, GIF, WebP or AVIF image, it is copied into the project's `video/assets/` folder under a name derived from the asset, and the agent gets the project-relative path with provenance saying the person supplied it
- **AND** anything else is refused with a sentence naming what is accepted

#### Scenario: The person asks for a capture

- **WHEN** the person chooses the screenshot
- **THEN** the supplied page is captured unchanged through the project's own preview host into the same folder, and the agent gets that path with provenance naming the capture
- **AND** a capture that fails is reported as the tool's error rather than as a silent cancel

#### Scenario: The person cancels, or nobody answers

- **WHEN** the person cancels, or ten minutes pass with no answer
- **THEN** the agent is told explicitly that no source asset was approved
- **AND** drawing, tracing or restyling the asset is never offered as the fallback

#### Scenario: The turn ends while an ask is open

- **WHEN** the turn finishes, fails or is stopped with an ask still pending
- **THEN** the ask is abandoned as a cancellation rather than left waiting

#### Scenario: The source is not a web page

- **WHEN** the named source is not an HTTP or HTTPS URL
- **THEN** the tool refuses with a sentence rather than opening anything

#### Scenario: The chat while an ask is open

- **WHEN** an ask is on screen
- **THEN** the chat is in the waiting state exactly as it is for a permission card, and a queued message is not dispatched until the ask is answered

### Requirement: A long tool reports progress and can be cancelled

A tool that takes time SHALL stream progress over the same socket for the CLI to surface, and an abort from the agent's side SHALL reach the operation running in the sidecar.

#### Scenario: A long design check

- **WHEN** a design check is running
- **THEN** its stage and completed-of-total are forwarded to the agent as progress notifications

#### Scenario: The agent aborts

- **WHEN** the agent aborts the call, or the child's connection drops
- **THEN** the operation running in the sidecar is cancelled rather than left to finish

### Requirement: A failed tool is text the agent can read

Every tool failure — bad arguments, a missing tool, a refusal from the sidecar — SHALL come back as the tool's own error text rather than as an exception that ends the turn.

#### Scenario: Arguments that do not fit the tool

- **WHEN** the agent calls a tool with arguments its declared shape rejects
- **THEN** the answer is an error the agent can read and correct

#### Scenario: A tool the server does not carry

- **WHEN** a call names a tool the server does not declare
- **THEN** the answer says which server has no such tool
