## 1. Shared contract

- [x] 1.1 Add `shared/integrations.ts` — `Provider`, `Connection`, `Capability`, the authorization kinds and the four connection states as Effect Schema, plus the registry shape a provider fills in; verify `shared/integrations.test.ts` decodes a connection, refuses one carrying a secret field, and refuses an unknown state
- [x] 1.2 Add the request and answer shapes for the integrations family (catalogue, create, check, reconfigure, reconnect, disable, enable, remove) to `shared/integrations.ts` as Schema — the webview reaches these through Tauri commands, as it does the account, so they do not join `METHOD_NAMES` in `shared/ipc.ts`; verify `shared/integrations.test.ts` decodes each answer and that no answer shape can carry a secret
- [x] 1.3 Add the reverse frame to `shared/ipc.ts`: a `request` member on `SidecarFrame` and a `result` member on `HostFrame`, both carrying a request id, plus the one method the sidecar asks the core with — the connections a turn may use; verify `shared/ipc.test.ts` round-trips both frames, drops a malformed one, and decodes the method's answer
- [x] 1.4 Bump `SIDECAR_PROTOCOL` to 31 and `PROTOCOL` in `src-tauri/src/ipc.rs` together, and mirror the new frame members in serde; verify `shared/protocol.test.ts` passes and `cargo check` compiles

## 2. Rust core — secrets, metadata and the providers

- [x] 2.1 Add `src-tauri/src/integrations/keychain.rs` — one `keyring` entry per connection id, with store, read, replace and delete; verify a Rust unit test covers a write, a replace that leaves a second connection untouched, a delete, and a refused write surfacing as a worded failure
- [x] 2.2 Add `src-tauri/src/integrations/store.rs` — the `integrations` key in `settings.json`, holding only id, provider, name, account label, capabilities, disabled and the keychain reference; verify a Rust unit test round-trips the list and rejects a record carrying any secret-shaped field
- [x] 2.3 Add `src-tauri/src/integrations/provider.rs` — the adapter trait a provider fills in (how it authorizes, how it checks itself, which capabilities it implements) and the registry over it; verify a Rust unit test drives a fake adapter through create, check, reconnect, disable and remove without provider-specific lifecycle code
- [x] 2.4 Add the loopback listener for browser authorization — ephemeral port, the provider's required proof of origin, cancel and timeout, and dropping an answer whose state does not match the attempt in progress; verify a Rust unit test covers a completed trip, a cancelled one, a timed-out one and a mismatched answer
- [ ] 2.5 Add the Tauri commands the webview calls for the `integrations.*` family, each returning a worded failure rather than a status code; verify `cargo check` compiles and a Rust unit test asserts a failing provider answer reaches the command as a sentence
- [x] 2.6 Answer reverse requests from the sidecar on a task independent of the webview request being serviced, in `src-tauri/src/sidecar/`; verify a Rust unit test proves a reverse request is answered while a webview request is in flight, and that an unanswerable one returns a worded failure rather than hanging

## 2b. The first two adapters

- [x] 2b.1 Add `src-tauri/src/integrations/elevenlabs.rs` — an API key checked against `GET /v1/user` with the `xi-api-key` header, carrying the audio capability; verify a Rust unit test covers the account read from a body that names one and one that does not, and that a refused, rate-limited and unexpected status each come back as a sentence
- [x] 2b.2 Add `src-tauri/src/integrations/figma.rs` — a personal access token checked against `GET /v1/me` with the `X-Figma-Token` header, carrying the import capability; verify a Rust unit test covers the account falling back from email to handle to id, and that a 403 names the scopes the token is missing
- [x] 2b.3 Put both in the shipped registry; verify a Rust unit test asserts the catalogue is exactly those two and that a service with no adapter is absent

## 3. Sidecar — the turn's side

