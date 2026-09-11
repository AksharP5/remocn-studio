## Why

Linear REM-404, with REM-405 (core), REM-406 (credentials) and REM-407 (Settings) as its
foundation children.

The studio can only reach services it was built to reach. Adding ElevenLabs sound, a Figma
import or a YouTube upload today means a bespoke seam each time — its own storage, its own
states, its own failure wording. Three connection-shaped things already exist and no two are
alike: the account token sits in the Keychain and is used only by Rust, the Pexels key sits in
a plain file inside the library folder, and the four AI providers hold nothing at all because
the person signs into their own CLI.

This change adds one framework so a new service is an adapter, not a subsystem: a named
connection the person creates in Settings, a secret the Keychain holds per connection, and a
set of capabilities the studio's own tools draw on.

## What Changes

- **Two services can be connected: ElevenLabs with an API key and Figma with a personal access
  token.** Each is an adapter of about eighty lines — how it authorizes, how it checks itself,
  what it can do — and neither carries any lifecycle of its own.
- A new **Integrations** section in Settings: a catalogue of services, *Add integration*, and
  a list of connections showing service, name, account, capabilities and state. Check,
  reconfigure, reconnect, disable and remove. Several connections of one service are allowed
  and told apart by name and account.
- **A connection is REST only.** Authorization is an API key, a personal token, or desktop
  OAuth with a local callback. There is no MCP transport and no bridge: an agent reaches a
  service through the studio's own tool servers, never through a third-party MCP server.
- **The Rust core owns both the secret and the request**, one Keychain entry per connection.
  A secret never enters a webview frame, a sidecar log, a turn or a project file, and a saved
  secret is never read back into the UI.
- **A tool that publishes outward always raises a permission card**, per piece of material.
  The silent auto-allow that the studio's own tool servers enjoy stops at the studio's edge.
- **BREAKING** — **AI Accounts moves out of its own rail section** and becomes a group inside
  Integrations. It keeps its probe-only behaviour: nothing to create, nothing to remove.
- **BREAKING** — **Stock media leaves Settings entirely.** The Pexels key can no longer be
  pasted or forgotten; stock search runs on the key the build ships and on
  `REMOCN_STUDIO_PEXELS_KEY`.

## Capabilities

### New Capabilities

- `integrations/connection-lifecycle`: Provider, Connection and Capability; the registry; the
  states a connection moves through; creating, checking, reconnecting, disabling and removing;
  what a removed connection stops being available to.
- `integrations/credentials`: one Keychain entry per connection; desktop OAuth through the
  system browser with a local callback; replacing an expired key; what the core refuses to
  hand to any other process.
- `integrations/settings-section`: the Integrations section — the catalogue, the add flow, the
  connection list, its actions, and the AI-accounts group that sits beside it.

### Modified Capabilities

- `shell/settings-page`: Integrations joins the rail; the AI Accounts requirement moves into
  the new capability; the Stock media requirement is removed.
- `library/stock-search`: the key is no longer settable from the webview — the requirements
  that let a key be pasted and forgotten, and the wording that sends a person to Settings, go
  away.
- `agent/permissions`: a new requirement that outward-publishing tools always ask, and are
  never remembered.

## Impact

- **Shared contract**: a new `integrations.*` method family in `shared/ipc.ts`, mirrored in
  `src-tauri/src/ipc.rs`; `SIDECAR_PROTOCOL` and the Rust `PROTOCOL` bump together.
  `library.stockKey` — the only method that sets or forgets the key — is removed;
  `library.stockStatus`, `library.stockSearch` and `library.stockSave` are untouched.
- **Rust core**: per-connection Keychain entries beside the existing account token; the
  provider HTTP client; the OAuth callback listener.
- **Sidecar**: the connection manager and the registry on Effect; new tools on the existing
  `remocn-*` servers; the per-tool policy in `sidecar/claude/permission.ts`.
- **Webview**: `hooks/use-integrations.ts` and `lib/studio/integrations.ts`; the Settings rail
  and its sections; the Stock media section and its hook are deleted.

## Non-goals

- **No Remocn OAuth server, broker or cloud execution**, and no scheduler. Everything runs on
  this Mac, with the person's own credentials.
- **No MCP integrations and no Paper.** Paper speaks only MCP, and a person who wants it can
  configure it in their own CLI; the studio neither brokers nor displays it. This removes
  REM-265 from the framework.
- **No Pexels migration.** The shared key stays baked into the release bundle exactly as it is
  today; only its Settings surface goes.
- **No feature built on a connection.** The adapters here only connect and check themselves.
  Generating a sound, importing a frame and publishing a video stay with REM-411, REM-260 and
  REM-262; a connection this change creates is something the studio holds, not yet something it
  uses.
- **No TikTok or Instagram adapter.** REM-404 asks for their feasibility to be confirmed before
  an adapter is written — TikTok needs a client secret the studio may not ship and a Direct Post
  audit, Instagram needs a person's own Meta application. Guessing at either would put a service
  in the catalogue that cannot honestly be connected.
- **No publishing UI.** The permission rule for outward tools is written here; the flows that
  use it are not.
