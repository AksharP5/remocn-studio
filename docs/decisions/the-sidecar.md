# The sidecar

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`sidecar/supervision`](../../openspec/specs/sidecar/supervision/spec.md), [`sidecar/ipc-contract`](../../openspec/specs/sidecar/ipc-contract/spec.md), [`agent/permissions`](../../openspec/specs/agent/permissions/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


One bun process, owned by the Rust core, supervised in `src-tauri/src/sidecar/`.
The webview never talks to it directly: it goes through Tauri commands
(`sidecar_request` / `sidecar_cancel` / `sidecar_status` / `sidecar_restart`) and
gets streams back over `tauri::ipc::Channel` and status over a `sidecar://status`
event.

- **stdio, not a port.** Frames are newline-delimited JSON on stdin/stdout;
  **stderr is the log** and the core copies it, line by line, into
  `~/Library/Logs/com.remocn.remocn-studio/sidecar.log`. Anything the sidecar
  writes to stdout that is not a frame breaks the protocol, so use `log()`.
  Ports come later and per-service (the Vite preview reports its own).
- **`shared/ipc.ts` is the only contract**, written as Effect `Schema` and
  mirrored by serde in `src-tauri/src/ipc.rs`. `SIDECAR_METHODS` holds a schema
  per method for params, result and stream chunk; the TS types are derived from
  those with `["Type"]`, so `requestSidecar` and the handler map are typed from
  one place and every boundary is *decoded*, not cast. Bump `SIDECAR_PROTOCOL`
  when frames change — a mismatch is logged, not fatal — **and `PROTOCOL` in
  `src-tauri/src/ipc.rs` with it**: four bumps landed on one side only, so every
  launch logged a mismatch and a real one would have looked the same (REM-328).
  `shared/protocol.test.ts` reads the Rust file and fails when the two differ.
  - The wire discriminator is `type`, not Schema's default `_tag`, so the frames
    are `Schema.Union`s of `Schema.Struct`s with a `Schema.Literal` tag. Keep it
    that way: the Rust `#[serde(tag = "type")]` mirror depends on it.
  - Decoders are `Exit`-based and hoisted to module scope. `Exit` *is* an
    `Effect` in v4, so the same decoder works inside `Effect.flatMap` and in a
    synchronous Tauri `Channel` callback — where decoding must stay sync, or
    forked fibers would reorder stream chunks.
  - The request envelope keeps `method` as a plain string and `dispatch` decodes
    it separately. If the envelope rejected unknown methods, a bad method would
    be dropped as unparseable and the caller would wait forever instead of
    getting `there is no method called …`.
- **A turn carries more than a prompt.** `agent.prompt` takes the reasoning
  `effort` and image `attachments`, and answers with the context-window reading
  next to the session id. Two decisions there are deliberate: attachments travel
  as **paths**, and `sidecar/claude/content.ts` reads and base64-encodes them, so
  megabytes of image never cross the Tauri IPC or the stdio frames; and the
  context reading is taken from the live `Query` with `getContextUsage()` **before
  the turn closes it**, because afterwards there is no session left to ask. It is
  wrapped in a timeout and ignored on failure — a missing reading hides the meter,
  it never fails the turn. Where the images sit in that turn is the *prompt's*
  decision now — see *Pasting a picture, and pointing at it*.
- **Permissions are a `canUseTool` gate *and* a permission mode.** The gate is the
  constant: `review()` in `sidecar/claude/permission.ts` resolves each path field —
  symlinks and `..` included, walking up to the nearest existing ancestor so a file
  that is about to be created still resolves — and auto-allows the file tools when
  everything lands inside `params.cwd`. Bash always asks; so does a tool with no
  path rule. What the *mode* changes is how much traffic ever reaches it, because
  the SDK routes a call to `canUseTool` only when the mode would otherwise prompt.
  - **The mode belongs to the session** and travels on `agent.prompt` as
    `permissionMode`. Three values, spelled the way the SDK spells them so there is
    no translation table: `auto` (the default), `acceptEdits`, `plan`.
    `bypassPermissions` and `dontAsk` are deliberately not offered — a mode that
    skips the gate has no story here.
  - **What `auto` costs.** Claude Code's classifier decides *before* `canUseTool`,
    so in `auto` a call the gate would have stopped — including a write resolving
    outside the opened folder — can be approved without the gate ever seeing it.
    The #223 invariant "anything outside the folder always asks" is therefore
    absolute in `acceptEdits` and `plan`, and best-effort in `auto`. That is the
    trade `auto` *is*; it is not an oversight. Its silent denials are not silent:
    `system`/`permission_denied` is folded into a `notice`, or a refused tool would
    show up as nothing but a failed activity line.
  - **A `PreToolUse` hook is what makes the invariant absolute, and without it the
    sentence above was a claim rather than a fact** (REM-327). That same classifier
    approves in `acceptEdits` and `plan` too, so the gate saw nothing: measured
    against the real CLI, `ls src/videos` in `acceptEdits` produced a tool row and
    no card at all. `canUseTool` is not a gate on its own — the SDK says so itself,
    warning `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` and naming a `PreToolUse` hook as the
    remedy, because that hook runs for *every* call ahead of the classifier.
    `gateHooks` in `sidecar/claude/guard.ts` installs one that runs the same
    `review()` and answers `permissionDecision: "ask"` for exactly the calls that
    want a card — which routes them into the *existing* `canUseTool`, so the emit,
    the gate, the queue and the card are untouched. Two things about it are
    deliberate: it is installed **only in `acceptEdits` and `plan`**, because a hook
    in `auto` would quietly turn `auto` into `acceptEdits`; and an `allow` verdict
    returns no decision at all rather than `"allow"`, so Claude Code's own deny
    rules still apply to everything the studio does not object to.
  - **The CLI is asked what it actually did.** `system`/`init` reports the
    `permissionMode` in force; it rides on the `session` event, and a mismatch with
    what was requested adds a `notice`. The chip must never claim a mode the turn
    did not run in.
  - **Auto is not a mode every model has, and that is the mismatch people actually
    hit.** Claude Code takes `permissionMode: "auto"` from a model that cannot run
    it and reports `default` back — silently, apart from that notice, which then
    reads as a fault in the studio. Measured one probe per model against the real
    CLI: Fable 5.1, Fable 5, Opus 5 and Sonnet 5 all run Auto; **Haiku 4.5 comes
    back `default`**. `lib/studio/models.ts` holds that measurement, and both ends
    read the one copy: the notice names the model rather than only the modes, and
    `runningMode` gives the composer the mode the turn will *really* run in, so the
    chip reads `Default` with the reason on its tooltip and the menu's Auto row is
    disabled. What does **not** change is the session: it keeps the mode the person
    picked, so moving back to a model with Auto restores it without them choosing
    again. `default` is deliberately not a mode the studio offers — it is only ever
    something to report.
  - **Plan mode ends in a card, not a message.** `ExitPlanMode` reaches the gate
    like any other tool and gets its own reason, `plan`, with the plan markdown in
    the tool input. Approving carries the mode to continue in, and the sidecar
    applies it to the live `Query` with `setPermissionMode` — so the same turn
    starts building — then persists it and re-emits the `history` chunk, which the
    webview already folds into the session row. Denying is "keep planning" and says
    so to the agent, rather than the standard refusal.
  - **The ask is a stream chunk of the turn** (`AgentEvent` `permission`), not a
    notification, so it belongs to the turn that raised it and dies with it. The
    answer is a *separate* `agent.permission` request, which works because
    `dispatch` forks each request into a `FiberMap` rather than serving them in
    order.
  - The card renders **above the composer, not in the transcript** — an approval
    is a thing to answer, not a thing that happened. `useClaudeTurn` keeps the
    asks in a queue and hands out the head, because one assistant message can
    raise several tool calls at once. The composer is locked while one is up, and
    answering removes it: what the tool then did is already the activity line's
    job to say.
  - The gate is a module singleton in `sidecar/handlers.ts`; `makeGate()` exists so
    tests get their own. It holds a `Deferred` per pending ask and a `Set` of
    remembered signatures — session-scoped by being process-scoped, never written
    to disk.
  - **Cards settle before the interrupt is awaited.** `stoppable()` calls
    `onStop` — `gate.abandon(turnId)`, synchronously — *before*
    `session.interrupt()`, because that call can only be answered by a CLI that is
    not blocked on a permission prompt. `Effect.onExit` around the stream repeats
    the abandon for every other way a turn can end.
- **The app ships its own bun, and #218's "do not bundle a runtime" is reversed**
  (REM-296). The measured price of not bundling was *the app does not start*: no
  bun means no sidecar, and the environment checklist that would have explained
  it is drawn by the sidecar. So bun rides as a Tauri `externalBin`
  (`binaries/bun-<triple>`, 58 MB per architecture), which lands in
  `Contents/MacOS/bun` beside the app binary. The resolve order in `spawn.rs` is
  `$REMOCN_STUDIO_BUN` → **the shipped binary** → `~/.bun/bin`, `$PATH`, the usual
  Homebrew/`/usr/local` locations. The env override stays *first* on purpose: an
  override that the shipped copy always beat would not be one. A GUI-launched app
  gets a minimal `PATH`, which is why the fallback list survives.
  - **The binaries are fetched, not committed.** `bun run bun:fetch`
    (`scripts/fetch-bun.ts`) downloads the release matching `packageManager` in
    `package.json` — one version, one place — into the gitignored
    `src-tauri/binaries/`, and re-running it is a no-op once the binary reports
    that version. `tauri:before-build` runs it first, so CI needs no step of its
    own; the fetch honours `TAURI_ENV_TARGET_TRIPLE` and takes only the
    architecture being built, falling back to both when it is not set.
  - **The checklist row for bun is gone**, because the runtime is now always
    there. What took its place answers a different question — see *A project
    installs with its own package manager*.
  - bun is MIT, so redistributing the binary is free of conditions. Signing
    (REM-413, 2026-09-14) treats `Contents/MacOS/bun` as one more nested binary,
    with one thing to know: Oven ships it already signed with the hardened
    runtime and five entitlements (`allow-jit`,
    `allow-unsigned-executable-memory`, `disable-executable-page-protection`,
    `allow-dyld-environment-variables`, `disable-library-validation`), and
    tauri-bundler re-signs every `externalBin` with `codesign --force` and *our*
    entitlements file. Without those five in `src-tauri/Entitlements.plist` the
    re-sign would strip JavaScriptCore's JIT rights and the sidecar would not
    start; with them, `codesign -d --entitlements -` on the bundled bun shows the
    same five under our identity, and notarization accepts them — they are the
    standard hardened-runtime exceptions.
- **Where the script comes from differs by profile**: debug resolves
  `../sidecar/index.ts` from `CARGO_MANIFEST_DIR` (edit and restart, no build
  step), release resolves the bundled `sidecar/main.js` from the resource dir.
  The release bundle is **minified with no sourcemap** — bundling Effect makes
  the map 4.16 MB of mostly third-party sources, and dev already runs from
  source where traces are exact. 2.5 MB shipped today — Effect, the preview
  machinery and the MCP SDK behind the stdio tool hosts — against 26 KB
  before Effect.
- **Inside the sidecar, everything is Effect.** `SidecarChannel` is a
  `Context.Service` over stdio (`sidecar/channel.ts`), so tests provide a
  `PassThrough` instead of the process. In-flight requests live in a `FiberMap`
  keyed by request id: `cancel` is `FiberMap.remove` (a fiber interrupt) and
  stdin EOF closes the scope, which interrupts every request at once. Each
  request replies exactly once from an `Effect.onExit` finalizer, so a cancelled
  or crashed handler still answers — a plain `SIGTERM` now gets a `cancelled`
  frame out before the process exits. There is no `AbortController` anywhere:
  `Effect.sleep` is interruptible on its own.
- **Nothing is orphaned.** The child is spawned into its own process group, so
  quitting signals the whole group — enough to take down `claude` and Vite later.
  Belt and braces on the child's side: the sidecar exits when stdin hits EOF (the
  parent's pipe closes even on `SIGKILL`) and polls `REMOCN_STUDIO_HOST_PID`
  every 2s.
- **Crashes restart, with a visible gap.** Four attempts with exponential
  backoff; every in-flight request is failed with the reason rather than left
  hanging, and after four the phase is `down` until someone hits Restart.
  A request made while the sidecar is still starting waits for `ready` (20s cap)
  instead of failing.
- Fonts come from `next/font/google` (DM Sans → `--font-sans`, Geist Mono →
  `--font-geist-mono`) and are self-hosted into the export at build time. Note
  this means **`bun run build` needs network on a cold cache.**