- [x] 3.1 Add `sidecar/integrations/core.ts` — the Effect client for the reverse channel, failing with a `Data.TaggedError` so no bare `UnknownException` reaches a caller; verify `sidecar/integrations/core.test.ts` covers an answer, a worded failure and a request that is never answered
- [x] 3.2 Add the connections read to the studio's own tool servers — service, name, account and capabilities for connected connections only, an empty list worded as a sentence; verify `sidecar/integrations/core.test.ts` and `sidecar/tools/specs.test.ts` cover a populated answer, an empty one, and that a disabled or unchecked connection is absent
- [x] 3.3 Teach the gate the outward-acting class in `sidecar/claude/permission.ts` — always a card, in every mode, never remembered; verify `sidecar/claude/permission.test.ts` registers a fake outward tool and asserts a card in auto, a second card for a repeat call, no remember option, and denial on a stopped turn

## 4. Webview — Settings

- [x] 4.1 Add `lib/studio/integrations.ts` returning `Effect` over the Tauri commands, with failures as `Data.TaggedError`; verify `lib/studio/integrations.test.ts` covers each call and that a failure arrives as a sentence
- [x] 4.2 Add `hooks/use-integrations.ts` — the list, the add flow's steps, and check, reconfigure, reconnect, disable, enable and remove as actions; verify `hooks/use-integrations.test.tsx` covers a successful add, a check that refuses, a cancel that stores nothing, and a keychain failure that adds no row
- [x] 4.3 Add the Integrations section to `components/studio/settings-page.tsx` with the services group and the AI accounts group, rows carrying service, name, account, capabilities and state; verify `components/studio/settings-page.test.tsx` covers both groups, a row that needs authorization, and two connections of one service told apart by account
- [x] 4.4 Make every connection action reachable by keyboard and put a confirmation before removal that names the secret on this Mac; verify `components/studio/settings-page.test.tsx` walks the actions by keyboard and asserts nothing is removed until the confirmation is accepted
- [x] 4.5 Replace `accounts` with `integrations` in `SETTINGS_SECTIONS` in `hooks/use-settings-view.ts`, and point `openAccounts(provider)` at Integrations with that provider's row marked; verify `components/studio/settings-page.test.tsx` asserts the model menu's *Sign in* lands on Integrations with the row outlined

## 5. Removing Stock media from Settings

- [x] 5.1 Delete the Stock media section from `components/studio/settings-page.tsx`, delete `hooks/use-stock-key.ts`, and drop `stock` from `SETTINGS_SECTIONS`; verify `components/studio/settings-page.test.tsx` no longer finds the section and its rail row
- [x] 5.2 Remove `library.stockKey` from `shared/ipc.ts`, `sidecar/handlers.ts` and `lib/studio/stock.ts`, leaving `stockStatus`, `stockSearch` and `stockSave`; verify `lib/studio/stock.test.ts` passes and `bun run typecheck` finds no caller left
- [x] 5.3 Read the Pexels key from `REMOCN_STUDIO_PEXELS_KEY` only in `sidecar/library/stock.ts`, ignoring a `stock.json` written by an earlier version; verify `sidecar/library/stock.test.ts` covers a key from the environment, no key at all, and a stale file being ignored
- [x] 5.4 Reword the stock pane's no-key and refused-key messages so neither offers Settings, in `hooks/use-stock.ts` and `components/studio/stock-pane.tsx`; verify `components/studio/stock-pane.test.tsx` asserts the new wording and that no Open Settings control is rendered

## 6. Verification

- [ ] 6.1 Run `bun run fix` then `bun run typecheck` — fix can drop or duplicate a JSX attribute, so the typecheck is the gate
- [ ] 6.2 Run `bun run check` and `cargo check --manifest-path src-tauri/Cargo.toml`, and confirm both pass on the final tree
- [ ] 6.3 Run the touched test files, then `bun run test` once in full, and confirm no suite regressed
- [ ] 6.4 Add a changeset with `bun run changeset` covering the Integrations section, the AI Accounts move and the removal of Stock media from Settings
- [ ] 6.5 Record in CLAUDE.md the two new working facts: one keychain prompt per connection in an unsigned development build, and that `settings.json` carries connection metadata while the keychain carries every secret
- [ ] 6.6 Ask the user to run the app and confirm what only the running app shows: Settings opens on Integrations and the shell underneath keeps its turn and preview; a browser authorization trip completes and a cancelled one leaves no pending connection; the macOS keychain prompt appears as expected on a debug build; and the stock pane's no-key wording reads correctly with the key removed from the environment
