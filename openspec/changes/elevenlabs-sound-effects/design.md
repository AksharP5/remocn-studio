## Context

See proposal.md for scope. Inspection on 2026-09-12 found:

- `integrations-framework` reports 29/31 tasks complete. Its unchecked 2.5 is the command-boundary failure test (commands already exist); 6.6 is manual app verification. Neither is evidence of a finished sound feature.
- `src-tauri/src/integrations/elevenlabs.rs` calls `/v1/user` and unconditionally reports `audio`; it has no generation path. `first_name`, falling back to `user_id`, is the account identity. The REM-411 comment confirms this is deliberate.
- `sidecar/integrations/core.ts` times out after 10 seconds. `src-tauri/src/sidecar/mod.rs` already dispatches reverse requests independently, but the integration dispatcher is synchronous.
- `shared/library.ts` accepts only a Pexels source. `sidecar/library/store.ts` owns manifest construction, while `sidecar/library/insert.ts` owns non-overwriting project copies.
- The outward permission classifier is in the Claude path. Paid-operation approval must be enforced at the shared tool execution boundary, since Codex and ACP use the gateway too.
- The focused baseline command ran 60 tests across the shared contract, webview client/hook/section and reverse-channel client: all passed. Rust and manual behavior were not verified in this planning pass.

