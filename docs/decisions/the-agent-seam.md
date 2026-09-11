# The agent seam

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`agent/providers`](../../openspec/specs/agent/providers/spec.md), [`agent/turns`](../../openspec/specs/agent/turns/spec.md), [`agent/studio-tools`](../../openspec/specs/agent/studio-tools/spec.md), [`agent/design-check`](../../openspec/specs/agent/design-check/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The turn machinery is provider-neutral (REM-251, phase 1): `handlers.ts` talks to
an **`AgentAdapter`** — `{ info, account, turn }` in `sidecar/agent/adapter.ts` —
and `sidecar/claude/` is the first adapter. What stays neutral lives in
`sidecar/agent/` (the permission gate's Effect skeleton, the mode switch, the
per-provider account cache, the registry); what speaks SDK stays in
`sidecar/claude/` (the `CanUseTool` guard, the event translation, the failure
classifier, the auth probe).

- **`shared/providers.ts` is the provider contract**: `AGENT_PROVIDERS`, the
  `AgentCapabilities` shape (`context`, `effort`, `modes`, `planTool`, `resume`,
  `thinking`) and the static `PROVIDER_INFO` table. The table is static on
  purpose — the webview and the sidecar ship in one bundle, so it cannot drift
  from the adapters the registry carries, and the composer's chips need no
  loading state. **Capabilities, not `if provider`**: the Mode and Effort chips
  render only when the provider claims them; context meter, thinking marker and
  plan checklist already degrade to nothing when their events never arrive.
- **The provider is a property of the session** — a column (migration 5, default
  `claude`), a field on `HistorySession` and on `agent.prompt`'s params (decoding
  default `claude`, so a session row or a stored turn written before the field
  existed still decodes). The webview
  reads it back into `TurnState` exactly as it does `sdkSessionId`, and only the
  session's own provider failing its login check locks the composer
  (`isBlocked(checks, provider)` — the account row's id *is* the provider id).
- **The tool dictionary crosses the wire as a verb.** A `tool_use` event and its
  stored activity entry carry `verb` — the adapter's translation of its own tool
  name into the neutral vocabulary (`read`/`edit`/`create`/`run`/`search`/`find`/
  `web`/`plan`/`task`/`subagent`) that `activity-icon.tsx` keys on, with the old
  name map behind it for rows stored before verbs existed and names no adapter
  translates. Detail rendering (`lib/studio/activity.ts`) and the task-checklist
  parser still read Claude's names; they move behind the seam when adapter #2
  needs them to.
- **The studio's tools are stdio-MCP servers any CLI can spawn** (phase 2 of
  REM-251). `sidecar/tools/` holds the whole seam: `specs.ts` declares the
  tools (names, wording, zod shapes — the contract with the agent, moved
  verbatim from the old in-process servers), `execute.ts` runs them, and the
  split between the two processes is the point: the *state* a tool touches —
  the SQLite stages, the turn's stream, the preview stills a `save_asset`
  renders — lives only in the sidecar, so the child the CLI spawns
  (`sidecar/index.ts --tools-host <server>`, the same re-exec the preview host
  uses) owns nothing and forwards every call over a unix socket to
  `gateway.ts`. The gateway holds a registry of turn contexts keyed by
  `turnId` (registered around `adapter.turn` in an `acquireRelease`, so a
  finished or interrupted turn always unregisters), and the socket path and
  turn id travel to the child in env vars on the transport the adapter hands
  its CLI. Tool names stay `mcp__remocn-*__*`, so the permission gate's
  auto-allow and the conventions' wording are untouched — a test pins both.
  Failure directions: a call for a turn that is gone gets a sentence, not a
  hang; a gateway that cannot listen is logged and the turn still runs,
  because the words matter more than the tools. Measured end to end — spawn,
  MCP handshake, `tools/call` through the socket — a call answers in ~20 ms.
