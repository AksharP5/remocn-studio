## Context

See proposal.md — Why. What shapes the approach is where the three processes already stand.

- **The core already owns a secret and refuses to hand it over.** `src-tauri/src/account.rs`
  keeps the session token in the login keychain through the `keyring` crate and makes every
  account request itself. `docs/decisions/signing-in.md` records why the obvious `auth_read`
  command was never written: two measurements forced it — the landing sets no CORS headers, so a
  `tauri://localhost` page cannot call it, and the device name travels in a `User-Agent` a page
  is not allowed to set — and the conclusion was kept as a rule, that a command which *uses* the
  token is one fewer place it can be logged from.
- **Frame directions are asymmetric, and measured.** `shared/ipc.ts:1528` — the core sends the
  sidecar `request | cancel`; the sidecar sends back `ready | stream | result | error | notify`.
  Every one of those is an answer or an announcement. **There is today no way for the sidecar to
  ask the core for anything.**
- **A user's own MCP servers already reach a turn.** `sidecar/codex/home.ts` builds its mirrored
  `CODEX_HOME` by starting `config.toml` from `read(real/config.toml)` — the person's own file
  verbatim, `[mcp_servers.*]` included — and where no mirror is built the turn runs in the real
  `~/.codex`. `sidecar/claude/session.ts` never sets `strictMcpConfig`, and the SDK documents
  that flag as the way to ignore "project `.mcp.json`, user settings, plugins". Whatever the
  studio does, those servers arrive.
- **Stock media is the counter-example to avoid repeating.** The Pexels key sits in a plain file
  in the library folder, with the key the build ships as fallback — `bun build --env` bakes
  `REMOCN_STUDIO_PEXELS_KEY` into the release bundle, so every install shares one Remocn key.

## Goals / Non-Goals

**Goals:**

- One lifecycle every provider is driven through, so a new service is an adapter.
- A secret that is reachable only by the code that issues the request to the service.
- A path by which a turn can act through a connection, with the studio deciding what may happen
  silently and what must be asked.

**Non-Goals:**

- Effect all the way down for provider work. The decision below puts adapters in Rust; the
  Effect surface is the webview's `lib/studio/*` and the sidecar's side of the reverse channel.
- Migrating the Pexels key. It stays exactly where it is; only its Settings surface goes.
- A generic remote-procedure layer. The reverse channel below carries the integration methods and
  is not opened to anything else in this change.

## Decisions

### The core holds the secret and makes the request

Considered four shapes for where a secret lives at the moment it is used:

| | shape | why not |
|---|---|---|
| a | core reads the keychain, hands the secret to the webview, webview forwards it to the sidecar | the secret crosses two process boundaries and sits in a JSON frame; it is the thing `signing-in.md` refused by name |
| c | the sidecar reads the keychain itself | a second binary with keychain access, and a second macOS authorization surface for the same data |
| d | the core brokers the secret to the sidecar on demand, sidecar makes the request | keeps adapters on Effect, but the secret is in the sidecar's address space and in reach of anything that logs a request |
| **b** | **the core holds the secret and issues the request** | **chosen** |

**(b)** repeats the one pattern this codebase already proved, and makes the hardest acceptance
line of REM-406 — a secret reachable only by what needs it — true by construction rather than by
discipline. Its cost is real and accepted: **a provider adapter is Rust, not Effect.** This
contradicts REM-405 as written ("менеджер и адаптеры — в sidecar; логика на Effect"), and the
ticket is to be corrected rather than the design bent around it.

### Connection metadata lives in `settings.json`, secrets in the keychain

Metadata is app-level, not per project, and the app already has an app-level store. A new
`integrations` key in `settings.json` holds, per connection: its id, provider, the name the
person gave it, the account label the check returned, the capabilities the check confirmed,
whether it is disabled, and a reference to its keychain entry. Nothing else.

`settings.json` is plain text on disk, so what goes in it is exactly what the person would accept
seeing there. An account label may be an email address or a workspace name — that is metadata and
it stays; a token, a key, a refresh token or a client secret never is.

Each connection gets **its own keychain entry**, not one entry holding a blob. A blob would mean
reading and rewriting every secret to change one. The cost is paid in development: macOS ties
keychain access to the binary that wrote the item and every `cargo build` produces a new one, so
an unsigned debug build raises the system's own prompt **once per entry** after a rebuild, where
today it raises one. A signed release build asks once. Nothing in the app can suppress it and
nothing should.

### A reverse request frame, so a turn can act through a connection

The sidecar gains the ability to ask the core, and only for this. `SidecarFrame` takes a
`request` member carrying an id, a method and params; `HostFrame` takes a `result` member
carrying that id and either an answer or a worded failure. `SIDECAR_PROTOCOL` goes 30 → 31 and
`PROTOCOL` in `src-tauri/src/ipc.rs` with it; `shared/protocol.test.ts` already fails when the two
disagree.

