## Why

[REM-411](https://linear.app/remocn/issue/REM-411) completes the first useful operation on the integrations framework: a person asks for a sound effect, pays through their own ElevenLabs connection, and receives reusable local audio. The existing adapter connects and checks a key but cannot generate anything.

## What Changes

- Add sound-effect generation through the studio's agent tool server, using the existing Settings connection. The first entry point is a chat request; the existing permission card and library provide its visible workflow.
- Before spending credits, show the actual connection name/account, description, duration, format and billing notice, and require approval for that individual request across every agent provider and permission mode.
- Keep credentials and provider HTTP in Rust. Validate parameters and known format restrictions before sending; distinguish account verification from generation permissions that `/v1/user` does not report.
- Save completed audio into the existing library with structured generation provenance. Reuse local playback and explicit asset attachment to a Project/Video.
- Track attempts durably so a timeout, cancellation, process restart or lost answer never triggers an automatic paid retry. Recover downloaded audio without another generation.
- Preserve existing assets and existing Pexels provenance when adding generated audio.

## Capabilities

### New Capabilities

- `integrations/sound-effects`: ElevenLabs parameter validation, permission discovery limits, approved execution, attempt recovery and provider failures. Depends on the active `integrations-framework` change for connection lifecycle and credentials.

### Modified Capabilities

- `library/asset-library`: generated audio provenance, recoverable ingestion and explicit reuse without overwriting assets.
- `agent/permissions`: per-request paid generation approval enforced inside the common service for all agent transports.

## Impact

- Shared contract: sound-effect request/result/attempt schemas, reverse-channel methods and a coordinated protocol bump; generated source variant in `shared/library.ts`.
- Rust core: ElevenLabs HTTP adapter, bounded audio download, durable attempt records and staging; existing Keychain/lifecycle reused.
- Sidecar: common generation service, permission gate integration, idempotent library import and agent tool registration.
- Webview: readable permission summary, generated provenance in library details and existing local playback/asset picking.
- No new runtime dependency or Remocn plan restriction is proposed.

## Non-goals

- TTS, music generation, voice cloning and Remocn cloud billing are outside REM-411.
- A separate sound editor or generator page is unnecessary for the first agent-driven flow; the tool, permission card and library complete it.
- Browser OAuth and other integration providers remain separate work.
- The implementation does not authorize a live paid test by itself; that test requires a concrete user request and approval in the running app.
