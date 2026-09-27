## Why

Reported: asking for several sound effects puts the person through one permission
card per sound. ElevenLabs can make several sounds in a row, and each of them stops
the turn to ask whether the request may be sent — approve, wait for the sound,
approve again. The questions have to be gathered into one.

Two things produce the run of cards. The permission card shows only the oldest
outstanding ask of the chat, so asks that are outstanding together are still
answered one by one. And the sound tool takes one sound per call: every provider
runs a studio tool call only after the previous one has returned (Claude Code runs
an MCP tool concurrently only when it is marked read-only, Codex likewise), so three
sounds are three calls, and the second card cannot exist until the first sound is
finished. Gathering on the screen alone would not have merged them.

## What Changes

- Asks outstanding together in the open chat share one permission card when they
  have the same reason — commands with commands, paths with paths, requests to a
  connected service with requests to a connected service. The card lists every ask
  with what it names: the command, the path, or the full request summary.
- Each ask on a gathered card has a checkbox, checked to begin with. The approve
  choice approves the checked asks and declines the rest; Decline all and Cancel
  turn answer every ask on the card; Escape declines them all. An ask that arrives
  while the card is up joins it; one that arrives after the answer starts a new card.
- A plan is never gathered. A paid request is never remembered, so a gathered card
  of requests to a connected service offers no "always", and there is no allowance
  for the rest of the turn: consent always names the request it covers.
- `generate_sound_effect` takes a list of sounds on one connection. The studio
  prepares every sound, raises all their asks at once — so they land on one card —
  and sends the approved ones one after another. The agent is told which were sent,
  which were declined and which failed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent/permissions`: asks with the same reason share one card, answered all at
  once or item by item.
- `integrations/sound-effects` (introduced by the active `elevenlabs-sound-effects`
  change): several sound effects are one call and one card.

## Impact

- Shared contract: none. The asks are the same `permission` events, answered by the
  same `agent.permission` request, one per ask. No protocol bump.
- Sidecar: `sidecar/integrations/sounds.ts` generates a list; `sidecar/tools/specs.ts`
  and `execute.ts` carry the list shape of `generate_sound_effect`. The gate is
  unchanged.
- Rust core: none.
- Webview: `lib/studio/permission.ts` gathers and words the batch,
  `hooks/use-permission-card.ts` holds the selection and answers each ask,
  `hooks/use-open-turn.ts` exposes the gathered asks, `permission-card.tsx` renders
  the list.

## Non-goals

- An allowance for the rest of a turn, for a tool or for a connection. It would
  approve paid requests nobody has read yet, which the sound-effects contract rules
  out: approval binds to the exact request.
- Batching calls an agent makes one after another. Nothing exists to gather until
  the previous call returns; the tool description asks the agent to send every
  sound in one call instead.
- Marking the studio's paid tools read-only so the CLIs run them in parallel. They
  are not read-only, and Claude Code's own classifier reads the same hint.
- A list shape for `generate_music`. A person asks for one track at a time; its
  asks gather on the card anyway if they ever arrive together.