Alternative rejected: a second unix socket from the core, mirroring what `sidecar/tools/gateway.ts`
does for its MCP children. It avoids the protocol change but leaves two different ways for the
same two processes to talk, and the frame loop already has the id correlation, the cancel
semantics and the decode-or-drop rule that a new socket would have to grow.

**The deadlock this can cause, and the rule that prevents it:** the core must never be inside a
blocking wait on a sidecar answer while the sidecar is waiting on a core answer. The core answers
a reverse request on a task of its own, independent of whatever webview request it is currently
servicing. A reverse request that is never answered fails the tool with a sentence; it does not
hold the turn.

The channel is not shipped without a user. `integrations/connection-lifecycle` requires that a
turn can ask which connections it may use — that read is the first traffic over it and is what
its tests exercise.

### No MCP transport, and no bridge

A connection is REST. The studio neither brokers a third-party MCP server nor displays one.

The measurement above is the reason: a person's own MCP servers already arrive at a Claude and a
Codex turn without the studio doing anything. Brokering them would add no reach — only a
permission problem, because `sidecar/claude/permission.ts:57` allows a tool silently when its
name begins with one of the three `mcp__remocn-*__` prefixes and raises a card for everything
else. A drawing session against an external design tool is dozens of calls, so the honest
behaviours are a card per call, which is unusable, or a blanket trust, which REM-404 forbids for
anything that acts outward.

Instead the agent reaches a service through the studio's own tool servers, where the studio owns
the tool name and therefore the policy. A consequence worth stating: user-configured MCP servers
keep arriving and keep raising a card per call. This change neither improves that nor makes it
worse, and does not claim to manage it.

### Browser authorization listens on loopback, not on the deep link

Where a provider authorizes in a browser, the core opens the person's browser and listens on a
loopback port for the answer. The existing `remocn-studio://` deep link (`shared/deep-link.ts`,
the `app://deep-link` event) was considered and rejected: a custom scheme has to be registered
with each provider as a redirect target, any application on the Mac can claim the scheme, and the
link would arrive through a path built for opening templates, with template parsing in front of
it. A loopback redirect is what the providers named in REM-404 document for a desktop
application.

An attempt carries whatever proof of origin its provider requires and is bound to the connection
it was started for. An answer whose state does not match the attempt in progress is dropped
rather than applied — that is what keeps a second attempt from completing the first.

### Failure directions

- A check that fails, a service that cannot be reached, a credential that expired → the
  connection changes state and says why. Nothing else in the studio is affected.
- The keychain refusing to write → no connection is created, and the failure is shown where the
  person is working. Never a row that looks saved.
- The reverse channel not answering → the tool fails with a sentence; the turn continues.
- An outward tool denied or unanswered → nothing reaches the service, and the agent is told the
  person declined.
- A secret in a log, a frame or a transcript → this is the one failure that must never happen
  quietly; it is prevented by the secret never leaving the core, not by redaction.

## Risks / Trade-offs

- **A new provider is Rust work, not Effect work** → accepted, and the reason is recorded above.
  What a provider contributes is small and fixed: how it authorizes, how it checks itself, what
  capabilities it implements.
- **The core grows a general answering path** → the reverse channel carries the integration
  methods only; anything else added to it later is a decision of its own, not a precedent set
  here.
- **More keychain prompts in an unsigned development build** → one per connection after a
  rebuild. Documented in CLAUDE.md rather than worked around.
- **`settings.json` grows account labels in plain text** → stated above as the boundary between
  metadata and secret; a person who does not want a label on disk can name the connection
  themselves.
- **Removing Stock media leaves everyone on one shared Remocn key** → deliberate, and the
  `library/stock-search` delta words it so the stock pane no longer sends anyone to Settings.
  Should that key be rate-limited for everyone at once, the answer is a Pexels connection in this
  framework, which this change does not build.

## Migration Plan

- No history migration; nothing is added to the SQLite schema.
- The protocol bump is carried by the existing compare: a core and a sidecar that disagree
  already refuse each other and say so.
- A `stock.json` written by an earlier version is ignored rather than deleted or migrated, as the
  `library/stock-search` delta states. Nothing reads it after this change.
- Rollback is the previous build: the keychain entries it does not know about are left in place
  and inert, and `settings.json`'s `integrations` key is ignored by a version that does not read
  it.

## Open Questions

- Which vertical lands first on top of this — ElevenLabs (REM-411), Figma (REM-260) or YouTube
  (REM-408). It changes nothing here: the first two exercise an API key, the third the browser
  trip, and all three are already specified as adapters.
