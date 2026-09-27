## Context

Where the per-sound questions come from, read from the code on 2026-09-27:

- **The card is the shared gate's, not an integration's own dialog.** Three places
  raise a permission card, and all three publish the same `permission` event on the
  turn's stream and wait on the same `PermissionGate` (`sidecar/agent/gate.ts`):
  the Claude `canUseTool` guard (`sidecar/claude/guard.ts`), the ACP bridge's answer
  to `session/request_permission` (`sidecar/acp/permission.ts`, Copilot and Grok),
  and the paid-generation service (`sidecar/integrations/sounds.ts`), which raises an
  `outward` ask from inside the studio's own `generate_sound_effect` /
  `generate_music` tool, so it asks on every provider, Codex included, whatever the
  mode. Codex raises no other card.
- **The webview answers them one at a time.** `useTurns` appends each `permission`
  event to `TurnState.permissions`; `useOpenTurn` exposes `permissions[0]`;
  `PermissionCard` renders that one ask, keyed by its id. Asks outstanding together
  are already queued, but the person meets them one after another.
- **The sound tool takes one sound, and the CLIs run it serially.** Claude Code
  marks an MCP tool concurrency-safe only through its annotation —
  `isConcurrencySafe(){return v.annotations?.readOnlyHint??!1}`, read out of the
  shipped `claude-agent-sdk-darwin-arm64/claude` binary — and our tool host declares
  no annotations. Codex does the same: an MCP tool runs in parallel only with
  `readOnlyHint` or a server opt-in (`repos/codex/codex-rs/core/src/tools/handlers/mcp.rs`,
  `supports_parallel_tool_calls`). So three `generate_sound_effect` calls in one
  assistant message run one after another on both: prepare → card → approve →
  generate (seconds) → result → the next call's card. Gathering on the screen alone
  would never see two sound asks outstanding at once.

## Goals / Non-Goals

**Goals:** one card for the asks the person can answer together; each ask still
named on it, still answerable on its own; the sound tool able to put every sound
the person wants on that card.

**Non-Goals:** any approval that covers a request nobody has read; a frame change.

## Decisions

### Gather on the webview, by reason, from the queue that already exists

`gatheredAsks(permissions)` in `lib/studio/permission.ts` takes the oldest
outstanding ask and every other ask of the chat with the same reason; a plan is
returned alone. `useOpenTurn` exposes that list as `asks` next to `permission`
(still the oldest, which the frame label, the sound pill and the waiting marks
read). The card stays keyed by the oldest ask's id, so an ask that joins re-renders
it without a remount and focus stays put.

The sidecar and the contract are untouched: the gate still holds one deferred per
ask, and the card answers each ask with its own `agent.permission` request. The
answers leave in one click handler, so React commits the removal once. No
`SIDECAR_PROTOCOL` / `PROTOCOL` bump, no migration, no settings key.

Grouping by reason keeps one set of choices per card: "always" exists for commands,
paths and tool calls and never for a paid request, and a mixed card would have to
offer a choice that means something different per row.

*Alternative rejected:* a batch frame from the sidecar naming which asks belong
together. It would only regroup what the queue already holds, costs a protocol
bump, and still could not merge calls the CLI makes one after another.

### The selection lives in the card's hook

`usePermissionCard(asks, onAnswer)` holds the set of unchecked ask ids — so an ask
that joins arrives checked, like the rest — and turns a choice into one answer per
ask: approve or always for the checked, deny for the unchecked, deny for all on
Decline all or Escape, and a single cancel on Cancel turn (stopping the turn
abandons every ask of it in the gate). With nothing checked the approve choices are
disabled. The wording — `Send all 3`, `Send 2 of 3`, `Approve all 3`,
`Always allow 2 of 3 until quit` — comes from `batchChoices` in
`lib/studio/permission.ts`, so the count is on the button the person presses.

A single ask renders exactly as before: no checkbox, the same four (or three) choices.

### The sound tool takes a list

`generate_sound_effect` now reads `{ connectionId, sounds: [{ name, text,
durationSeconds, format }] }`, one to ten sounds, and its description tells the agent
to send every sound the person asked for in one call. `generateSounds` prepares each
sound in order (a refused preparation cancels the ones already prepared and raises
no card), raises every ask concurrently — `Effect.forEach` with unbounded
concurrency over `gate.wait`, each ask registered before its event is published —
then commits the approved ones one after another, each with its own "Generating…"
notice and its own status polling. The approved sounds are sent sequentially rather
than all at once so a quota or rate-limit refusal on one does not become a burst.

The answer to the agent is one JSON object per sound: the saved asset, the
uncertain/failed detail, or `declined` with the instruction not to request it again.
A single-sound call answers exactly as before, and a call whose every sound was
declined fails with the same refusal sentence, so an agent reading the old shape
loses nothing. `generate_music` keeps one track per call and goes through the same
function with a list of one.

*Alternatives rejected:*

- **`readOnlyHint` on the paid tools** so the CLIs run them in parallel and the
  asks overlap. The hint would be false, and Claude Code's auto-mode classifier
  reads the same annotation.
- **"Allow the rest of this turn"** for a tool or a connection. It approves requests
  the person has not seen — descriptions, durations, charges — which the
  sound-effects contract rules out (approval binds to the exact values and is never
  remembered).
- **Holding the first ask open to wait for siblings.** Sequential calls do not exist
  yet while the first one waits; there is nothing to wait for.

### What each provider does

| Provider | Card raised by | Gathers |
| --- | --- | --- |
| Claude Code | `canUseTool`, and the sound service | Asks the CLI raises concurrently (concurrency-safe tools, e.g. reads outside the folder) and every sound of one `generate_sound_effect` call. Bash and other non-read-only calls are run one at a time by the CLI, so their asks arrive one at a time and get a card each. |
| Codex | the sound service only | Every sound of one call. Codex has no other cards. |
| Copilot, Grok (ACP) | `session/request_permission`, and the sound service | Requests the agent sends without waiting for the previous answer (the bridge answers each JSON-RPC request independently) and every sound of one call. An ACP agent that waits for each answer before asking the next is asked one card at a time; nothing on our side can see its next request early. |

## Failure directions

- An ask that joins a card just before the person clicks is answered with the rest;
  the count on the button and the listed row are the notice. The race window is one
  render.
- An `agent.permission` answer that fails to reach the sidecar sets the chat's error,
  as today, per ask; the gate's ten-minute limit still denies anything left waiting.
- A sound whose commit fails is reported in words in the tool result beside the
  others; nothing is retried. Every prepared sound is cancelled on the way out, so a
  stopped turn leaves nothing waiting to be sent.
- A tool call with an invalid sound in the list is refused by the schema before
  anything is prepared, with the MCP error the agent already reads.

## State

- `TurnState.permissions` (webview) — unchanged; the gathered list is derived.
- The unchecked set (webview, card hook) — lives and dies with the card.
- Pending asks (sidecar gate) — unchanged, one per sound.