Provider evidence: the [Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) and [public OpenAPI](https://api.elevenlabs.io/openapi.json), inspected 2026-09-12, specify `/v1/sound-generation`, `xi-api-key`, duration 0.5–30 seconds, `eleven_text_to_sound_v2`, and `output_format` in the query. The default is `mp3_44100_128`; MP3 192 kbps requires Creator or higher. The user schema contains subscription information, but no key-permission list. The published API-key listing endpoints are for service accounts, not introspection of an arbitrary personal key. No documented idempotency mechanism was found on sound generation.

## Goals / Non-Goals

**Goals:** retain the existing process boundaries; make payment consent independent of the CLI; make every paid attempt identifiable and recover locally when possible.

**Non-Goals:** introduce a second connection manager, a generic background-job platform, a new editor, or another copy of library manifest rules.

## Decisions

### The first flow starts in chat and finishes in the library

Register `generate_sound_effect` and a read-only attempt-status tool on `remocn-library`. `list_connections` must include stable connection IDs as well as names/accounts so the model can select an actual connection. The generator accepts the connection ID, a sound name, text, nullable duration and an explicit format. The service constructs the displayed summary from decoded parameters and core-held identity, never from a model-authored summary. It states that credits are charged to ElevenLabs.

Choose MP3 44.1 kHz at 128 or 192 kbps for the first version; these are directly playable local assets. Default to 128. Do not expose raw PCM as a WAV file or silently substitute formats. A dedicated generation pane would duplicate this flow and is not required by the issue's UI/tool wording. A bare agent HTTP request was rejected because it would require exposing the key.

### Permission checks are honest about what can be known

The existing `GET /v1/user` verifies account access and provides subscription data. It cannot prove the personal key has `sound_generation`. Do not invent a permissions field, request service-account administration privileges, or issue a paid probe while connecting.

The proposed behavior is to explain the required `user_read` and `sound_generation` rights in Settings; verify account access there; validate known format/tier restrictions before spending; and let the first explicitly approved generation verify operation-specific access. A missing generation permission is a recoverable connection problem with instructions to replace/reconfigure the key, not proof of an invalid account. Unknown subscription tiers do not automatically qualify for restricted formats.

Accepted on 2026-09-12 when the user requested implementation after reviewing this limitation: account access is verified at connection time; sound-generation permission is verified by the first explicitly approved operation. The framework capability wording is aligned with this provider limitation.

### One service owns approval for all agent providers

The sidecar owns the common generation orchestration and pending approval, using Effect and the existing permission gate. The core owns the immutable prepared operation and revalidates the connection immediately before sending. A prepare response includes the operation ID and actual connection identity; approving commits that exact operation once. Replacing/removing/disabling the connection or changing approved parameters invalidates preparation.

Use the existing outward card's one-call choices. Enforce it inside the common service for Claude, Codex, Copilot and Grok, even when the CLI considers its tool trusted. Do not rely only on `ToolSpec.outward`, which risks either missing other transports or showing duplicate cards. An agent-supplied `approved: true` is never an authorization. Register a waiting gate before publishing its card. Reject `always` for paid actions even if a malformed response supplies it.

The existing gateway's AbortSignal is adapted at its Promise boundary to an Effect fiber. Stop/deny before commit sends no paid request. Stopping after dispatch cannot guarantee that the provider stopped charging; the UI says so and the durable attempt remains inspectable.

### Rust owns the paid attempt and staged output

Add a narrowly scoped sound-operation module alongside the adapter. It owns prepare/commit/status/cancel state and stages output under the app data directory. Expose these through typed methods in `shared/ipc.ts` over the existing reverse channel; make Rust's dispatcher asynchronous without blocking other requests. Long generation runs as a core task; status requests remain short, so the global 10-second timeout need not be enlarged.

Persist a unique operation ID and immutable parameters before dispatch. Atomically move from prepared to dispatched before the single POST. Duplicate commits return existing status; they never issue another POST. A process restart with an unfinished dispatched attempt yields an uncertain result, not a retry. A new attempt always requires a new approval.

HTTP uses finite connection/request deadlines, disabled automatic paid retries and redirects, bounded downloads, and no raw response bodies in user errors or logs. For the selected MP3 formats, verify content type and media signature before marking output complete. A partial file never becomes an asset. Store a provider request ID and actual reported character cost when available; do not invent a quoted price.

### Library ingestion is separate from generation and can be retried safely

The sidecar imports completed staged output with the existing library store. A generated-source variant records operation ID, provider, connection ID/name, text, requested duration, model and output format; never a credential, key preview or raw account response. Existing Pexels manifests remain valid.

Reserve a unique asset folder atomically using the existing slug/suffix convention, copy with exclusive creation, then publish the manifest. Serialize imports for the same operation and find an existing manifest by operation ID before writing. If the sidecar crashes after the manifest is published but before acknowledging import, recovery returns the existing asset. If local import fails, retain staged audio and retry import only. After a confirmed import, staged duplicates can be deleted; receipts remain sufficient to prevent a paid replay.

Run recovery when the sidecar becomes ready, when listing the library and when listing operation status. A core completion notification refreshes an open library. Each staged MP3 has an operation-specific filename so several sounds can coexist in a project’s shared public/library folder. A durable imported receipt prevents recovery from recreating an asset the person later deletes. Recovery processes only already-downloaded results, never starts generation. Refresh the library on completion. Reuse thumbnail/audiomap backfill and local audio playback. Generation does not attach an asset or change project code; the person explicitly selects the asset for a message targeting a Project/Video, which uses existing non-overwriting insertion.

### Verification follows the irreversible boundary

Use a local HTTP fixture with counted requests and a fake keychain. Test exact outgoing parameters, account/format checks, missing permissions, quota/rate limits, malformed/truncated audio, network failure before and after dispatch, cancelled approvals, concurrent duplicate commit, restart and failed ingestion. Assert no secrets in outgoing IPC, manifests, transcript events or captured logs. Test the same shared permission path through each agent transport. Keep the actual paid run as a separately authorized acceptance test in the user's running app.

## Risks / Trade-offs

- Unknown provider outcome → report possible credit use; never promise refund or automatic retry.
- Account data does not prove key scopes → explicit acceptance decision above, accurate UI wording and operation-time error handling.
- Approval can become stale → bind immutable preparation to connection identity and credential revision; refuse changed preparations before dispatch.
- Download succeeded but import failed → retain local audio and retry ingestion without generating.
- Attempt storage fails → refuse before payment; if failure occurs after dispatch, preserve staged evidence and report uncertainty.
- Multiple running videos → isolate approvals/operations by turn; protect common operation state against duplicate execution.

## Migration Plan

No new settings.json key and no history database migration. Keep attempts in an app-owned directory, separate from connection metadata. Coordinate `SIDECAR_PROTOCOL` and Rust `PROTOCOL` (31 → 32). Extend source decoding without rewriting older manifests. An older build may omit generated-source assets it cannot decode; it must not delete them. Leave the existing framework's two unchecked tasks unchecked until their own evidence exists. Preserve the user's unrelated working-tree changes.

### Discover generation from the composer

Approved follow-up: show an English “Generate sound” pill above the TaskDock and QueueDock, aligned with the empty composer, only after an agent response in the current chat has finished. Hide it in new chats, empty projects, while loading the transcript, and during execution or approval. Clicking reads current connections. A usable ElevenLabs audio connection inserts “Generate a sound effect: ” through the existing composer insertion and caret behavior; it does not submit. Otherwise open Settings → Integrations. Hide the pill for a nonempty draft, disable it with the composer and while checking, and show connection-read failures inline. Preserve attachments and any text entered while the read is pending.

### Persistent sound result cards and direct actions

The approved follow-up renders a sound result as a typed transcript entry immediately after library ingestion, independent of assistant prose. Store the operation ID, request and asset snapshot through the existing recorder; upsert duplicate events by operation ID and keep the card visible after reopening history. Status lookups can surface an already imported result too. No credential or staging path is included.

Use a compact token-based card with Sound ready status, title, provider and a local audio transport. Use measured media duration, tabular timing, an accessible seek control, 44px action targets, neutral focus treatment and restrained press feedback. Errors are inline; playback never starts automatically.

Use in video invokes a shared useTurnAction hook around the existing turn.send path. It reads the current library asset before attaching it, preserves the composer draft, rejects a missing asset and suppresses duplicate clicks. A busy video follows the existing queue. Regenerate inserts an editable prompt preserving the original connection, description, duration and format and never sends by itself. This does not authorize paid generation.