- **Codex is the second adapter** (phase 3 of REM-251), and it is what proved
  the seam: `sidecar/codex/` translates `@openai/codex-sdk`'s item stream —
  items that start, update and complete, not deltas — into the same
  `AgentEvent`s, with a stateful translator that remembers how much of each
  text item it has already emitted. Three findings there were measured, not
  read: the wire carries explicit `null`s where the SDK types say optional
  (`error`, `result` on an MCP call — trusting the types crashed a turn); the
  studio's MCP servers need `default_tools_approval_mode: "approve"`, because
  `"auto"` reads tool annotations, treats an unannotated tool as destructive,
  and headless Codex then kills the call as *"user cancelled MCP tool call"*;
  and Codex names MCP tools `mcp__{server}__{tool}` — the same spelling Claude
  uses, so the conventions text works verbatim as `developer_instructions`.
  - **The permission card never appears for a Codex turn — the OS sandbox is
    the gate.** Headless Codex has nobody to answer approvals, so
    `approvalPolicy` is always `never` and the modes map to sandboxes: `auto`
    and `acceptEdits` → `workspace-write` (a write outside the folder is
    *blocked*, which is #223 enforced harder than Claude's `auto` manages),
    `plan` → `read-only`. That trade is the mapping, not an oversight.
  - **A finalizer reports, it never raises** (REM-320). Stop on a Codex turn — any
    non-success exit — aborts the signal the SDK's child was spawned on, and
    aborting a child whose `error` listener is spent makes Node emit an `error`
    nobody listens to. The SDK attaches its listener with `once`. Measured on bun
    1.3.2: it happens only while the child is alive with that listener spent, every
    exit path is safe, and bun raises it as an *uncaught exception from inside
    `abort()` itself* — a try/catch around the call sees nothing, the stack lands in
    `sidecar.log`, and a release with crash consent would have Sentry treat it as
    fatal. `abortQuietly` in `sidecar/agent/abort.ts` intercepts that one error on
    the process for the duration of the call and one turn of the loop after it, and
    puts anything else back on the loop untouched. Its test spawns a real `bun` for
    the probe, so the shape is measured on the runtime that ships; bun 1.4 dropped
    the full stop from *The operation was aborted*, which is why the assertion
    matches the prefix.
  - **The CLI is the user's, resolved, never bundled** — `findCodex` walks
    `$REMOCN_STUDIO_CODEX`, `$PATH`, then the usual install dirs; a machine
    without it gets the *not installed* row with the install command, and a
    `~/.codex/auth.json` written by an IDE extension does not by itself put a
    binary on `$PATH`. `codex login status` is the auth probe: exit 0 =
    logged in, *"Not logged in"* + exit 1 locks the composer for Codex
    sessions.
  - **What `experimental: true` means here** (the flag stays in `PROVIDER_INFO`, the
    badge is gone): `context` is per-turn usage, not a
    window reading, so the meter never shows, and `todo_list` does not speak
    the checklist's `TaskCreate` vocabulary, so no plan dock. The bundled
    skills *are* delivered, through a mirrored `CODEX_HOME` rather than a
    plugin flag — see *One bundle, four runtimes*.
- **Copilot is the third adapter, and it rides a bridge the fourth can reuse.**
  `sidecar/acp/` speaks the Agent Client Protocol — JSON-RPC 2.0, newline-
  delimited over the child's stdio, requests in *both* directions — and
  carries nothing Copilot-specific; `sidecar/copilot/` adds only the CLI
  resolution, the spawn flags, the failure wording and the provider info, so
  Grok Build (which also claims ACP) starts from the bridge, not from zero.
  Measured against copilot 1.0.80:
  - **ACP gives the permission cards back.** `session/request_permission`
    routes through the same gate as Claude's `canUseTool`: `reviewAcp` speaks
    #223 in ACP's vocabulary — `execute` always asks, file kinds whose every
    location resolves inside the folder run silently, anything else asks —
    and the answer picks among the *options the agent offered* (`allow_once`
    / `allow_always` / `reject_once`), cancelling rather than inventing an
    option that was not on the card.
  - **Resume is `session/load`, and the replay is deliberately dropped.** The
    agent streams the whole conversation back as updates before the load
    answers; the transcript already has it, so updates are ignored until the
    response arrives.
  - **Both login failures arrive as ordinary message text**, not errors: a
    logged-out CLI and an org-policy block each "succeed" with a turn whose
    entire answer starts with `Error:`. `inBandFailure` matches exactly those
    two shapes — no wider, or it would eat real answers that mention errors —
    and converts them into the auth failure the composer already renders.
  - **The auth probe speaks the protocol instead of scraping.** `copilot` has
    no `login status`; an unauthenticated agent answers `session/new` with
    ACP's `AUTH_REQUIRED` (-32000), a logged-in one opens a session, and no
    model is ever asked. What the probe cannot see is the org-policy block —
    that state only speaks inside a turn.
  - The studio conventions ride as the leading text block of every prompt
    (ACP has no system-prompt hook) and the bundled skills ride as
    `--plugin-dir`; modes map by URI fragment — `plan` to Plan,
    `auto`/`acceptEdits` to Agent, never to Autopilot, which is
    Copilot's allow-all and has no story here; `--effort` takes the studio's
    levels verbatim; the spawn adds `--no-remote` (a desktop studio must not
    export sessions to GitHub web behind the person's back) and
    `--no-auto-update`.
- **Grok Build is the fourth adapter, and it cost almost nothing** — which
  was the ACP bridge's whole promise: `sidecar/grok/` is CLI resolution
  (`~/.grok/bin` first — its installer's home), the failure wording, the
  same protocol probe Copilot has, and a config over `acpTurn` (`grok agent
  stdio`, effort clamped to low/medium/high, model via `-m`). Accepted live
  end to end against a grok.com login: thinking and text stream as deltas,
  the studio's MCP pipeline tool was found and called through the gateway,
  a real shell command ran and answered. Three findings worth keeping:
  Grok sets no ACP `kind` on tool calls (its own names — `use_tool`,
  `run_terminal_command` — reach the rows with the wrench), its prompt
  capabilities say `image: false` so attached pictures degrade to a notice
  rather than a silent drop, and safe commands are self-approved by its own
  heuristics without a permission request — parity with what Claude's
  `auto` costs, not with the gate.
- **The provider is picked through the model, not beside it.** The Model chip
  opens one menu grouped by provider — a submenu per provider, its models
  inside — because "which model" and "whose model" are one decision, not two
  chips. Picking a model in another provider's group switches the session's
  provider; groups other than the session's are disabled once the session has
  spoken (resume tokens are not portable), and a provider whose account probe
  failed is disabled with *Sign in* or *Unavailable* on the row — fetched once
  per app run through `agent.accounts`, which shares `project.check`'s cache.
  A provider with no probe row yet is presented plainly: "unknown" must never
  read as "signed out". The model choice itself is per provider
  (`claudeModel`/`codexModel` in `settings.json`), and the turn sends the
  model of the session's provider — Codex's list is short and
  account-measured (`Default`, the one entry that cannot drift, then GPT-6
  Astra and the two gpt-5.6 slugs a ChatGPT login actually accepted; every
  other slug in the CLI source answered 400). Astra is gated by the *CLI
  version* rather than the plan: `gpt-6-astra` first appears in codex-cli
  0.153.4, and on 0.148.0 the same login answers 400 *"requires a newer
  version of Codex"* — a refusal that reaches the transcript as the router's
  own sentence, since the studio never bundles or updates the person's CLI.
- Still Claude-shaped, deliberately, until the next phases: the model picker
  and a handful of user-facing strings that say "Claude". Knowledge delivery is
  no longer among them — see *One bundle, four runtimes*.
