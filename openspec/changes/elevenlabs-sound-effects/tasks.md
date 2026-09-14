## 1. Contracts

- [x] 1.1 Record the accepted operation-time permission check and add validated sound request/operation schemas and generated provenance; verify shared/sound-effects.test.ts and shared/library.test.ts.
- [x] 1.2 Extend the reverse methods and bump both protocol constants; verify shared/ipc.test.ts and shared/protocol.test.ts.

## 2. Core execution

- [x] 2.1 Add bounded ElevenLabs preflight/generation with safe errors and MP3 validation; verify Rust sound tests with a counted local HTTP fixture.
- [x] 2.2 Persist prepared/dispatched/completed attempts, reject duplicate dispatch and stale connections, recover uncertain state, and expose prepare/commit/status/cancel/recovery methods; verify Rust operation tests and cargo check.

## 3. Shared agent service and library

- [x] 3.1 Enforce one-time approval in the common service, propagate cancellation, and register generation/status tools for all transports; verify sidecar/integrations/sounds.test.ts and sidecar/tools tests.
- [x] 3.2 Import completed audio idempotently, recover on startup/status, preserve provenance and existing assets; verify sidecar/library/sounds.test.ts and insertion tests.

## 4. Interface and verification

- [x] 4.1 Show complete paid-request summaries, key permission guidance and generated source details using existing hooks/playback/picking; verify permission and library UI tests.
- [x] 4.2 Add a changeset and run scoped formatting, typecheck, check, Rust tests/check, touched tests and the full Bun suite once; record results.
- [ ] 4.3 In the running app, complete a specifically authorized paid generation, play the saved sound locally, attach it to a Video, and verify Keychain replacement/removal; record evidence without secrets.

## 5. Composer discovery

- [x] 5.1 Add the approved English Generate sound pill, current-connection routing, editable prompt and focused verification.

- [x] 5.2 Restrict the shortcut to a settled current chat with an assistant response; verify new-chat hiding and appearance after completion.

- [x] 5.3 Place Generate sound above TaskDock and QueueDock while preserving visibility and draft behavior.

## 6. Result cards

- [x] 6.1 Emit and persist typed sound results, deduplicate them, and render a local player inside the transcript.
- [x] 6.2 Reuse turn.send through a shared action hook for Use in video; prepare editable Regenerate prompts; handle duplicate clicks, missing media and drafts.
- [x] 6.3 Apply ui-polish and better-ui, verify player/action/history behavior and run formatting, typecheck, lint and full tests.
