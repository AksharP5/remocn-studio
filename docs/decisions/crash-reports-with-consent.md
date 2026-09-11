# Crash reports, with consent

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`shell/crash-reporting`](../../openspec/specs/shell/crash-reporting/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The crashes nobody writes in about — a Rust panic, an unhandled rejection in the
sidecar, a React render that throws — reach Sentry, and only ever with the
person's word for it (REM-268). Expected failures are untouched: a
`Data.TaggedError` that renders as a sentence in the UI is not a crash and is
never reported.

- **Three conditions, one function, and consent is first.** `crashDecision` in
  `shared/crash.ts` answers `started` or a reason — `no-consent`, `development`,
  `no-dsn` — and all three processes ask it. Consent is checked before anything
  else so a refusal is never reported as something else, and **a missing DSN
  reads exactly like a withheld consent**: there is one way for the SDK to be
  absent, not two.
- **Opt-in, and the SDK is not initialised without it** — not
  initialised-and-silent. `crashReports` in `settings.json`, off until the
  switch in Settings › Behavior is turned on. That is #218's "nothing reaches a
  third party" applied to the one feature that exists to send something.
- **`shared/crash.ts` is the whole contract, and it is dependency-free.** The
  consent words, the release name, and the scrubber — no Effect, no SDK types,
  because it is called from inside a `beforeSend` running while a process dies.
- **A path is the PII that is in *every* event** — every frame, every module
  name — so it is rewritten rather than opted out of. Two rules: the real home
  when the process knows it (the sidecar does, the webview does not), and
  `/Users/<name>` / `/home/<name>` wherever they appear. What is deliberately
  *absent* is replacing the bare username: a username is an ordinary word, and a
  blanket replacement would rewrite sentences that are not paths at all.
- **The SDK defaults are the danger, not the sending.** Both SDKs are started
  with a hand-picked integration list, because `@sentry/bun`'s default set
  carries `contextLinesIntegration` — which attaches the source lines around
  every frame, i.e. the contents of the person's project — and
  `consoleIntegration`, which turns every log line into a breadcrumb.
  `nodeContextIntegration` and `modulesIntegration` describe the machine.
  Breadcrumbs are off entirely in v1 (`beforeBreadcrumb` returns null and
  `maxBreadcrumbs` is 0), which is #268's open question 3 answered the
  conservative way.
- **`includeServerName: false`, and it is load-bearing.** `_init` in
  `@sentry/bun` fills `serverName` from `os.hostname()` before any option is
  read, and a personal Mac's hostname is its owner's name; the client discards
  it only when this is false. The Rust side has the same trap by a different
  route — `sentry-contexts`, a default feature of the crate, sets `server_name`
  when it is `None` — so `crash.rs` sets it rather than leaving it to be filled
  in.
- **Client reports are off, and that cost a measured bug.** Withdrawing consent
  mid-session correctly dropped the event in `beforeSend` — and then Sentry sent
  a `client_report` saying *"1 error discarded, reason before_send"*. The event
  was gone but the request was not. `sendClientReports: false` is what makes
  "off" mean no outbound request at all.
- **Consent reaches the sidecar twice, and the two are not redundant.** Rust
  reads `settings.json` itself at spawn and passes the answer in
  `REMOCN_STUDIO_CRASH_REPORTS`, so a crash in the sidecar's first seconds — before
  any webview has connected — is still reported when it was consented to; the
  `crash.consent` method is the live half, so turning the switch off bites now
  rather than at the next launch. The sidecar also needs
  `REMOCN_STUDIO_ENVIRONMENT` and `REMOCN_STUDIO_VERSION` from the core: in a
  release it is one bundled `main.js` with no package.json beside it, and in
  debug it runs from the repo, where a DSN in `.env` would otherwise make a
  developer's own tree report as production.
- **One call covers all three bun processes.** `startCrashReporting` runs ahead
  of the entry-point switch in `sidecar/index.ts`, so `--preview-host` and
  `--tools-host` are covered by the same line — they are the same bundle with the
  same environment.
- **The SDK is loaded, not imported** (REM-315). A static `import "@sentry/bun"` was
  evaluated on every boot of all three processes before consent was read, and when
  the module could not be resolved — an interrupted `bun install` was the trigger —
  every one of them exited 1: four restart attempts, then `down`, no history, no
  preview, no agent, for a feature that was switched off. `applyCrashConsent` now
  takes a loader and calls it only once consent, the build and the DSN all agree;
  a load that fails is one more reason, `no-sdk` with the message, never a failed
  boot. The DSN constraint was never about the import — `bun build --env` only
  substitutes a static `process.env.X` read, and a dynamic `import()` bundles the
  same (one `main.js`, no chunk). `onUncaughtExceptionIntegration` runs with
  `exitEvenIfOtherHandlersAreRegistered: false`, because `abortQuietly` in
  `sidecar/agent/abort.ts` handles one exception by design and the default would
  exit on it anyway, on exactly the builds that report.
- **`bun build --env` takes exactly one glob, and drops the rest in silence.**
  Measured: a second `--env` flag replaces the first, and a comma-separated list
  honours only its first entry. So the sidecar's build glob is
  `REMOCN_STUDIO_*` rather than two patterns, which is safe because `--env` only
  substitutes *static* `process.env.X` — every runtime variable in the sidecar
  is read through a constant, i.e. by bracket access, and is untouched. The DSN
  is therefore read as a literal `process.env.REMOCN_STUDIO_SENTRY_DSN`, exactly
  as `stock.ts` reads the Pexels key.
- **There is no `tauri-plugin-sentry`, and dropping it is what made the design
  simple.** Its job is to give the webview a transport through Rust; this
  webview talks to Sentry itself, so the plugin would have added a JS injection
  we do not want, a breadcrumb collector we turn off anyway, and a minidump
  child process into an app that is careful about its process group. #268
  assumed the plugin for the sake of one DSN and one release across three
  layers — the shared `crashRelease(version)` gives both without it. What is
  left is the plain `sentry` crate for panics.
- **The Rust half is behind a Cargo feature (`crash-reports`), off by default
  and switched on by the release job's `args`.** Off in `Cargo.toml` so a local
  `cargo build` compiles neither `sentry` nor its transport; on for the build
  that ships. The flag leads the argument list, because `--features` takes a
  list and `--target` is what ends it — anything appended after ours would be
  read as another feature name. No workflow in this repo compiles the Rust
  except that release job, so `cargo check --features crash-reports` on a Mac
  is what stands in for a CI gate.
- **`ClientOptions` is `#[non_exhaustive]`**, so it is built by assignment
  rather than a struct literal — `..Default::default()` buys no exemption from
  that outside the declaring crate. `before_send` also needs
  `Event<'static>` spelled out, because the type carries a lifetime and an
  elided one is a fresh variable to unify rather than the one the callback is
  typed on.
- **The Rust half was measured against the same sink, in isolation from Tauri.**
  `sentry` does not depend on Tauri, so the two functions were compiled and run
  in a throwaway crate carrying this exact feature set, in a release profile
  with the DSN baked by `option_env!`. A panic arrives as `level: fatal`,
  `release: v0.4.1`, `environment: production`, with the home directory
  rewritten to `<home>` and the ordinary words of the message intact;
  `note_sidecar_crash` arrives as its own message event; `server_name` is the
  constant rather than the hostname, the contexts are architecture and OS only,
  and there are no breadcrumbs. The one thing that isolation could not answer —
  the crate compiling beside `tauri` on macOS — was then confirmed by
  `cargo check --features crash-reports` on a Mac.
- **The sourcemap step is a line of `tauri:before-build`, and it has to be.**
  Sentry matches a minified frame by a debug id written into the built
  JavaScript, so the inject must be the last thing that touches those bytes —
  and `tauri-action` offers no hook between its `beforeBuildCommand` and the
  bundling that copies them into the `.app`. `scripts/sourcemaps.ts` uploads
  only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` and the DSN are
  all set, and **always** deletes `out/**/*.map`: the static export *is* the app
  bundle, so a map left there would ship the studio's own sources in every
  release. Verified: 25 maps emitted with a DSN set, 25 removed before
  packaging. `sidecar:build` moved from `--outfile` to `--outdir` because bun
  requires it for an external map, and bun already writes its own `//# debugId=`
  line, so the sidecar needs no inject at all.
- **`bun run crash:verify` is how this was measured without a Sentry account.**
  A DSN is only a URL, so `scripts/crash-sink.ts` stands a local HTTP server in
  Sentry's place and runs the real SDK against it across seven scenarios —
  consent given, withheld, never answered, a development build, a build with no
  DSN, and consent flipped both ways mid-process — asserting on the raw
  envelope that the home directory is absent, that `<home>` is present, that
  ordinary words survived, and that no hostname, breadcrumb trail or source
  context is attached. What it cannot answer is server-side and is what an
  account is still needed for: whether a minified frame symbolicates against an
  uploaded map, and whether the three layers group under one release.
- **The cost, measured**: the sidecar bundle goes 2.50 MB → 3.01 MB (+510 KB).
