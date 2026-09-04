# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Rules

- **Never start a dev server.** `bun dev`, `next dev`, `bun tauri dev` and
  equivalents are the user's to run — he owns that terminal. One-shot commands
  that terminate (`bun run build`, `bun install`, `cargo check`) are fine. When a
  change needs runtime verification, verify what a build can verify, then say
  what must be checked in the running app and ask him to run it.

## What this is

A **local macOS desktop app** (Tauri v2) that turns "I want a video" into a real
Remotion project: Claude writes actual Remotion TSX into a folder on disk, and
the app previews the result live and exports an mp4. Design record and work list:
[Remocn/remocn#218](https://github.com/Remocn/remocn/issues/218) and its children
(#219–#228).

**This is not `studio.remocn.dev`.** That one — sketched in the remocn repo's
`RENDER_SDK.md` §13 — is a hosted, spec-driven web editor built on one generic
composition plus a JSON spine. Different product. Do not carry its timeline /
project-JSON design into this repo.

Shape of the prototype, as decided in #218:

- **Claude produces code, not spec.** Real TSX in the user's folder, like Claude
  Code + the remocn skill. So preview must compile source the app has never seen.
- **Open any folder.** The app controls neither the entry point, the Remotion
  version, nor the build config.
- **One composition per video,** and a project holds several. A video is a folder
  under `src/videos/<slug>/` whose `index.tsx` default-exports the component and
  exports its `meta`; the project's own `Root.tsx` registers every such folder by
  scanning. Scenes live inside a video via `Series` / `TransitionSeries`. #218's
  original "exactly one composition, id `Main`" is superseded — see *Project →
  video → chat*.
- **Claude access via `@anthropic-ai/claude-agent-sdk`** inside a bun sidecar,
  using the Pro/Max subscription of the already-logged-in Claude Code. No API
  key, no custom OAuth.
- **Three panes:** videos | chat | preview. Videos are rows and chats hang under
  them, with the project a switcher in the pane's header; turns keep running when
  you look away (#235 supersedes the original "sessions pane, exactly one active
  session").
- **Own SQLite history** — the CLI transcript format is not a public contract.
- **Permissions split:** file tools inside the opened folder run automatically;
  Bash and any path outside the folder raise an Allow/Deny card. How much of that
  is asked about is the session's **mode** — auto, accept edits or plan (#236).
- **Export goes through the *project's own* `@remotion/renderer`,** resolved from
  its `node_modules` — never a version the app bundles.

## Commands

The lockfile is `bun.lock`; use bun.

- `bun run check` — formatter **and** linter in one pass, read-only. This is what
  CI runs; it fails on violations rather than fixing them.
- `bun run fix` — apply the fixes `check` reports.
- `bun run typecheck` — `tsc --noEmit`. Keep this in the loop: Next 16 no longer
  lints on build, and it is the only gate over `components/ui/**`, where the
  linter is deliberately off.
- `bun run test` — Vitest, single run. `test:watch` and `test:coverage` also exist.
- `bun run build` — Next static export into `out/`. Needs network on a cold cache
  (fonts are self-hosted at build time).
- `bun run bun:fetch` — download the bun runtime the app ships into the
  gitignored `src-tauri/binaries/`, pinned to `packageManager` in `package.json`.
  Needs network the first time only; `tauri:before-build` runs it, so a normal
  `bun tauri build` needs nothing extra. See *The sidecar*.
- `bun run sidecar:build` — bundle `sidecar/` into `sidecar-dist/main.js`, which
  ships as a Tauri resource. **Only release builds need this** — in debug the
  core runs `sidecar/index.ts` from the repo, so there is nothing to rebuild.
  `bun tauri build` runs it via `tauri:before-build`.
- `bun tauri build` — unsigned `.app` bundle. `--no-bundle` compiles without
  packaging; `--bundles app` skips the DMG. Since `createUpdaterArtifacts` is on,
  it now also wants the updater's signing key: export
  `TAURI_SIGNING_PRIVATE_KEY_PATH`, or pass `--no-sign` to skip the `.sig` — a
  bundle built that way cannot be released, only run. See *Updating in place*.
- `bunx shadcn@latest add <component>` — add UI components (config in
  `components.json`).
- `bun run skills:sync` — refresh the vendored agent skills under `agent/skills`
  from upstream; `bun run skills:check` is the read-only half CI runs. Both need
  network. See *What the agent knows*.
- `bun run crash:verify` — stand a local server in Sentry's place and measure
  what crash reporting actually sends, across consent given, withheld and
  flipped mid-process. Needs no Sentry account. See *Crash reports, with
  consent*.
- `bun run changeset` — record a change for the next release (see Releases).

### Linting and formatting

[Ultracite](https://www.ultracite.ai/) over Biome; config in `biome.jsonc`,
which extends `ultracite/biome/{core,next,react}`. Two things about it are
load-bearing:

- **`repos/` is force-ignored** (`!!repos`). Without it `ultracite init` walks
  into the vendored checkouts — it reformatted 42 `tsconfig.json` files inside
  `repos/effect` on first run.
- **The linter is off for `components/ui/**` and `hooks/use-mobile.ts`**, which
  are `shadcn add` output we do not author and that any re-add overwrites; 90 of
  93 findings on first run were there. Formatting stays on. `recommended: false`
  does **not** work as a blanket in that override — the ultracite presets enable
  rules by name and they survive it. `typecheck` is the real net for that
  directory, and it earns its keep: the generator shipped duplicated
  `components={{…}}` in `calendar.tsx` and duplicated `render={…}` in
  `pagination.tsx`, both TS17001, and a duplicate JSX attribute silently discards
  the earlier one.

**Biome is pinned to 2.5.5 for one reason:** 2.5.3 and 2.5.4 panic in their
module resolver on any file that does `import { memo } from "react"`
(`index out of bounds: the len is 38 but the index is 287`), and a panic fails the
whole file instead of emitting a diagnostic. 2.5.5 in turn reads `!value` in
`useStudio` as always-truthy, which is why that guard is spelled `value === null`.
Two rules shape how components are written here: `noArrayIndexKey` means rendered
rows carry their own id (`DiffLine.id`), and `noJsxPropsBind` bans inline arrows
in props — a per-item handler reads `event.currentTarget.value` instead, which is
why `useAttachments` exposes `onRemove` as an event handler.

### Tests

Vitest + React Testing Library + jsdom (`vitest.config.mts`). The `@/*` alias
resolves natively via `resolve.tsconfigPaths` — do not add `vite-tsconfig-paths`,
Vite 7 warns that it is redundant.

**Three workers, isolated.** Vitest's default is every core but one, which on the
fanless MacBook the app is developed on is seven node processes and a load average
past thirty for the length of a run; `maxWorkers: 3` keeps it under four and costs
about 35 s for the whole suite. `isolate: false` would halve that and was measured
and rejected: `vi.mock` cannot reach a module an earlier file already evaluated in
a shared graph, so the five suites that mock a module silently ran against the
real one. **While iterating, run only the files you touched** —
`bun run test hooks/use-tours.test.tsx` — and the full suite once before a commit.
Never run `test:watch` beside a `vitest run`.

**jsdom is not a Tauri webview.** There is no `window.__TAURI_INTERNALS__`, so
any `invoke()` that reaches the real transport throws. Tests touching IPC must
install a fake with `mockIPC` from `@tauri-apps/api/mocks`; `vitest.setup.ts`
calls `clearMocks()` after each test so one test's fake cannot leak into the
next. `app/page.test.tsx` is the worked example.

## Releases

Version lives in **one** place: `package.json`. `src-tauri/tauri.conf.json` sets
`"version": "../package.json"`, which Tauri resolves at build time, so there is
no version sync step and `src-tauri/Cargo.toml`'s version never reaches the
bundle.

Changesets drives versioning and the changelog — not publishing; the package is
private, and `privatePackages: { version, tag }` in `.changeset/config.json` is
what makes it work on a private package at all.

1. `bun run changeset` to record what changed.
2. On push to `main`, `.github/workflows/publish.yml` opens/refreshes a
   "Version Packages" PR that bumps `package.json` and writes `CHANGELOG.md`.
3. Merging that PR is the decision to release. The push it produces finds an
   empty `.changeset/`, so the *same* workflow takes its publish branch instead:
   `changeset tag` names `v<version>`, the job pushes it, and the action reports
   `published`.
4. That output — not the tag — releases the macOS build (Apple silicon + Intel)
   in the same run, which publishes the GitHub release with the bundles and
   `latest.json` attached.

The version script is named `version:packages`, not `version`, because npm and
bun treat a `version` script as an `npm version` lifecycle hook, which recurses.

Two things about step 4 are the way they are because the obvious versions of them
do not work, and both cost a silent non-release of 0.0.1 to find:

- **The build cannot be triggered by the tag.** A tag pushed with `GITHUB_TOKEN`
  does not start a workflow run, so `on: push: tags` never fires for a tag this
  workflow created. Hence the gate on the `published` output and a build in the
  same run — and hence no tag trigger in the file at all, since one would read as
  the mechanism while never running.
- **`changesets/action` is pinned to `v1.9.0` and takes v1's input names** —
  `version`, `publish`, `commit`, `title`, `createGithubReleases`. The v2 line
  renamed all of them to kebab-case, an unknown `with:` key is silently ignored,
  and `@v1` is a *branch*, not a tag. So `version-script` / `commit-message` /
  `pr-title` / `create-github-releases` did nothing, `push-git-tags` is not read
  by v1 at all, and a missing `publish` meant the action logged "Not publishing
  because no publish script found" and returned. `version PR` went green in 16s
  and no tag was ever created.

`publish` is `changeset tag`, not an npm publish — the package is private. The
action greps its stdout for `New tag:` to decide `published`, and that command
prints nothing once the tag is on the remote, which is what stops a later push to
`main` from releasing the same version twice.

### Updating in place

`tauri-plugin-updater` against this repo's own releases; the endpoint is
`releases/latest/download/latest.json`, which GitHub resolves to the newest
release that is neither a draft nor a prerelease.

- **The updater signature is not optional.** `pubkey` is a plain required `String`
  in the plugin's config — there is no unsigned mode to choose. It is a minisign
  key from `tauri signer generate` and has nothing to do with Apple code signing,
  which this app still does not do: the private half is the
  `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository
  secrets, and the CLI refuses to build when the configured pubkey has no private
  counterpart — or when the two do not match.
- **Step 4 stopped drafting because of this.** A draft's assets have no reachable
  download URL, so a drafted release can serve neither the manifest nor the
  `.app.tar.gz` it points at. Publishing on tag push is what makes the feature
  possible at all, not a change of taste.
- **`development` and `production` are different builds, and only one updates.**
  `studio_build` answers `{ environment, version }` off `cfg!(debug_assertions)`
  — the same signal `sidecar/spawn.rs` reads to decide where the sidecar script
  comes from — and `useUpdates` checks nothing at all in `development`. That is
  not politeness: in dev the executable is `target/debug/remocn-studio` rather
  than something inside a `.app`, and the plugin works out what to replace by
  climbing to `Contents/MacOS` from the current exe, so a check there fails on a
  path lookup and never reaches the network.
- **The two macOS jobs run one at a time.** `latest.json` carries a key per
  platform and tauri-action builds it by fetching the asset already on the release
  and merging its own entry in. Run in parallel, both fetch before either writes,
  and the loser's architecture silently vanishes from the manifest — an update
  that 404s for half the machines. `max-parallel: 1` is what makes the merge a
  merge, and it is the whole reason the matrix is serial.
- **Restarting is ours.** `Update::install` replaces the bundle and returns; it
  does not relaunch. `restart_studio` mirrors `quit_studio` in calling
  `confirm_quit()` first — otherwise the quit guard prevents `ExitRequested` — and
  additionally shuts the sidecar down by hand, because `AppHandle::restart` spawns
  the replacement and calls `exit(0)` itself, so the event loop never reaches the
  `RunEvent::Exit` where `Sidecar::shutdown` normally runs. `shutdown` guards on
  an atomic, so saying it twice costs nothing.
- **A missing build reading is not an error.** It means there is no core to ask —
  `bun dev` opened in a browser — and the row reads "Waiting for the Tauri core"
  instead of a transport message. A failed *check* does surface, inside the
  popover only, because a background poll must not put a banner on screen.
- **Progress is folded, not reported.** The plugin streams `Started` / `Progress`
  / `Finished` and each progress event carries only its own chunk length, so
  `advance` in `lib/studio/updates.ts` accumulates them into `{ received, total }`
  and is a pure function with its own tests. `Finished` settles `received` on
  `total`, or a bar whose last chunk was rounded away would stop at 99%.

### Crash reports, with consent

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

## Architecture

### Frontend is Next.js in **static export mode**

`next.config.mjs` sets `output: "export"`. Tauri serves `devUrl`
(`http://localhost:3000`) in dev and the `out/` bundle over a custom protocol in
production — **there is no Node server at runtime**. Therefore:

- No SSR-dependent features: no server actions, no `cookies()`, no route
  handlers that read the request, no `redirects`/`rewrites`/`headers`, no proxy,
  no ISR, no default-loader image optimization (`images.unoptimized` is set).
- Anything that needs a real runtime goes to **Rust (Tauri commands)** or to the
  **bun sidecar**, never to a Next.js server.
- `components.json` has `"rsc": false` so generated components carry
  `"use client"` — the editor is interactive top to bottom.
- `turbopack.root` is pinned in `next.config.mjs`: an unrelated `package-lock.json`
  sits above this repo and Turbopack's root inference walks up to it otherwise.

### The first second

The main Tauri window starts hidden and the static export already contains the
in-window splash. A `beforeInteractive` script asks the Rust core to reveal the
window on the second frame after `DOMContentLoaded`; a 1.5-second Rust fallback
shows it even if the page fails before making that request. The native window
background is `#111111`, the sRGB result of the dark `--sidebar` mix, so live
resize cannot expose the system's light window colour.

The splash covers two independent startup waits: settings hydration and the
first `project.list` result. The latter takes roughly 0.7–1.0 seconds because
the sidecar itself reaches `ready` about 0.6 seconds after spawn; before this
guard, that empty initial project array briefly rendered onboarding for a
returning person. The splash stays for at least 1.5 seconds so its draw lands
and holds long enough to be seen,
then dissolves once both waits settle. A six-second cap reveals the shell and
its sidecar status instead of letting a failed sidecar hold the window hostage.

Keep the splash in the page's static HTML. Moving it behind hydration restores
the empty first paint; moving it to a second Tauri window turns the one dissolve
into a jump cut.

### UI

- **Primitives are `@base-ui/react`, NOT Radix.** The shadcn style is
  `base-vega`; every `components/ui/*` file imports from `@base-ui/react/*`.
  Prop names and composition patterns differ from Radix — check the actual
  primitive import before editing a component. The style moved from `base-luma`
  to `base-vega` when the tree was regenerated: buttons went from `rounded-4xl`
  pills to `rounded-md`, and radii now come from `min(var(--radius-md), …)` per
  size. **A re-add rewrites all ~70 files at once**, so run `bun run fix` right
  after — the registry emits its own formatting and `check` fails on every file
  until it is normalised.
- **Tailwind v4, CSS-first.** No `tailwind.config.*`. Theme lives in
  `app/globals.css` via `@theme inline` and CSS variables (`:root` / `.dark`),
  colors in `oklch()`, radius scale derived from `--radius`. Tokens are copied
  from remocn.dev — the `.dark` set is the warm obsidian palette (`#141318`).
- `app/globals.css` imports `shadcn/tailwind.css`, which supplies the `data-open`
  / `data-checked` / … custom variants the base-vega components compile against.
  Do not drop that import.
- **Dark-first**, and deliberately not following the OS: `components/theme-provider.tsx`
  sets `defaultTheme="dark"`, `enableSystem={false}`.
- **Assistant markdown is [Streamdown](https://streamdown.ai)**, not `react-markdown`.
  Two lines in `app/globals.css` are load-bearing: `@import "streamdown/styles.css"`
  (the `animated` reveal keyframes) and `@source "../node_modules/streamdown/dist/*.js"`
  — Streamdown ships Tailwind utility classes inside its compiled JS, so without
  that the markdown renders unstyled. It expects the shadcn tokens, which the
  base-vega palette already supplies.
- **Syntax highlighting is our own Shiki plugin**, `lib/studio/highlighter.ts`,
  built on `createHighlighterCore` with a fixed language set (tsx, ts, jsx, js,
  json, bash, css) and the JS regex engine, so no `onig.wasm` has to load over
  the custom protocol. `@streamdown/code` is deliberately not installed: it calls
  `createHighlighter` with `bundledLanguages` and its options expose themes only,
  so the 9.1 MB it adds cannot be configured away. `CodeHighlighterPlugin` is a
  public interface and `plugins.code.getThemes()` wins over the `shikiTheme` prop.
  The langs and themes are dynamic imports, so they are separate chunks, not part
  of the initial bundle.
- `cn()` in `lib/utils.ts` (clsx + tailwind-merge) composes all classNames.
- Path alias `@/*` maps to the repo root. Bun honours it too, so `sidecar/` code
  imports `@/shared/ipc` the same way the webview does.

### Effect

Effect is how effects are expressed here — not an option to justify per case.
`effect@4.0.0-beta.101`; read `agent-patterns/effect-schema.md` before any Schema
code, because v4 rewrote Schema and v3 knowledge is wrong rather than stale.

- **`lib/**` returns `Effect`, hooks run it.** Every effectful function fails with
  a `Data.TaggedError` (`SidecarError`, `ShellError`, `ChannelError`,
  `HandlerError`), built in the `catch` of `Effect.tryPromise`. Never let a bare
  `UnknownException` reach a hook: `Effect.runPromise` then rejects with a
  `FiberFailure` whose message hides the real text, and for the sidecar that text
  *is* the feature — "the sidecar is not running" has to reach the UI.
- **Hooks surface failures as values.** `useAsyncAction` runs
  `Effect.runPromiseExit` and renders `causeMessage(exit.cause)`;
  `Cause.hasInterruptsOnly` returns `null` there, so a deliberate cancel is not
  an error.
- **Cancellation is interruption.** `useSidecarEmitter` keeps a `Fiber`, not a
  request id, and `Effect.onInterrupt` sends the cancel frame. Subscriptions are
  `Effect.acquireRelease` inside `Effect.scoped`, forked once and interrupted on
  unmount, so the unlisten is structural rather than bookkeeping.
- **Effect v4 names that differ from muscle memory**: `Effect.callback` (not
  `async`), `Effect.result` (not `either`), `Effect.catch` (not `catchAll`),
  `Schema.decodeUnknownEffect`/`Exit` (not `decodeUnknown`).
- **The one place not to modernise** is `useHydratedSettings`. `lib/studio/settings.ts`
  memoises the store handle with `Effect.cached`, and interrupting *any* caller of a
  cached effect caches the interrupt exit, so every later caller fails forever. That
  hook drops late results with a closure flag on purpose; a fiber interrupt there
  hangs the boot screen in `next dev` only, because of StrictMode's double mount.

### The agent seam

The turn machinery is provider-neutral (REM-251, phase 1): `handlers.ts` talks to
an **`AgentAdapter`** — `{ info, account, turn }` in `sidecar/agent/adapter.ts` —
and `sidecar/claude/` is the first adapter. What stays neutral lives in
`sidecar/agent/` (the permission gate's Effect skeleton, the mode switch, the
per-provider account cache, the registry); what speaks SDK stays in
`sidecar/claude/` (the `CanUseTool` guard, the event translation, the failure
classifier, the auth probe).

- **`shared/providers.ts` is the provider contract**: `AGENT_PROVIDERS`, the
  `AgentCapabilities` shape (`context`, `effort`, `modes`, `planTool`, `resume`,
  `thinking`) and the static `PROVIDER_INFO` table. The table is static on
  purpose — the webview and the sidecar ship in one bundle, so it cannot drift
  from the adapters the registry carries, and the composer's chips need no
  loading state. **Capabilities, not `if provider`**: the Mode and Effort chips
  render only when the provider claims them; context meter, thinking marker and
  plan checklist already degrade to nothing when their events never arrive.
- **The provider is a property of the session** — a column (migration 5, default
  `claude`), a field on `HistorySession` and on `agent.prompt`'s params (decoding
  default `claude`, so a session row or a stored turn written before the field
  existed still decodes). The webview
  reads it back into `TurnState` exactly as it does `sdkSessionId`, and only the
  session's own provider failing its login check locks the composer
  (`isBlocked(checks, provider)` — the account row's id *is* the provider id).
- **The tool dictionary crosses the wire as a verb.** A `tool_use` event and its
  stored activity entry carry `verb` — the adapter's translation of its own tool
  name into the neutral vocabulary (`read`/`edit`/`create`/`run`/`search`/`find`/
  `web`/`plan`/`task`/`subagent`) that `activity-icon.tsx` keys on, with the old
  name map behind it for rows stored before verbs existed and names no adapter
  translates. Detail rendering (`lib/studio/activity.ts`) and the task-checklist
  parser still read Claude's names; they move behind the seam when adapter #2
  needs them to.
- **The studio's tools are stdio-MCP servers any CLI can spawn** (phase 2 of
  REM-251). `sidecar/tools/` holds the whole seam: `specs.ts` declares the
  tools (names, wording, zod shapes — the contract with the agent, moved
  verbatim from the old in-process servers), `execute.ts` runs them, and the
  split between the two processes is the point: the *state* a tool touches —
  the SQLite stages, the turn's stream, the preview stills a `save_asset`
  renders — lives only in the sidecar, so the child the CLI spawns
  (`sidecar/index.ts --tools-host <server>`, the same re-exec the preview host
  uses) owns nothing and forwards every call over a unix socket to
  `gateway.ts`. The gateway holds a registry of turn contexts keyed by
  `turnId` (registered around `adapter.turn` in an `acquireRelease`, so a
  finished or interrupted turn always unregisters), and the socket path and
  turn id travel to the child in env vars on the transport the adapter hands
  its CLI. Tool names stay `mcp__remocn-*__*`, so the permission gate's
  auto-allow and the conventions' wording are untouched — a test pins both.
  Failure directions: a call for a turn that is gone gets a sentence, not a
  hang; a gateway that cannot listen is logged and the turn still runs,
  because the words matter more than the tools. Measured end to end — spawn,
  MCP handshake, `tools/call` through the socket — a call answers in ~20 ms.
- **Codex is the second adapter** (phase 3 of REM-251), and it is what proved
  the seam: `sidecar/codex/` translates `@openai/codex-sdk`'s item stream —
  items that start, update and complete, not deltas — into the same
  `AgentEvent`s, with a stateful translator that remembers how much of each
  text item it has already emitted. Three findings there were measured, not
  read: the wire carries explicit `null`s where the SDK types say optional
  (`error`, `result` on an MCP call — trusting the types crashed a turn); the
  studio's MCP servers need `default_tools_approval_mode: "approve"`, because
  `"auto"` reads tool annotations, treats an unannotated tool as destructive,
  and headless Codex then kills the call as *"user cancelled MCP tool call"*;
  and Codex names MCP tools `mcp__{server}__{tool}` — the same spelling Claude
  uses, so the conventions text works verbatim as `developer_instructions`.
  - **The permission card never appears for a Codex turn — the OS sandbox is
    the gate.** Headless Codex has nobody to answer approvals, so
    `approvalPolicy` is always `never` and the modes map to sandboxes: `auto`
    and `acceptEdits` → `workspace-write` (a write outside the folder is
    *blocked*, which is #223 enforced harder than Claude's `auto` manages),
    `plan` → `read-only`. That trade is the mapping, not an oversight.
  - **The CLI is the user's, resolved, never bundled** — `findCodex` walks
    `$REMOCN_STUDIO_CODEX`, `$PATH`, then the usual install dirs; a machine
    without it gets the *not installed* row with the install command, and a
    `~/.codex/auth.json` written by an IDE extension does not by itself put a
    binary on `$PATH`. `codex login status` is the auth probe: exit 0 =
    logged in, *"Not logged in"* + exit 1 locks the composer for Codex
    sessions.
  - **What Experimental means here**: `context` is per-turn usage, not a
    window reading, so the meter never shows, and `todo_list` does not speak
    the checklist's `TaskCreate` vocabulary, so no plan dock. The bundled
    skills *are* delivered, through a mirrored `CODEX_HOME` rather than a
    plugin flag — see *One bundle, four runtimes*.
- **Copilot is the third adapter, and it rides a bridge the fourth can reuse.**
  `sidecar/acp/` speaks the Agent Client Protocol — JSON-RPC 2.0, newline-
  delimited over the child's stdio, requests in *both* directions — and
  carries nothing Copilot-specific; `sidecar/copilot/` adds only the CLI
  resolution, the spawn flags, the failure wording and the provider info, so
  Grok Build (which also claims ACP) starts from the bridge, not from zero.
  Measured against copilot 1.0.80:
  - **ACP gives the permission cards back.** `session/request_permission`
    routes through the same gate as Claude's `canUseTool`: `reviewAcp` speaks
    #223 in ACP's vocabulary — `execute` always asks, file kinds whose every
    location resolves inside the folder run silently, anything else asks —
    and the answer picks among the *options the agent offered* (`allow_once`
    / `allow_always` / `reject_once`), cancelling rather than inventing an
    option that was not on the card.
  - **Resume is `session/load`, and the replay is deliberately dropped.** The
    agent streams the whole conversation back as updates before the load
    answers; the transcript already has it, so updates are ignored until the
    response arrives.
  - **Both login failures arrive as ordinary message text**, not errors: a
    logged-out CLI and an org-policy block each "succeed" with a turn whose
    entire answer starts with `Error:`. `inBandFailure` matches exactly those
    two shapes — no wider, or it would eat real answers that mention errors —
    and converts them into the auth failure the composer already renders.
  - **The auth probe speaks the protocol instead of scraping.** `copilot` has
    no `login status`; an unauthenticated agent answers `session/new` with
    ACP's `AUTH_REQUIRED` (-32000), a logged-in one opens a session, and no
    model is ever asked. What the probe cannot see is the org-policy block —
    that state only speaks inside a turn.
  - The studio conventions ride as the leading text block of every prompt
    (ACP has no system-prompt hook) and the bundled skills ride as
    `--plugin-dir`; modes map by URI fragment — `plan` to Plan,
    `auto`/`acceptEdits` to Agent, never to Autopilot, which is
    Copilot's allow-all and has no story here; `--effort` takes the studio's
    levels verbatim; the spawn adds `--no-remote` (a desktop studio must not
    export sessions to GitHub web behind the person's back) and
    `--no-auto-update`.
- **Grok Build is the fourth adapter, and it cost almost nothing** — which
  was the ACP bridge's whole promise: `sidecar/grok/` is CLI resolution
  (`~/.grok/bin` first — its installer's home), the failure wording, the
  same protocol probe Copilot has, and a config over `acpTurn` (`grok agent
  stdio`, effort clamped to low/medium/high, model via `-m`). Accepted live
  end to end against a grok.com login: thinking and text stream as deltas,
  the studio's MCP pipeline tool was found and called through the gateway,
  a real shell command ran and answered. Three findings worth keeping:
  Grok sets no ACP `kind` on tool calls (its own names — `use_tool`,
  `run_terminal_command` — reach the rows with the wrench), its prompt
  capabilities say `image: false` so attached pictures degrade to a notice
  rather than a silent drop, and safe commands are self-approved by its own
  heuristics without a permission request — parity with what Claude's
  `auto` costs, not with the gate.
- **The provider is picked through the model, not beside it.** The Model chip
  opens one menu grouped by provider — a submenu per provider, its models
  inside — because "which model" and "whose model" are one decision, not two
  chips. Picking a model in another provider's group switches the session's
  provider; groups other than the session's are disabled once the session has
  spoken (resume tokens are not portable), and a provider whose account probe
  failed is disabled with *Sign in* or *Unavailable* on the row — fetched once
  per app run through `agent.accounts`, which shares `project.check`'s cache.
  A provider with no probe row yet is presented plainly: "unknown" must never
  read as "signed out". The model choice itself is per provider
  (`claudeModel`/`codexModel` in `settings.json`), and the turn sends the
  model of the session's provider — Codex's list is short and
  account-measured (`Default`, the one entry that cannot drift, then the two
  gpt-5.6 slugs a ChatGPT login actually accepted; every other slug in the
  CLI source answered 400).
- Still Claude-shaped, deliberately, until the next phases: the model picker
  and a handful of user-facing strings that say "Claude". Knowledge delivery is
  no longer among them — see *One bundle, four runtimes*.

### The sidecar

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
  when frames change — a mismatch is logged, not fatal.
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
  - bun is MIT, so redistributing the binary is free of conditions. Signing is
    REM-10's problem and unchanged by this: the app is not signed today, and when
    it is, a hardened runtime signs nested binaries — `Contents/MacOS/bun` is one
    more of those, not a new class of thing.
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

### Project → video → chat

A project holds several **videos**, and a video holds several **chats**. On screen the
project is a switcher in the pane's header and the pane's body is videos with their chats
under them; the words are "Project", "Video" and "Chat", and "composition" never appears
in the UI. The invariant that makes all of it hold: **the open chat determines
everything** — the composition the preview plays, the folder in the conventions, the
target of an export, the project for inspect and snapshot. Clicking a video opens its most
recent chat; a chevron **with its own hit area** expands the list. There is no such thing
as a selected video with no chat open, which is what kills the old divergence between
"the preview follows the selected project" and "the chat follows the open session's
project" — and with it the `openedProjectId !== previewProjectId` checks that used to
guard inspect and the environment checklist.

That was documented and not built (REM-323): the row's whole button was wired to expansion
and nothing anywhere opened a chat, so row and chevron were the same click and a video
could sit expanded and highlighted while an unrelated chat drove the preview, the
conventions and Export — exactly the divergence the invariant exists to prevent. `newestChat`
reads the **store's** order, newest first, not the pane's: attention promotion in
`paneGroups` is a reading order and must not decide what a click opens. A video with no
chats yet only expands, because there is nothing to open.

- **Two sources of truth, with different jobs: SQLite draws, the bundle corrects.** The
  pane renders `video` rows the instant a project is opened; ~7 s later the compiled
  bundle names its compositions and `video.reconcile` settles the difference — a
  composition with no row becomes one (which is what makes a foreign project with forty
  compositions usable the moment it opens, and #218's "open any folder" survive), a row
  the bundle does not name is marked `missing` and keeps its chats under *Not in the
  code*, and a video the person deleted is **never** resurrected. Nothing is ever deleted
  by a reconcile. Neither source works alone: SQLite cannot know what the agent wrote, and
  the bundle cannot answer for seven seconds.
- **Deleting is soft, and writes nothing into the project.** `deleted_at` on the row —
  no folder is removed, no marker file lands in the person's tree. That is also what
  stops the reconcile above bringing it straight back, and it makes Undo a matter of
  clearing a mark rather than racing a timer: the toast is a convenience, and restoring
  works a week later. The costs are named on the confirm dialog and accepted: the folder
  stays on disk, keeps costing build time, and a new video of the same name gets
  `<slug>-2` beside the orphan. Actually deleting the files is a sentence in a chat, which
  the agent carries out through the ordinary permission card.
- **The slug is minted once and never moves; the name is a row and renames freely.**
  `shared/slug.ts` transliterates (so «Интро» is `intro`, not the fallback), kebabs, and
  suffixes past anything taken — both the rows *and* the folders on disk, because a
  project opened from someone else's tree can hold a `src/videos` nobody recorded. Slug is
  the composition id, the folder name and the `?composition=` value; renaming touches none
  of them, which is the whole reason they are two fields.
- **Creating a project and creating its first video are one gesture.** The wizard keeps
  its three fields — name, location, aspect ratio — and the ratio belongs to the *first
  video*, which takes the project's name. "New Video" is the same wizard minus the folder
  field, and it exists only from the second video on. "New chat" is one click on a video's
  row. The ratio is written into that video's `meta` at creation and never rewritten by
  us: the agent owns that file from the next turn on, so a later change is words in a
  chat, not a regex over a live file. That is what `sized()` in `sidecar/scaffold/template.ts`
  now targets — the video module, not `Root.tsx`.
- **One turn at a time is per video, not per chat.** Two chats under one video would be
  two agents rewriting one folder, so the composer's existing queue keys on the video: a
  send while a sibling chat is running enqueues, and the turn that ends hands the baton on
  — its own queue first, then the longest-waiting sibling (`waitingSibling` in
  `lib/studio/turns.ts`). Different videos stay fully parallel, which is the point of all
  of this.
- **`paneGroups` moved down a level and changed nothing else.** Group is a video, row is a
  chat; attention promotion, the worst-of rollup and the cap on eight quiet rows are
  untouched, and `paneSections` now splits on `video.missing` instead of
  `project.missing`. The base order is the same `ORDER BY COALESCE(...)` the projects had
  — newest chat first, videos with no chats by creation — with `rowid DESC` as the
  tiebreak so a video created seconds ago still leads.
- **There is no migration.** There are no users, so migration 6 drops the chats and their
  blocks rather than inventing a video for each of them: `video_id` is `NOT NULL`, a chat
  without a video cannot exist, and SQLite will not `ADD COLUMN … NOT NULL` anyway. The
  projects survive, and their videos come back on the first reconcile.
#### Registering a video without touching `Root.tsx`

A video is a folder under `src/videos/`, and something has to turn that folder into a
`<Composition>`. The scan that does it lives in **`src/videos/registry.tsx`**, a file the
studio writes and owns, and it is spliced into the project at the **entry point** rather
than in `Root.tsx`:

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";
import { withVideos } from "./videos/registry";   // ← added

registerRoot(withVideos(Root));                    // ← rewritten
```

- **The entry point is the seam, because `Root.tsx` is the person's file.** #218 opens any
  folder, so most projects arrive with a `Root.tsx` full of their own compositions and no
  scan; rewriting *that* means an AST edit on arbitrary code whose shape is unknown, and a
  half-understood edit there breaks every composition in the project, not only ours. The
  entry is three lines of a shape every Remotion project shares. `ensureRegistry` in
  `sidecar/scaffold/registry.ts` matches `registerRoot(<identifier>)` and inserts one
  import; **anything else is refused by name**, never rewritten on a guess.
- **One mechanism for both worlds.** The template ships an entry already written that way,
  so `ensureRegistry` is idempotent there — it finds its own import and does nothing. New
  project, opened folder: same code path, and `Root.tsx` is never written to in either.
- **`registry.tsx` is not in the copied tree.** It sits at the *template root*, skipped by
  `expandTemplate` along with `video-template/`, and is placed into `src/videos/` by
  `ensureRegistry` — which is what lets it also reach a project the studio never
  scaffolded. It is never overwritten.
- **The cast around `require.context` earns its place.** webpack has to see that call
  literally, and the file is written into projects whose types we do not control, so it
  reads `require` through an inline cast rather than shipping an ambient `declare const
  require` that would clash with `@types/node`.
- **Who runs it, and when.** `project.scaffold` and `video.create` run it — both are
  moments the person asked for a video, so the write is authorized. Nothing else does:
  a reconcile never writes into the project, even when it can see a folder nothing
  renders. For a video created before its project could register one, the repair is a
  button — *Register in this project* on that video's menu, offered only while it is
  `missing` — and `video.register` is the only path that writes into a project the studio
  did not scaffold without a new video being made.

- **Not done, and deliberately:** a window per project. It buys the same pane the switcher
  buys and costs a second `useTurns`, a second permission gate, a channel that belongs to
  one window, and a rewritten quit guard and updater. If "two videos side by side on one
  screen" ever becomes a requirement it is its own piece of work, not a detail of this one.

### History

Chats and transcripts live in **our own SQLite**, opened by the sidecar with
`bun:sqlite` — not in the Claude Code transcript files, whose format is not a
public contract and would break the left pane on any CLI update. Only
`sdk_session_id` is kept, and only so the SDK can `resume`.

- **The sidecar owns it, because the sidecar is where the events are.** Writing
  from the webview would mean a Tauri IPC round trip per text delta; here it is
  a function call on the same object that just emitted the chunk. `bun:sqlite`
  also costs nothing to add — it is part of the runtime the sidecar already is,
  where `tauri-plugin-sql` would have pulled sqlx into the Rust build and put raw
  SQL in the webview. Accepted cost: the pane needs the sidecar up, which every
  other part of the app already does.
- **The database file is the core's decision, not the sidecar's.** Rust resolves
  `app_data_dir()`, creates it and passes it as `REMOCN_STUDIO_DATA_DIR`, next to
  `REMOCN_STUDIO_HOST_PID`. Run by hand without it, the sidecar falls back to a
  temp dir and says so on stderr.
- **A block is a transcript entry, and there is exactly one fold.**
  `shared/transcript.ts` holds `fold`; the webview runs it to render the live
  stream and `sidecar/history/recorder.ts` runs the *same* function to decide
  what to store. The recorder writes only the entries whose identity changed —
  `fold` is immutable, so that is at most one row per event. Two folds that had
  to agree would drift; this one cannot.
- **Grouping runs of activity is render-time, and lives nowhere near that fold.**
  `lib/studio/runs.ts` takes the entries and returns items that are either one
  entry or a run of consecutive tool calls; the pane folds a run of two or more
  into a single row showing the last of them and a `+N`, which expands into
  exactly the rows it replaced. Doing it in `shared/transcript.ts` instead would
  put presentation into SQLite and make the stored transcript lossy — and because
  the grouper is a pure function over the entries, a session loaded from history
  groups identically to one folded live.
- **The plan Claude writes is one checklist, derived the same way.** Claude Code
  plans with `TaskCreate`/`TaskUpdate`, not `TodoWrite`, and those calls used to
  render as a wall of wrench rows labelled with a truncated *description*.
  `lib/studio/tasks.ts` folds every task call of a turn into one checklist
  anchored at the first `TaskCreate`, which `lib/studio/runs.ts` emits in place of
  those entries before it groups the rest. Identity comes from the id in the
  create's `result` (`Task #1 created successfully: …`), with position among the
  creates as the fallback while the result is still in flight, since ids are
  assigned in order; an update naming an unknown id changes nothing rather than
  inventing a row. Because it is a pure function over the stored entries, a
  session reopened from SQLite renders the checklist the live turn showed, no
  `TranscriptEntry` variant was added and no migration was needed. A **failed**
  task call is not folded: it stays its own row with its error, as every failure
  does. **The task list belongs to the session, not the turn** — the tool numbers
  ids sequentially for the whole session and a plan written in one turn is
  routinely moved by updates in the next, so only where a plan is *anchored* is
  per turn: a later burst of creates opens its own checklist, in the order the
  conversation happened, while an update reaches its task wherever that task was
  written. Settling the list on every user message instead was the first version
  of this, and it cost every `TaskUpdate` of a second turn: the id matched
  nothing, so the call fell out of the checklist and drew a row saying "Updated
  task #6 description, status" while the plan above it stayed all-pending.
- **The plan also sits on top of the composer.** `TaskDock` is a section of the
  `DockStack` in the composer's own `max-w-2xl` column, collapsed to the task in
  hand — its `activeForm` — with the count on the right, and it opens *upwards*
  into the whole list. The stack has no bottom radius and no gap under it, so it
  abuts the composer and reads as a drawer behind it; overlapping the composer to
  get that effect is what the first two versions did, and each of them ended up
  putting an edge or a shadow of ours across the input. The queue is the stack's
  other section — see *The next message waits its turn*. It lived in the transcript's
  left gutter first, measured against the pane with a `ResizeObserver` and three
  visibility rules; sharing the composer's column deletes all of that — a pane
  resize reflows both together and there is nothing left to measure. Expanded or
  collapsed is `taskDock` in `settings.json`, so a plan left open comes back open.
  The checklist **stays in the transcript too**: there it is a record of what
  happened, and it is the only copy a session reopened from history can anchor in
  the right place.
- **A subject wraps; it never truncates.** A plan whose every row ends in an
  ellipsis is a plan you cannot read, and the block is free to grow downwards
  where it is not free to grow sideways — so rows wrap, the running one carries a
  surface, and the whole list scrolls with no fade over it. That is also why
  `PANEL_MIN` is a *readability* floor rather than exactly half of `PANEL_MAX`:
  below it a wrapped 14px line stops being worth reading, and the button says
  more than four clipped words would.
- **Depth is a token, not a border.** `--elevation-floating` in `app/globals.css`
  is a translucent ring plus ambient layers, so it composites over whatever of
  the transcript is behind it instead of being tuned to one background; the dark
  palette collapses it to a white ring with one wide ambient shadow, because a
  stacked shadow cannot be seen on a dark surface but this one floats over
  scrolling content. The shell's `rounded-xl` over `p-1.5` puts the rows'
  `rounded-lg` exactly a padding's width inside it, so the corner gap stays even.
- **Hiding is the user's, and it is remembered.** The panel's × folds it into the
  button, whose popover carries a pin to bring it back, and the choice is
  `taskDock` in `settings.json`. Hiding by hand can only ever *narrow* what the
  room allows, never widen it: with no room for the button either, there is
  nothing to hide and nothing to restore.
- **The pane's running row reads the same plan.** `rowOf` in `lib/studio/groups.ts`
  derives the open plan from the turn's entries with the same `currentTasks`, so
  `Running · 2m` becomes `Registering the scene · 1/3 · 2m` — the running task's
  `activeForm`, how many of the plan are done, and the elapsed time it already
  showed. It is derived **only while the turn runs**: a settled row stays one
  quiet line, and walking a finished session's entries on every minute tick would
  cost the whole pane something nobody is reading. The row is still one line; the
  checklist itself belongs to the transcript.
- **The thinking marker reads the running task's `activeForm`** — the
  present-continuous phrase the tool carries — falling back to its subject, and to
  "Thinking…" when nothing is in progress.
- **Every tool call folds, and only a failure breaks a run.** An earlier rule
  folded a named set of read-only tools and kept every command on screen. Two
  turns' worth of screenshots killed it: a real turn is walls of `Bash`, and the
  walls are as much `mkdir` and generator scripts as `ls` — a rule that spares
  mutations spares the wall. A failed call still stands alone, because its error
  text renders under the row and a count must never be the only trace of the one
  thing that went wrong. Showing the newest entry rather than a count is what
  makes the same row a live ticker while the turn runs.
- **A row leads with an icon for the kind of work, not a state dot.**
  `components/studio/activity-icon.tsx` maps tool → lucide icon through a `Map`
  (a `Record` would resolve `constructor` off `Object.prototype`), with a wrench
  for anything unknown. State went into the icon's colour, so a settled turn has
  no column of green and `running`/`failed` stay findable.
- **`id` is not stored.** The row is `(session_id, ordinal, kind, payload)` and
  the id is rebuilt on load as `block-<ordinal>`, so a session loaded from disk
  and a turn folded live can never collide on a React key.
- **A crash costs the in-flight block and nothing else.** Every event upserts its
  row as it arrives (`ON CONFLICT (session_id, ordinal)`), in WAL with
  `synchronous = NORMAL` — a force-quit cannot lose a committed row, and the next
  turn resumes numbering from `MAX(ordinal) + 1`.
- **History never fails a turn.** `recording()` swallows and logs every store
  error and hands back an inert recorder, the same way the context-window reading
  does; a database that cannot be opened at all yields `broken()`, whose methods
  all fail with the reason, so Claude still works and the pane says why it is
  empty. The `history.*` methods report their errors normally.
- **Migrations are `PRAGMA user_version`** against `MIGRATIONS` in
  `sidecar/history/migrations.ts` — one array entry per version, applied in one
  transaction. The schema *will* change; adding an entry is the whole ceremony. A
  step is a SQL string or a function over the driver, because migration 2 has to
  resolve symlinks and take a basename to turn every `session.folder` into a
  `project` row, and SQL can do neither. That migration rebuilds `session` around
  `project_id`, which is why `migrate` turns **foreign keys off** around its
  transaction: with them on, `DROP TABLE session` runs an implicit delete and the
  cascade takes every `block` with it. `PRAGMA foreign_key_check` before `COMMIT`
  is what proves it did not.
- **A folder is a row.** `project (id, path UNIQUE, name, …)` and `path` is
  canonical — `realpathSync` plus `resolve`, so the same folder opened twice,
  symlink or not, is one project rather than two histories. Sessions cascade from
  it and blocks from them, so removing a project is one `DELETE` and never touches
  the folder on disk. A project whose folder is gone keeps its row: `missing` is
  computed at read time with `existsSync`, and the sidecar refuses to start a turn
  in it rather than handing the SDK a `cwd` that is not there.
- **The mode is a column on the session** (migration 3, defaulting to `auto`, so
  every session that predates it comes back behaving exactly as it did). Two things
  write it: the turn itself, through `open`'s upsert, so the stored mode and the
  mode a turn ran under cannot drift; and `history.mode`, for a mode picked between
  turns that would otherwise be lost on quit. A draft session has no row yet and
  keeps its mode in the turns map, exactly as it keeps its SDK session id.
- **`bun:sqlite` cannot be imported by the test suite** — Vitest's workers run
  under Node, which has no `bun:` loader — so the store is written against a
  three-method `SqlDriver`. Production binds it to `bun:sqlite` in
  `sidecar/history/sqlite.ts` (imported only from `index.ts`); the tests bind it
  to `node:sqlite` and exercise the real SQL. Those suites need
  `// @vitest-environment node`: the default jsdom environment refuses to bundle
  Node built-ins, and `vitest.setup.ts` skips its DOM teardown when there is no
  `window`.

The pane on top of it: projects ordered by their most recent session — that
*base* ordering is `project.list`'s `ORDER BY` — sessions newest first inside
each, expansion persisted in `settings.json`. A session row is created by
the first turn and arrives in the webview as the `history` chunk at the head of
that turn's stream, which is why the list can show a brand-new session without a
round trip and without racing the turn that created it. The id in that row is one
the *webview* minted and sent, so a turn has a key from the moment it starts
rather than from the moment the sidecar answers.

### The pane never hides what needs you

`paneGroups` in `lib/studio/groups.ts` is one pure function over the projects, the
sessions and the turn map, and it decides everything the pane's honesty rests on:
grouping, ordering, the collapsed rollup, and which rows the cap may hide.
Components render its output and decide nothing, which is why the rules are pinned
by tests that render nothing.

- **Attention beats recency, but only where it exists.** Inside a group: waiting
  first, longest wait leading, then running, then everything else in the order the
  store gave. Across groups: the store's order is the base and a group holding a
  waiting session is promoted above the rest, keeping the base order within each
  half. That promotion is the one piece of ordering the *webview* owns, and it has
  to be — turn state exists nowhere else. With an empty turn map the output is
  byte-for-byte the store's order.
- **A folder that is gone leaves the list.** `paneSections` splits `paneGroups`'
  output into the projects still on disk and the ones that are not, and the pane
  renders the second half under a *Moved or deleted* heading. It partitions
  *after* the promotion above, so filtering preserves relative order and
  promotion becomes per-section for free — a missing project with a waiting
  session rises within its own half and can never outrank a live one. Splitting
  is all it does: a moved project keeps its sessions, its rollup and its
  transcripts, because the history is still worth reading and `Locate…` still
  reconnects it. The heading is a plain `<h3>`, not `SidebarGroupLabel` with a
  `render` prop: `useHeadingContent` cannot see children through `useRender`'s
  indirection and fails the check, and the primitive's own behaviour is all
  `collapsible=icon` handling that a `collapsible="none"` sidebar never uses.
- **The cap counts only quiet rows.** Waiting, running and unread rows render
  regardless and are excluded from the "Show N more" count, so the number always
  matches what expanding reveals and the cap can only ever hide what you have
  already seen and settled.
- **The rollup is worst-of**, waiting > running > failed > unread, on the project
  row while the group is collapsed, and waiting carries its count.
- **Timestamps are webview-only.** `TurnState` gains a `startedAt` when a turn
  begins and each pending ask an `askedAt` when its event arrives — no IPC, schema
  or sidecar change, because the webview already receives both moments. One
  minute-interval tick (`useNow`, a fiber, not a bare `setInterval`) drives every
  label in the pane, and the pure layer takes `now` as an argument so tests pass a
  fixed one instead of faking clocks.
  - **The thinking marker reads the same `startedAt`, a second at a time.**
    `runningTime` is the ticker's formatter — seconds, then `2m 5s`, then
    *`elapsedTime` itself* past an hour, so the long tail is written once and the
    two panes cannot drift. The chat pane owns that clock and passes `now` down;
    the marker formats and decides nothing. The redundancy with `Running · 2m` is
    deliberate — one origin instant, a resolution per pane, chosen by how many
    rows are on screen at once. `useNow` takes `null` for "do not tick", and the
    pane passes an interval only while its turn runs: without it an idle window
    repaints the conversation once a second for a desktop app's whole lifetime.
    `Effect.repeat` runs its effect once before the schedule, so resuming the tick
    refreshes `now` rather than measuring the turn against a timestamp frozen when
    the pane mounted. The number is muted, `tabular-nums` and outside the shimmer,
    and carries no live region or status role: a screen reader must never be
    handed something that changes every second.
- **The active row carries the emphasis; the inactive ones carry none** (REM-335). An
  inactive title was `text-sidebar-foreground/65`, and that token is *itself* a 64% mix
  toward the ground — so the fade compounded to about 42% of the way from the background
  to the ink: **2.5 : 1 in light, 3.8 : 1 in dark**, both under AA's 4.5 : 1 for 14px text,
  and both *behind* the timestamp sitting beside them. The row you scan the list for was
  the faintest thing in it, and the hierarchy was inverted as well as under-contrast. It is
  `text-muted-foreground` now, which the timestamp already uses; the row's own background
  is what separates the active one. Anywhere else a token that is already a mix is faded
  again will compound the same way — a sweep worth doing, not done here.
- **Rows are adaptive.** Settled is one line — title left, relative time right.
  Waiting, running and failed take a second line: `Waiting 4m · Bash`,
  `Running · 2m`, or the first line of the error. The waiting timer counts *up*
  and never toward the gate's ten-minute auto-deny: if that window changes the
  pane needs no change, because it displays elapsed and not remaining.
- **Hovering hides nothing.** The status marker leads the row and the delete
  button has its own slot, where the marker used to fade out to make room for it —
  aiming at a session used to cost you the thing you were checking.
- **Deleting forgives.** The row leaves the list at once, but `history.remove` is
  held behind an undo window — `Effect.sleep` in a forked fiber — and the toast's
  Undo is a fiber interrupt that puts the row back at its old index, selection
  included. The window is a parameter with a default so tests shrink it. Quitting
  inside the window drops the delete rather than rushing it: the session comes back
  next launch, which is the failure direction that keeps data. A busy session still
  refuses to be deleted at all.

### Turns run in the provider, not in the pane

`hooks/use-turns.ts` holds a map keyed by that id: entries, the running `Fiber`,
the pending permission queue. Switching sessions is a read from another key, so
nothing is interrupted — where the chat pane used to be keyed on a token and a
remount *was* the cancel, cancellation is now `stopTurn`, said out loud.

- **The open session is a ref, not a prop.** `markOpen` tells the store which key
  is on screen; a turn that ends anywhere else sets `unread`, which the row shows
  as a dot until you open it. Status per row — running, waiting on a permission,
  failed — is derived from the same map by `statusOf`, and none of it is stored.
- **The pane's folder is the open session's project, not the selected one.**
  `openedProject` resolves it from the session's `projectId` and only falls back
  to the selection, because the selection is `null` until `project.list` answers
  and every path in the transcript then renders absolute. One project drives the
  title, the transcript's `cwd`, the permission card and the missing-folder
  banner, so they cannot disagree about which folder a turn ran in.
- **A permission belongs to its turn, not to the screen.** A background session
  that asks marks its row and keeps its own composer locked; the card is answered
  when you open that session. The gate denies anything unanswered for ten minutes,
  because with background turns "nobody is looking at this card" is the normal
  case and a held card holds a `claude` process open.
- **A single-select chip menu has to be told to close** (REM-326). Base UI's `Menu.Item` dismisses on
  click; its `RadioItem` and `CheckboxItem` default to `closeOnClick: false`, which is right for a
  checklist and wrong for every menu in the composer's toolbar. All of them are anchored *above* the
  composer and open upward over the textarea, so a menu that survived its own selection put a row
  under the next click — and the next click is almost always the text field. Measured: aiming at the
  textarea with the Effort menu open on Low chose *Extra high* instead, silently, with the chip
  collapsed to an icon at that pane width so nothing on screen said what the effort now was. Every
  `DropdownMenuRadioItem` in `components/studio/` carries `closeOnClick`; the default is not changed
  in `components/ui/dropdown-menu.tsx`, because a `shadcn add` re-add overwrites that file.
- **The composer's text is taken verbatim, and macOS does not do that by default** (REM-329). Text
  substitution turned `git status --short` into `git status —short` on the way to the agent, and the
  raw prompt is what `shared/transcript.ts` stores, so a reopened session shows the mangled text too
  — the damage outlives the turn. The same substitution ruins `"`, `'` and `...`, none of which then
  parse. `VERBATIM_INPUT` in `lib/studio/text-input.ts` is `autoCorrect`/`autoCapitalize` off, spread
  onto the composer, both *What should change?* fields, the props pane's Text area and the tuning
  text control — every field whose content the agent reads or that is written back into TSX.
  Spellcheck is deliberately left alone: it is a separate switch and nobody asked for it.
- **The mode chip reads the open turn, not a setting.** Model and Effort are
  app-wide and live in `settings.json`; the mode is per session and lives in the
  same map as everything else about a turn, which is why the composer takes it as a
  prop where the other two come from `useStudio()`. Persisting it needs both the
  turn map and the session list, so `useWorkspace` owns that seam — it is the only
  place that has both.
- **Quitting asks first.** The Rust core prevents both `CloseRequested` and
  `ExitRequested` and emits `app://quit-requested`; the webview answers by
  invoking `quit_studio` immediately when nothing is in flight, or after the
  confirmation when something is. The flag that lets the second attempt through
  lives in Rust, so `app.exit(0)` cannot deadlock against its own guard.

### The next message waits its turn

Send during a running turn queues the message instead of dropping it, and the
queue is a field on `TurnState` like everything else about a turn — so it belongs
to the session, dispatches while you are looking somewhere else, and is gone on
relaunch. The sidecar and `shared/ipc.ts` are untouched: a queued message becomes
an ordinary `agent.prompt` when its turn comes.

- **This started as a silent data loss.** The textarea was never disabled on
  `isRunning`, so you could type — and Enter then cleared the field and every
  attachment list while `sendTurn` dropped the call on its `fibers.current.has`
  guard. `onSubmit` answers with a boolean now and `submit` clears only on a
  `true`, which also covers the other refusal (no project open) rather than only
  the one this feature added.
- **One fiber per session is the constraint, not a limitation to route around.**
  Two prompts on one `sdkSessionId` would fork two CLI processes against one SDK
  session and take `nextOrdinal` twice, so serialising is the design and the
  queue is what makes waiting visible. Streaming into the live turn through the
  SDK's already-open input generator is the v2 branch, and a different contract.
- **A queued message is captured whole, at the moment it was written** — text,
  attachments, elements, assets, media, *and* the model, effort, frame and
  project the composer was set to. Only the **mode** and the **provider** are re-read at
  dispatch, from the turn that just ended — the mode because approving a plan
  mid-turn changes the mode the session is in and the follow-up belongs in that
  one, the provider because it is a property of the session, not of the message. Capturing the frame at
  enqueue is the point of doing it this way round: "make this bit slower" means
  the frame you were looking at when you wrote it, not the one on screen three
  minutes later.
- **Dispatch is decided outside the state updater.** `nextQueued` is pure and is
  called on the pre-settle snapshot; the updater only drops the head it names.
  Reading the head *inside* the updater would send twice under StrictMode, which
  double-invokes updaters in dev.
- **Three things hold the queue where it is**, all of them "not what the person
  meant": a turn stopped by hand (a deliberate cancel, which reaches `onExit` as
  an interrupt), a turn that failed, and a permission still unanswered. The last
  one is `nextQueued`'s only reason to read `permissions`, since the settled state
  has none by then.
- **Recursion goes through a ref.** The `onExit` that dispatches lives inside the
  function it calls, so `launcher.current = launch` — the same shape `useComposer`
  uses to read the live text — keeps `sendTurn` a plain "start or enqueue" and the
  chaining out of it.
- **The queue is the second drawer, and it shares the plan's chrome.**
  `DockStack` in `components/studio/dock.tsx` is the geometry both use — the
  `max-w-2xl` column, the `px-3` inset that makes a strip narrower than the
  composer, `bg-card`, and the top radius; `DockSection` is one line of it, with
  the disclosure and the count. Rows under the composer were the first version and
  they grew the input downwards one line per message, which is the thing a queue
  must not do: collapsed, this is one line whatever is in it. The radius belongs to
  the *stack* rather than to each section, or two open drawers would leave a notch
  where their corners meet, and `empty:hidden` is what keeps the wrapper from
  painting a strip when neither has anything to say.
- **The plan is above the queue, and the queue is against the composer**, because
  the queue is the composer's own outbox: a message you just queued has to land
  where you were typing. The plan is context and moves up a line to make room.
- **A queued row wraps, exactly as a plan row does.** Collapsed, the strip
  truncates the message that goes out next; open, the rows wrap — a queue you
  cannot read is not a queue you can edit. `useQueue` is the only place the turn
  map and the composer meet: clicking a row drops it from the queue and restores it
  whole, which needs the composer's stores to take items back, so `restore` exists
  on each of them. Editing needs an empty composer and the row's title says so —
  overwriting a draft to recover an older one is a trade nobody asked for.
- **The queue's open state is not remembered, where the plan's is.** `taskDock`
  lives in `settings.json` because a plan outlives the turn that wrote it; a queue
  drains as its turns settle, so it is `useDisclosure` and starts collapsed.
- **A restored selection comes back without its rectangle.** The queue carries
  `PromptElement`, which is what the turn sends; the marker geometry is inspect's
  and is drawn only for selections made in the armed session, so a zero rect draws
  nothing rather than drawing a box over a frame that has since rebuilt.
- **Element references are not dropped on a project change here**, unlike in the
  composer: every queued message carries the project it was written in and is
  dispatched into that project's session, so its `[Element #N]` can never point
  somewhere the message is not going.

### Pasting a picture, and pointing at it

Cmd+V attaches whatever image is on the clipboard and drops `[Image #1]` at the caret;
the sentence the user writes is what says which picture they mean, and the turn is built
by cutting the text at each reference and splicing the image in there (#13).

- **The reference format lives in `shared/references.ts`**, next to the IPC contract and
  the transcript fold, for the same reason the fold is shared: it is parsed in two
  processes — the webview colours it, `sidecar/claude/content.ts` splices into it — and
  two implementations that had to agree would drift. Everything about the format is a pure
  function there: render, segment, insert at a caret, locate the reference a keystroke
  should take, drop one (or several) and renumber, and diff two drafts for the references
  that left. A number outside the attachment count is **not** a reference: `[Image #7]`
  with three attached is plain text everywhere, coloured nowhere and spliced nowhere.
- **The invariant is positional.** `items[i]` is always `[Image #{i+1}]`, which is what
  makes the sidecar's splice a lookup by number rather than through a side table, and why
  references carry no identity. Removing an attachment removes its reference and shifts
  every higher one down, so the list and the text cannot disagree.
- **Atomic for insertion as well as deletion, and the second half was missing** (REM-313). A caret
  resting *inside* `[Image #1]` was handed straight to `insertAt`, which cut the token in half:
  `[Imag [Image #2] e #1]`. The halves are literal text, so the diff path below read reference 1 as
  lost and dropped the attachment it stood for — pasting one picture silently removed another, and
  left garbage in the words the person typed. `caretOutside` in `shared/references.ts` snaps the
  caret to the nearer edge of the token first; a tie goes after it. It sits in `useComposer`, the one
  thing holding the caret, so every insertion path — paste, drop, an element comment, an asset pick,
  a written phrase — is closed by one call each rather than by five separate rules.
- **The binding runs both ways, which is why the reference is atomic.** Deleting the
  reference deletes the attachment, so Backspace/Delete touching or inside `[Image #N]`
  takes the whole token in one keystroke rather than leaving `[Image #1`, which parses as
  nothing. Anything that removes a reference wholesale — select and delete, cut, paste
  over, Cmd+A — is caught instead by diffing the draft against the previous one in
  `onChange`, and that path is the *only* one that rewrites text the user just typed, so
  the fast path must never touch the caret. Two consequences worth knowing: modified
  deletes (Option/Cmd+Backspace) are left to the browser and land in the diff path, and
  **this reverses #13's story 16** — referencing is no longer optional, so an attachment
  cannot outlive its reference. `contentOf`'s unreferenced-first rule stays because it is
  what keeps a no-reference message byte-for-byte what it was, not because the UI can
  still produce one.
- **The composer owns the text, so it owns the references.** `useAttachments` is a plain
  store whose add/attach report *how many* items arrived; every operation that touches
  both the list and the text is orchestrated in `useComposer`, the only thing holding the
  caret. `refer()` reads the live textarea rather than the `value` closure, so an image
  that took a second to save cannot overwrite what was typed meanwhile.
- **Three rules keep the spliced content safe.** Attachments nobody referenced go **first**,
  ahead of the whole sequence — with no references at all that reduces byte-for-byte to
  what the builder emitted before, which is what keeps the old behaviour and its tests
  intact. A repeated reference stays literal text, so the image is sent once. Empty and
  whitespace-only text blocks are dropped, because the API rejects them. The reference
  text itself is *not* kept in the content — the image is at that spot — while the stored
  transcript keeps the raw prompt, so history still shows `[Image #1]`.
- **Pasted bytes become a file before anything else touches them.** The contract carries
  attachments as paths, so the one unavoidable crossing happens once, at paste time, as a
  **raw-body invoke** — bytes as a binary body, not a JSON array of numbers — with the media
  type and the percent-encoded filename in request headers. `src-tauri/src/paste.rs`
  decides where the file lives, exactly as the core decides where the history database
  lives; the webview never picks a location. The written name is sanitised, keeps the
  original extension when it already implies the same media type, and is disambiguated on
  collision, so the basename is what the card displays. **Pasted files are never swept**:
  history renders the same previews for past turns, so a sweep would hollow out old
  sessions.
- **Colouring a `<textarea>` is an overlay, not a rich editor.** The composer stays a real
  textarea — keyboard behaviour, accessibility and the existing tests depend on it — with
  its own text transparent, its caret kept, and a mirrored `aria-hidden` layer underneath
  carrying identical typography and padding. `MessageText` draws both that overlay and the
  user's bubble in the transcript, so a sent message looks like the message that was
  written. The colour is its own token (`--reference`), not the primary colour, which in
  the dark palette is too dark to read as text.
  - **A reference may differ in colour and in nothing else.** The caret is positioned by
    the textarea's metrics and the text you read is the overlay's, so any per-reference
    style that changes width — weight, tracking, size, family, padding — desyncs the two,
    and the error *accumulates*: `font-medium` on the span put the caret a character off
    after four references. Colour is the only property that costs nothing here.
- **The colour picker opens on a real click, not a scripted one.** dialkit hides its
  `<input type="color">` at zero size with `pointer-events: none` and asks the swatch to
  `.click()` it — which WebKit ignores, so the swatch did nothing at all here. The input
  is put back over the swatch in `app/globals.css`: invisible, but the thing the pointer
  actually lands on, and the swatch behind it wears the focus ring since the input cannot.
  That is the arrangement the pane's own colour control used before dialkit, and it is why
  that one worked.
- **Previews come from the asset protocol**, enabled in `tauri.conf.json` with the
  `protocol-asset` cargo feature; no ACL permission is involved, since Tauri 2 gates it by
  configuration alone. The scope is `**` on purpose: an attachment can be picked from
  anywhere and the app already opens arbitrary folders. `previewUrl` returns `null` rather
  than throwing outside a Tauri webview, and a dead path falls back to the icon the card
  used to show. **The card is the picture and nothing else** — a filename and a format chip
  are what you read when you cannot see which one it is, so showing the thing itself
  replaces them rather than joining them. The name stays as the image's `alt` and the
  card's hover title, which is also all that identifies a card whose file has gone.
- **Under jsdom there is no asset protocol either**, so a test that renders a non-empty
  attachment list installs the `convertFileSrc` fake next to the command fake — per test,
  because `clearMocks()` drops `window.__TAURI_INTERNALS__` between them.

Whether the macOS webview actually hands a pasted image to the page is the one thing no
seam can test; it is verified by hand in the running app. If it ever stops doing so, the
fallback is to read the clipboard in the core: the command loses its request body and
everything above it is unchanged.

### New projects

`templates/remotion/` is a real Remotion project checked in here and mapped into the
bundle by `tauri.conf.json`; Rust resolves it the same way it resolves the preview entry
(source tree in debug, resource dir in release) and passes it as
`REMOCN_STUDIO_TEMPLATE_DIR`. The template declares nothing about which compositions
exist — see *Registering a video without touching `Root.tsx`*.

- **Two methods, because they fail differently.** `project.create` makes the folder and
  the row; `project.scaffold` streams `template` and `install`. The second is where the
  network is, so the chat is usable while `bun install` runs, and a failure leaves the
  project in place with a Retry.
- **Expansion never overwrites.** A file that already exists is skipped, which is what
  makes Retry safe once Claude has edited the scene. `package.json` is the one file the
  copy rewrites, to name the package after the folder — slugified, since npm names cannot
  hold spaces or capitals.
- **The linter has one exception for the template.** `useFilenamingConvention` is off
  under `templates/**`: every Remotion project has `src/Root.tsx`, and a scaffolded
  project spelled `root.tsx` would look wrong to anyone who has seen another one.
- **The pin is 4.0.520, and it moved on the owner's call rather than on the gate.** The
  properties pane needs 4.0.513 for text and type: below it, `Interactive.js` builds an
  element's schema from `baseSchema + transformSchema` alone, so no primitive anywhere can
  carry a font size, a weight or a colour — measured, and the reason a click on a real
  video's text opened a pane with nothing typographic in it. What the move is *not* backed
  by is a running Player: the four runtime claims — `controls` non-null on an
  `Interactive.Div`, a `style.fontSize` drag moving pixels, typing in `Text` moving the
  frame, a snapshot still staying byte-identical to `npx remotion still` — are still the
  owner's to confirm in the app, and until they are, a new project scaffolds onto a
  Remotion this studio has previewed only in pieces. What *was* checked first, against the
  real 4.0.520 installed in a scratch copy of the videos project: `textSchema` and
  `textContentSchema` are spread onto every text tag (`Interactive.js:75-82`); the controls
  object still carries exactly the four fields `SequenceControls` declares, so `asControls`
  needed no optional fields after all; every override seam the runtime drives
  (`setPropStatuses`, `clearDragOverrides`, `setDragOverrides`,
  `overrideIdToNodePathMappings`, `getDragOverrides`,
  `computeEffectiveSchemaValuesDotNotation`) is present; and `SUPPORTED` covers every field
  type 4.0.520 emits except `remotion-captions`, which has no control behind it. The video
  template typechecks against those real types — verified with a `tsc` run whose
  `node_modules` is that copy's.
- **`Interactive.H1` is not what the pin buys, and that is worth knowing.** The text tags
  exist on 4.0.481 too, so the template's `<h1>` could have been one all along and the
  change typechecks on both versions; what 4.0.520 adds is the *schema* behind them. The
  template's title therefore carries `name` and a matching `data-design-id` — the shape the
  conventions now ask of every agent-written text run — and `RisingText` takes the name as
  a prop rather than reaching for the one the `<Sequence>` already had.

### What the agent knows

What makes this remocn studio and not a generic Claude Code GUI (#225). `agent/` is a real
**plugin** checked in here and mapped into the bundle by `tauri.conf.json`; Rust resolves it
the way it resolves the template and passes it as `REMOCN_STUDIO_PLUGIN_DIR`. It carries three
vendored skills — `remocn`, `remotion-best-practices` and `remotion-interactivity` — and two of
our own, `video-lessons` and `motion-design`, the latter now carrying
`rules/tunable-text.md`: one worked `Headline` component, typechecked against
Remotion 4.0.481 and pinned as a fixture that scores **zero** against the
tunability rule set, plus the several-named-components-rather-than-a-`.map()`
rule and what the shape cannot give you below 4.0.513. **All four providers load all
five** (REM-293), each through its own native mechanism, out of the one `agent/skills/`
— see *One bundle, four runtimes*.

- **`video-lessons` is ours, and it sits *beside* the vendored three rather than inside one.**
  `skills:check` walks each vendored skill and reports any file upstream does not have as
  `extra`, so a page added under `remotion-best-practices/` fails CI — and `skills:sync` would
  `rm -rf` it on the next refresh. The sync script only ever touches the skills named in its
  own `SOURCES`, so a sibling folder is invisible to both halves. `VENDORED` therefore stays
  the vendored three (it is also the collision check `pluginsFor` runs against a project's own
  `.claude/skills`) and `SHIPPED` is what the plugin actually carries; a test pins that the
  folder list equals `SHIPPED` and that every skill names itself after its folder.
- **`video-lessons` lives in one `SKILL.md`; the vendored `remotion-best-practices` is a
  router.** A skill's own body is injected by the harness, but a page it points at —
  upstream's `remotion-markup/REFERENCE.md` and its siblings — is fetched with the `Read`
  tool, and the plugin dir is outside the opened folder. That is why the gate in
  `sidecar/claude/permission.ts` auto-allows the read-only tools (`Read`, `Glob`, `Grep`,
  `NotebookRead`) on paths inside `REMOCN_STUDIO_PLUGIN_DIR`: we ship the plugin ourselves,
  so reading it is safe, while a write there — or a symlink leading out of it — still asks.
  Without that rule every router hop raised an Allow/Deny card mid-turn, which is why
  `video-lessons` is still written as one self-contained file. Read out of the CLI binary:
  plugin skills are discovered by scanning `skills/` for `SKILL.md` (no `plugin.json` entry
  needed, which is why the vendored three work with none), and one is skipped when it
  *"exceeds N byte limit"* — the limits in the binary are 128 KB and up, against 44 KB here.
- **The mandate to read it is a system-prompt line, and it is conditional.** `conventionsFor`
  appends it only when the attach actually reported `loaded`, because ordering a turn to invoke
  a skill nothing loaded would be an instruction to fail. `LESSONS_SKILL` lives in
  `sidecar/agent/knowledge.ts` with the rest of the inventory and the prompt reads it from
  there, so the name in the sentence and the folder on disk cannot drift; `INTERACTIVITY_SKILL`
  and `MOTION_SKILL` are mandated the same conditional way, so agent-written markup keeps
  inline styles, inline `interpolate()` and `scale`/`rotate`/`translate` the studio can one day
  edit. The wording names the bundle and the bare skill names rather than Claude's
  `remocn-studio:<name>` spelling: four catalogs, one sentence.
- **AI-written components must be tunable without code.** `STUDIO_CONVENTIONS` requires every
  *new* component to expose its knobs as typed props with inline defaults, a Zod schema
  beside the component (`zColor()` for colors), and an `InteractivitySchema` for a custom
  effect's parameters — the foundation the props panel (REM-6) reads instead of guessing
  by fiber. Since that pane shipped it also says what shape a *run of text* takes: one named
  `Interactive.H1`/`P`/`Span` whose direct child is the string, typography as literals in
  that element's own `style`, a `name` unique in the frame and equal to its `data-design-id`
  (carrying the index or the content inside a `.map()`), and a component that splits a run
  into words keeping the split inside behind one `text` prop — declared `type: "text-content"`
  from Remotion 4.0.513, where the pane can then edit the string live. The old sentence *"a
  component that skips this cannot be selected in the preview at all"* is gone, because the
  runtime proves it false: any DOM node is selectable, and what `withSchema` buys is the
  component's own props. Edits to existing components are deliberately exempt: nothing is
  rewritten around a schema unless the person asks. The convention degrades in words on an
  old Remotion rather than failing the turn, and `templates/remotion` ships `zod` +
  `@remotion/zod-types` so the first schema needs no `bun add` card.
  (`Interactive`/`InteractivitySchema` are exported at least since 4.0.481, the template's
  pin — measured against the published package.)
- **`"../agent": "agent"` maps the whole folder** in `tauri.conf.json`, so a new skill needs no
  resource entry — unlike `preview/`, which is listed file by file.

- **A plugin, not the user's `~/.claude`.** Skills installed globally are invisible here:
  measured with an empty folder, `settingSources: ["project"]` lists 45 commands and none of
  them is a remocn skill, and reaching a global install means adding `"user"` — which also
  loads `~/.claude/settings.json`, `~/.claude/CLAUDE.md` and, on the author's machine, 106
  further commands, so the app would behave differently per user. The plugin route lists 48:
  exactly the three we ship, namespaced `remocn-studio:<name>`. `settingSources` stays
  `["project"]`, and nothing outside the app is ever written. The same rule holds for the other
  three runtimes: the studio delivers this bundle and only this bundle, and never reaches into
  `~/.agents`, `~/.copilot` or `~/.grok`. What those CLIs discover for themselves is theirs.
- **`skills:sync` produces real files, and that is load-bearing.** `~/.claude/skills/*` are
  symlinks into `~/.agents/skills/`, so a plain `cp -R` vendors dangling links and the plugin
  then loads *nothing*, with no error anywhere. The script runs `skills add … --copy` in a
  temp directory — never in the repo, whose "project" the CLI would resolve on its own — and
  copies with `dereference`. `skills:check` refetches and compares a sha256 per file, so
  upstream drift and a local edit fail the same way; `treeOf` rejects a symlink outright.
  The two sources are fetched **one after the other**: two `bunx skills` running in parallel
  raced in the shared bun cache and one of them flaked with exit 1.
- **The vendored tree is excluded from every tool that would rewrite it.** `agent/skills` is
  force-ignored in `biome.jsonc` and `agent` is excluded in `tsconfig.json` — formatting it
  would make `skills:check` report drift forever, and the skills ship `.tsx` samples that
  import `remotion`, which is deliberately not a dependency here.
- **A project's own copy wins the name, and costs nothing else.** A project that installed one
  of these skills into its own `.claude/skills` used to get the plugin dropped *wholesale* —
  one collision took the other four with it. `locateBundle` records the collision in
  `collisions` and attaches anyway: plugin skills are namespaced in every runtime that carries
  them, so the project's copy takes the bare name by that runtime's own precedence and the rest
  of the bundle is still there. The collision is logged, not shown; it is not a failure.
- **The conventions the skills cannot know** live in `sidecar/claude/conventions.ts` and ride
  on `systemPrompt` as `{ preset: "claude_code", append }` — the wire keeps `systemPrompt` and
  `appendSystemPrompt` as separate fields, so this adds to Claude Code's prompt rather than
  replacing it. They are the per-video invariant (one video per chat, its folder under
  `src/videos/`, scenes inside it via `Series`/`TransitionSeries`, `src/shared/` for what
  is reused) and keeping the result editable. The video's slug is named in the text, and
  it reaches `conventionsFor` through `TurnServices.video` — resolved once, in the
  handler, from the row `agent.prompt` names.

### One bundle, four runtimes

`agent/skills/` is the only copy of the five skills, and Claude, Codex, Copilot and Grok each
load it their own way (REM-293). The attach is a **value**, not an inference from the provider's
name: `locateBundle` in `sidecar/agent/knowledge.ts` answers
`{ loaded, source, path, collisions, reason }`, and an adapter sends skill-aware conventions
because that says `loaded` — never because of who it is.

- **One manifest already served all four, which is why there are not four.** Measured against
  the shipped CLIs: Copilot accepts a root `plugin.json` *or* `.claude-plugin/plugin.json`
  (its scanner warns *"no plugin.json or SKILL.md found"* for anything else); Codex reads
  `.codex-plugin/`, `.claude-plugin/` or `.cursor-plugin/plugin.json`; `grok plugin validate`
  accepts ours as it stands. The only file this needed was
  `agent/.agents/plugins/marketplace.json` — Codex's local-marketplace manifest, deliberately
  **not** at `.claude-plugin/marketplace.json`, where Claude would read the plugin directory as
  a marketplace instead.
- **Copilot and Grok take `--plugin-dir`.** The path is the shipped resource, never the
  project's `cwd`. Grok's flag belongs to `grok agent`, so it goes *before* the `stdio`
  subcommand; Copilot's is global and rides beside `--acp`. Two measurements worth keeping:
  `copilot skill list` does **not** report `--plugin-dir` plugins — read out of its `app.js`,
  that subcommand calls its skill loader with no external plugins at all — while ACP mode
  passes them through `resolveDiscoveredConfig` into the same skill sources, so the absence in
  that listing is a reporting gap and not the runtime.
- **Codex could not be done with config overrides, and that was measured before it was
  designed around.** It resolves `[plugins]` and `[marketplaces]` through
  `effective_user_config`, which merges only `ConfigLayerSource::User` layers — and `--config`
  lands in `SessionFlags`. Against codex-cli 0.148.0:
  `codex plugin list -c 'marketplaces…' -c 'plugins…'` answers *"No marketplace plugins found"*,
  the identical tables written into a `config.toml` answer with the plugin. `@openai/codex-sdk`
  offers `config` and `env` and nothing else, so `env` is the only lever.
- **So the studio keeps a Codex home of its own** at `<app data>/codex-home`, built once per
  sidecar process by `sidecar/codex/home.ts` and handed over as `CODEX_HOME`. Every top-level
  entry of the user's home is a symlink back into it; only `config.toml` and `plugins/` are
  ours, and even `plugins/cache/*` symlinks each marketplace the user installed. Four things
  make that safe, each of them a measurement:
  - **The login is shared, not copied.** `auth.json` is a symlink, and Codex's `FileAuthStorage`
    saves with `OpenOptions::open` + truncate rather than a tmp-and-rename — so a refreshed
    token writes *through* the link into the user's own file. A home with no `auth.json` is not
    mirrored at all: credentials might be in the keyring, which is keyed by a hash of the home
    path, and a different home would read as logged out. That case degrades to a reason.
  - **Sessions survive.** `sessions/` and the sqlite indexes are symlinks, so a thread started
    before this existed still resumes: verified end to end — a thread created in the real home,
    resumed through the mirror, remembered its word *and* answered from a bundled skill.
  - **The user's `config.toml` is never written to.** Ours is generated as their file verbatim
    plus `[marketplaces.remocn-studio]` and `[plugins."remocn-studio@remocn-studio"]`. A user
    who registered the bundle themselves keeps their entry untouched — a second table of the
    same name is a TOML *parse error*, which would fail every Codex turn rather than lose five
    skills.
  - **The plugin store is a filesystem convention, so no `codex plugin add` runs.** The bundle
    is copied to `plugins/cache/remocn-studio/remocn-studio/<version>/`, keyed by the manifest
    version. A symlink there does **not** work — measured: the skill never loaded — and neither
    does the marketplace entry alone; the version directory has to be a real copy.
- **Failure is a notice, never a failed turn, and never an auth failure.** `announce` logs the
  attach either way and emits one `notice` when a bundle that should have loaded did not. An
  incomplete bundle is refused by name: `locateBundle` checks a `SKILL.md` for every entry of
  `SHIPPED` and says which one is missing.
- **Live matrix, on real logins.** Claude, Codex and Grok each listed all five skills as their
  own catalog spells them, opened one and quoted it, and followed
  `remotion-best-practices` to `remotion-markup/REFERENCE.md`. Nothing was written into the
  project or into any provider's home. **Copilot is the gap**: this account is blocked by an
  org policy (*"Access denied by policy settings"*), so its delivery is proven only as far as
  the CLI's own loader — `configLoaderScanPluginDirPaths` + `LoadPluginFeatureForInstalled`
  resolve `agent/skills` with `tier: "plugin-dir"` — and it keeps its Experimental badge until
  someone runs the matrix on a login that works.
- **What it costs, per turn, measured on the same prompt** (bundle attached and skill-aware
  conventions, against neither): Claude **+1215** tokens, Grok **+978**, Codex **+605**. The
  catalog itself is cheap — +505, +480 and +68 respectively — because a runtime lists name and
  description and nothing else; the rest is the conventions block, 2148 characters of it. That
  ratio is the argument against inlining: the five bodies are 69 KB.

### The preview

The pane runs **the project's own Remotion bundler with our entry instead of the Studio UI**.
Neither branch of #226 survived contact with a real project: a Vite host builds
`remocn-demo` without an error and emits 3 CSS class selectors where Remotion's
bundler emits 742, because `enableTailwind` is a splice of webpack *loaders*
(`style-loader`, `css-loader`, `@remotion/tailwind-v4`'s `@tailwindcss/webpack`)
and Vite cannot run those — it silently falls through to the project's
`postcss.config.mjs`, a different Tailwind with different source detection. And
Plan B was never necessary, because Remotion's webpack entry is an array whose
last element is a parameter:

```js
entry: [ fast-refresh, setup-environment, userDefinedComponent, react-shim, entry ]
```

`@remotion/studio/previewEntry` is only `Internals.waitForRoot((Root) => render(<Studio …/>))`.
Studio is a UI on top of the bundler, not part of it. `preview/entry.tsx` takes that
slot and mounts `<Player>` instead, so the pane is ours and the pixels are Remotion's.

- **There is exactly one way the pane is away, and that took a fix** (REM-332). The
  panel is `collapsible`, so react-resizable-panels collapses it when the divider is
  dragged past its own `minSize` — and that state is *not* `isPreviewShown`, which is
  what the header renders its toggle off. So one drag took the preview and every
  control that could bring it back: no toggle, and no Inspect / Snapshot / Export
  either, since those live in the preview's own header. The layout is persisted, so it
  survived a relaunch. `usePreviewCollapse` now asks the panel itself — `isCollapsed()`,
  the group's own answer rather than a pixel threshold — and folds a collapse it did not
  ask for into `hidePreview`, which is the state the toggle already knows. A collapse
  reported while the preview is hidden is our own `collapse()` echoing back and is
  ignored. It fires on mount too, which is what heals a layout already stored collapsed.
- **Everything is resolved from the project**, never bundled here:
  `BundlerInternals.webpackConfig` *and* `webpack` itself come from the project's
  `@remotion/bundler`, the override from its `remotion.config.ts` via
  `ConfigInternals.getWebpackOverrideFn()`, and the entry point from the CLI's own
  `findEntryPoint` (reached through `@remotion/cli/package.json`, since the exports map
  blocks the deep path) with `ENTRY_CANDIDATES` as the fallback. `@remotion/player` is
  always present — it is a dependency of `@remotion/cli` and of `@remotion/studio`.
- **The opened folder is not the Remotion root.** `remotionRootOf` climbs to the nearest
  `package.json` first, exactly as the CLI does, and the host `chdir`s there — otherwise
  opening `src/demos/some-scene` reports "no Remotion entry point" for a folder that is
  part of a perfectly good project. Entry candidates are searched from that root, never
  from the folder the user happened to pick.
- **Which composition plays is the *page's* decision, not the host's.** One host per
  project serves one bundle, and each pane opens its own video at `/?composition=<slug>`
  — so switching videos is a page load (hundreds of ms) rather than another ~7 s compile
  at 1.67 GB peak. `remocn_preferred` is still the mechanism, but it is now filled from
  the query string at *serve* time (`sidecar/preview/server.ts`) rather than fixed in
  `ServerOptions` when the host starts. With no `composition` asked for, the order is
  unchanged — `folder → Main → first` — which is what keeps a foreign project opened
  straight from disk behaving as it did.
- **The page posts the whole catalog, not just the pick.** `compositions` rides on the
  `composition` message beside `compositionId`, and it is the only thing that knows what
  the project really renders; the pane reconciles its SQLite rows against it. See
  *Project → video → chat*.
- **A video that was asked for and does not exist is said out loud, never substituted.**
  The page carries two globals, not one: `remocn_composition` — the video this page was
  opened for — and `remocn_preferred`, the basename guess from #226. A miss on the first
  is `reason: "missing"`, no Player mounts, the hint names the slug and the environment
  checklist fails; a miss on the second falls through to `Main → first` exactly as before.
  Merging them is what made a project whose `Root.tsx` predates the scan quietly play the
  *wrong video* — the pane asked for `torrens-motherboard`, nothing registered it, and
  `Main` played instead with nothing on screen to say so.
- **`webpackOverride` can be async.** `remocn-demo`'s is. Not awaiting it puts a `Promise`
  into the config, which fails without a useful message.
- **The host is a child process with `cwd` set to the project**, because config files
  routinely resolve paths against `process.cwd()` — Remotion's own loader does
  `process.chdir(remotionRoot)` for the same reason. `sidecar/index.ts` re-execs itself
  with `--preview-host`, so there is one bundle and one Tauri resource rather than two.
- **One host at a time, keyed by project** (see #235): sessions in one project compile a
  byte-identical bundle, so a host per session is two compilers on one tree. A full
  compile of `remocn-demo` costs ~7 s and peaks at 1.67 GB, and the webpack filesystem
  cache does not help, so hosts are not kept warm. A stopped host loses nothing: the next
  start compiles from disk, and a host left running would rebuild on every agent edit for
  a pane nobody is watching.
- **The base config already pins `react`, `react-dom/client`, `remotion` and
  `@remotion/studio` to absolute paths**, which is why `preview/entry.tsx` can live
  outside the project at all. `@remotion/player` is the one alias we add.
- `preview/` is **excluded from `tsconfig.json`**: it imports `remotion` and
  `@remotion/player`, which are deliberately not dependencies here. The linter still
  covers it, and `lib/studio/preview.test.ts` decodes the exact message the entry posts,
  which is the only guard against that boundary drifting.
- The stream is the lifetime: `preview.start` is a long-lived request and stopping it is
  a fiber interrupt, which drops the `acquireRelease` that owns the child. There is no
  `preview.stop`.
- **`building` after `ready` is normal** — `ProgressPlugin` reports 100% after the first
  compile finishes. `usePreview` ignores progress once served, or the pane would replace
  a live player with a spinner.
- **The preview follows the sidecar back up** (REM-324). Its request being the lifetime is
  what made a crash kill it correctly and then leave it dead: the supervisor had a new
  sidecar in ~3 s, the composer and the transcript were untouched, and the one pane costing
  7 s to rebuild was the only thing left needing a click on an unlabelled Restart button.
  `previewRecovery` in `lib/studio/failures.ts` is the whole rule — `restarting` and `down`
  mark it lost, and the next `ready` relaunches once. `starting` deliberately does not
  count: that is also a cold boot, where the effect that opens the preview has already run,
  and re-arming there would compile twice. Restart stays as the escape hatch for a re-arm
  that fails. The phase reaches `usePreview` from the provider, which takes **only the
  phase** and keeps it out of the studio context: putting the whole `Sidecar` in there
  changed the context value's identity on every status event and re-rendered every consumer
  for a reading one hook wants.
- **The pane never prints a protocol token.** `cancelled` is the sidecar's own reply frame —
  what `Effect.onExit` answers so a killed handler answers at all — and it reached the
  screen lowercase and red in an otherwise empty pane. A good protocol decision and a
  terrible sentence, and untrue besides: nobody cancelled anything, the process died.
  `previewFailure` words it.
- **A renderer's own text is worded, not forwarded** (REM-322). A failed `preview.still`
  printed the raw error: ~300 characters of percent-encoded `staticFile` URL, clipped
  mid-token because a URL is one unbreakable word, followed by Remotion's stock advice that
  *"this could be caused by Chrome rejecting the request because the disk space is low"*.
  That advice is written for a CI container, and it is not only the person it misleads —
  the agent read it in the transcript and spent a tool call on `df -h` before finding the
  real cause. `renderFailure` drops the advice and names the asset instead of its URL; the
  raw text is in `sidecar.log`, which already has it. The wrapping in the pane stays as
  insurance for whatever a renderer says next.
- **The static server answers byte ranges, and a video does not play without them.**
  Serving `public/` as one `200` with a chunked body and no `content-length` is enough for
  every image and font, and it is not enough for a `<video>`: the macOS webview probes with
  `Range: bytes=0-1` and abandons the element when the answer is not a `206`. Nothing
  reports that. `OffthreadVideo` renders `VideoForPreview` in the Player and defaults to
  `pauseWhenBuffering`, so a clip that never becomes playable shows up as a preview that
  loads for ever — a symptom that names neither the file nor the server. Remotion's own
  studio server does the same thing (`@remotion/studio-server`'s `serve-static.js`), which
  is why the same project plays under `npx remotion studio` and hung here. `sendFile` now
  sends `accept-ranges` and a real `content-length` always, `206` with a `content-range`
  for a range, `416` past the end and no body for a `HEAD`; `sidecar/preview/range.ts` is
  the pure parser, tested on its own, and an unreadable header is *ignored* rather than
  refused, as RFC 7233 requires.
- **`public/` revalidates, the bundle does not store.** `no-store` everywhere was the first
  version of the above and it is wrong for media specifically: the Player syncs a video's
  `currentTime` to the composition frame, so a scene is a stream of seeks, and a response
  the webview may not keep is one it has to refetch on each of them — plus the whole file
  again on every loop. Public files therefore carry `no-cache` and an ETag of size and
  mtime, which is a revalidation the agent's own edits invalidate for free; `If-None-Match`
  answers `304`, and a stale `If-Range` drops the range rather than splicing bytes from a
  file that has since changed. `bundle.js` and the render page keep `no-store`, where a
  cache hit surviving a rebuild is the failure that matters and there is no seeking to pay
  for. `sidecar/preview/caching.ts` holds the tag and the header parse, tested on their own.

### Footage the preview cannot afford

A video asset taller than the composition previews from a **proxy** — a 1080p h264
re-encode — while the export and the snapshot keep the original. The reason is one
measurement, and it is not the one the symptom suggested.

- **The cost is the seek, not the decode.** Measured in WebKit on a 15s clip: playing
  3840×2160 presented 24.4 fps with a 33ms median gap between frames — the hardware
  decoder keeping up — against 28.1 fps and the same median at 1920×1080. But a
  **seek** cost **59ms** at 4K against **6ms** at 1080p, and the tail was 97ms against
  84ms. Remotion's preview seeks constantly: `use-media-playback.js` sets
  `seekThreshold` to `playing ? 0.15 : 0.01`, so while the Player is paused *every*
  frame step is a seek, and 59ms is nearly two frame budgets at 30fps. A clip mounting
  mid-transition pays it at the worst possible moment. So `PROXY_HEIGHT` is 1080
  because that is where a seek stops costing a frame, not because it is a round number
  — and a 1080p source is left alone rather than re-encoded for nothing.
- **The substitution is two static bases, and the render page never sees a proxy.**
  `pageOptions` takes the base as an argument now: `previewPage` gets `previewBase`,
  `renderPage` keeps `staticBase`. The server resolves the first proxy-first and the
  second never, so `staticFile("library/clip.mp4")` is untouched in the project's code,
  the preview streams 1080p, and an export — which loads the render page — carries the
  original. The proxy answers under the original's URL with **its own** size and ETag,
  so a clip whose proxy lands mid-session invalidates what the webview cached rather
  than being pinned to whichever it saw first; the media type stays the URL's.
- **Matching is by content, because the file the preview asks for is a copy.**
  Insertion copies a library asset into the project's `public/library/`, so a proxy
  keyed by path would only ever serve the one folder. `sidecar/preview/proxies.ts`
  hashes the served file — about 40ms on 15MB, paid once per file per host, on the
  range probe a webview opens a video with — and looks it up against an index built
  from the library manifests. One proxy therefore covers every project the asset
  reached, and footage nobody put in the library is simply never matched.
- **The index is re-read on a timer, not on a signal.** A conversion takes minutes and
  lands mid-session; a scan of a few dozen small manifests every few seconds is cheaper
  than a channel between the sidecar and the host that would have to be kept in step.
  The lookup is synchronous because it happens inside the request handler, where a
  fiber would reorder the response — the same rule the `Channel` decoders follow.
- **The converter is ours, not the project's.** `@remotion/webcodecs` is a dependency of
  the *app* — 1.4MB, one transitive dep, no peer on `remotion` — dynamically imported so
  it is its own chunk. That does not break "the pixels come from the project's Remotion":
  a proxy is never in the render path. `canEncode()` asks
  `VideoEncoder.isConfigSupported` at run time rather than trusting the Safari reading,
  and a webview without an encoder records the decision and keeps playing originals.
- **0.58× realtime is what makes this a backfill.** Even with hardware encoding, a
  two-minute clip is three and a half minutes of work, so `useBackfilledProxies` is
  modelled exactly on `useBackfilledThumbnails`: sequential, each slug marked as its own
  turn begins, failures remembered for the session. The asset is usable the moment it
  lands; until its proxy exists the preview streams the original, which is slower to
  seek and never broken. `proxied` on the manifest is what stops a file already at the
  target, or a webview with no encoder, being measured again on every listing.
- **The proxy lives inside the asset folder**, as `proxy.mp4` beside `preview.png`, so
  deleting an asset takes its proxy with it and the undo window needs no new code.

### Pointing at an element, and commenting on it

Inspect mode: hover the frame, click the thing you mean, write what should change, and the
selection lands in the composer as `[Element #N]` — the second kind of composer reference,
alongside `[Image #N]` (#18). The message is still sent by hand.

- **Source resolution is React Grab, driven headlessly.** `grab`'s global build is served
  by the preview host at `/__remocn/grab.js` from a Tauri resource, resolved the way the
  template and the agent plugin are, and it goes in the page **before the project bundle**
  — bippy's `Object.defineProperty` patch has to be in place before React defines the
  DevTools hook. Measured: the hook is installed at script evaluation, so `init()` may be
  called later, which is what lets the container be the player's canvas. Keeping it out of
  the project's webpack is the point: that compile costs seconds and peaks over a
  gigabyte, and this is 380 KB it would otherwise carry.
- **Nothing reaches a third party.** `__REACT_GRAB_DISABLED__` is set in the page's globals
  so the bundle does not self-initialise, `init` is called with `telemetry: false`, and the
  `@import` of a Google-hosted font inside grab's shadow-DOM stylesheet is stripped by
  `withoutWebFonts` **when the file is served**. `sidecar/preview/grab.test.ts` reads the
  installed bundle and fails if a version bump reintroduces one — the alternative, a CSP on
  the preview page, would also block fonts the *project* legitimately loads.
- **`init({ enabled: false })` returns a stub, not a disabled API.** Read out of the bundle:
  that branch hands back `{ getSource: () => Promise.resolve(null), getStackContext: () =>
  Promise.resolve(""), … }`, `getPlugins()` is `[]`, and `setEnabled(true)` does not revive
  any of it. So `enabled: false` would resolve every source location to `null` and look
  exactly like a project whose sourcemaps are broken. `init` is always called with
  `enabled: true`; it is lazy, running on the first arm rather than at page load.
- **`init` does not take a `theme` — only plugins do.** The options `init` defaults are
  `{activationMode, keyHoldDuration, allowActivationInsideInput, activationKey, getContent,
  maxContextLines, freezeReactUpdates}`, and `Options` has no `theme` field either, so a
  theme passed to `init` is silently dropped — which is how the toolbar, the label and
  grab's default hue all survived being "turned off". The theme rides on
  `registerPlugin({ name, theme })`.
- **`theme.enabled` is a trap: turn the sections off, one by one.** It reads as the global
  switch, but the bundle only consults it *once, synchronously inside `init`*, to decide
  whether to mount the renderer at all — and a theme cannot be handed to `init`. A plugin
  registered afterwards is always too late for it. The per-section flags
  (`toolbar`, `selectionBox`, `elementLabel`, `dragBox`, `grabbedBoxes`) are reactive
  getters, so those *do* take effect from a plugin. Measured in the shipped bundle by
  counting nodes in grab's shadow root: control 25 nodes / 4 buttons, `theme.enabled: false`
  25 / 4 — unchanged — and `theme.toolbar.enabled: false` 4 / 0.
- **The container is `.__remotion-player`**, which is the Player's canvas div and not its
  outer container — `getContainerNode()` returns the outer one, which holds the transport
  controls too. That class name is `playerCssClassname`'s default and Remotion injects its
  own preview CSS against it, so it is load-bearing for Remotion rather than incidental.
- **`preview/` duplicates the message shape rather than importing it**, as it already
  duplicates the hot-reload path: it is compiled by the project's webpack and has no access
  to the app's alias. `lib/studio/preview.test.ts` decodes both directions, and that test is
  the only thing keeping the two in step. Every file under `preview/` needs its own entry in
  `tauri.conf.json`'s resources.
- **The channel is two-way and typed.** Page → app is a union discriminated by `type`
  (`composition`, `selection`, `rebuilt`); app → page is `inspect`, `freeze`, `seek`,
  addressed to the preview origin rather than `*`. Incoming messages are checked against
  the origin `preview.start` reported **before** decoding, because these payloads carry file
  paths that end up in a prompt; with no origin yet, nothing is accepted.
- **`getSource` gives the component, the stack gives the parents.** Grab's display-name
  accessor returns a Remotion wrapper; the source lookup returns the real scene, so the
  component name comes from there. `projectFrames` keeps only frames inside the Remotion
  root and outside `node_modules`, and drops the `apply` frame Remotion's dev-mode JSX proxy
  leaves in every stack. Sourcemap paths are relative to the Remotion root, which is not
  necessarily the opened folder, so the page carries `window.remocn_root` next to
  `remocn_preferred` and `absolutise` joins against it.
- **The scene comes from the fiber, its file does not.** Walking `fiber.return` for props
  that look like a `Sequence` (finite `from` *and* `durationInFrames`) gives the scene's
  identity and timing cheaply. Its own file and line are *not* available that way — for a
  transition series the inner sequence element is created by Remotion, so the nearest
  injected stack resolves into Remotion's code. The scene component's location is already
  correct in the element's own stack, which is where it comes from.
- **The schema comes from the fiber too, and `refForOutline` was the wrong door.** An
  element's `Interactive` is found by walking `fiber.return` for a `controls` prop
  (`controlsAt` in `preview/tuning.ts`, over the one `preview/fiber.ts` walk that
  `sceneOf` and the label share). It used to be found by DOM containment against the
  sequence's `refForOutline` — and **Remotion resolves that to `null` for a
  `<Sequence layout="none">` unless the author passed `outlineRef` themselves**
  (measured in `Sequence.js`: the `wrapperRefForOutline` fallback exists only for the
  other layouts). Our template passes it; an agent-written component that declares a
  schema, passes its `controls` and animates correctly does not — so the properties
  pane silently never opened for it, which is exactly the shape of "the agent says it
  added easing and inspect selects a bare div". `controls` is a prop, so it is on the
  fiber whatever the author remembered to wire. `nearestInteractive` stays as the
  fallback, and a component selectable without having registered a sequence carrying its
  controls is **found again** rather than remembered: `rebind` in `preview/tuning.ts` walks
  every live target on *every* registration, resolving its anchor back to a node, then that
  node's `refForOutline` owners, and falling back to the fiber chain when none of them
  claim it. A cache of the controls of everything ever selected was the first version, and
  it is exactly wrong for a Player that unmounts a scene on every loop — the ids it held
  were dead by the time the next edit used them. `sameMappings` is what keeps rebinding
  idempotent: the synthetic `overrideId → nodePath` map is republished only when it really
  changed, or every registration would restart the render.
- **A `targetId` is `anchor::componentName`; an `instanceId` is the bare anchor.** They look
  redundant and are not. `controlsChain` routinely returns two links whose `hostOf` is the
  *same* DOM node — an `Interactive.Div` and the `withSchema` wrapper immediately around it
  render one element — so keying a target on the bare anchor would merge them into one card
  and lose the author's own schema behind Remotion's built-in style one; the component name
  is what separates them, with a positional `::<index>` behind that for the case where even
  that collides. `instanceId` stays the bare anchor because its job is the opposite question
  — *which instance of this element* — which is what the ordinal and the `PropsPanel` key
  are about.
- **The pane opens on what you pointed at, and offers its `Interactive` ancestors.** The
  studio's own conventions ask for `Interactive.Div` and its siblings around the markup
  (so styles are editable) **and** `Interactive.withSchema` around the component (so its
  own parameters are), so every agent-written component nests at least two. Selecting the
  nearest alone gave Remotion's element primitive every time — its built-in style schema
  is the Transform / Layer / Typography / Fill / Stroke groups — while the author's
  schema, one level out, covered the same pixels and could never be pointed at. Folding
  the chain into one list was the first fix and it was **wrong**: pointing at a word then
  showed the parameters of every component above it, up to the `CameraRig` framing the
  whole scene, and titled the pane after it. So `controlsChain` collects them
  innermost-first, the selection carries all of them (`tuning` is an array), and the pane
  renders one at a time with a switcher — `TargetChain`. It renders only when there is
  more than one, so the ordinary case gains no chrome. A link whose whole schema is
  `hidden` and `layout` — the `<Series>` chip, whose two controls hide the whole film —
  is dropped from the chain unless it is the innermost (`isPlumbing` in
  `preview/tuning.ts`).
  - **The agent's own name is what the pane is titled by, not the component's.** Remotion
    already delivers it: `withInteractivitySchema` appends a hidden `name` field to every
    schema and reads it into `controls.currentRuntimeValueDotNotation`, and
    `preview/tuning.ts` used to drop it with the rest of the hidden fields — which is why
    two clicks on two different claim lines drew byte-identical panes. `titleOf` is that
    `name`; `subtitleOf` is the line under it, `Div in WordPush ·
    src/components/WordPush.tsx:245`, reading the *link's* own location rather than the
    picked element's. The chips read `name ?? chainLabel(componentName)` and carry the raw
    component name as their `title`, `chainLabel` still stripping Remotion's
    `<Interactive.…>` spelling down to `Div`.
  - **Switching is a read, not a commit.** The whole chain arrives with the selection, so
    changing target is a local index move with no round trip. Consequently everything that
    spans the selection has to span the chain: `originals` is keyed per target (two of them
    may declare `style.opacity`), the Add count and the `tuningChanges` sent to the agent
    walk every target, and `resetTuning()` with no paths fans out one command per target —
    an edit made before the switch is still an edit. A per-row reset stays on the open one.
  - A `TuningField` therefore carries its own `targetId`, and `byTarget` routes a reset to
    the component that owns each path. `tune.set`/`tune.reset` already took a `targetId`,
    so the protocol did not move.
  - **Switching points at the thing on screen.** `<Series>` and `CameraRig` are names, not
    places, so the open link is boxed in the preview: `highlightTarget` paints **inside the
    preview document**, beside the hover box and for the same reason — it shares a document
    with the pixels, so it cannot drift from them, and no rectangle has to cross the wire.
    The nodes come from `hostOf`, the first DOM element each `Interactive`'s fiber renders,
    captured at pick time because the page is frozen for exactly as long as the card is
    open. The `highlight` command is keyed on the open link's **anchor** where it has one
    and its `overrideId` otherwise, so editing a value does not repaint the box; a key the
    chain does not know puts the box back on the node that was clicked, and only a rebuild
    clears the selection (`clearSelection()`, called from the hot-reload path in
    `preview/entry.tsx`). Disarming keeps it: turning Inspect off means stop picking, not
    forget what I picked.
- **The hover label names what you could tune, not what is holding it.** Grab's display
  name is the nearest fiber's, which inside a Remotion tree is routinely
  `RegularSequenceRefForwardingFunction` — true, and useless to read. `componentAt`
  answers with the interactive component's own `componentName` when there is one, and
  otherwise the nearest fiber whose name is neither a `WRAPPERS` entry nor Remotion
  plumbing (`*RefForwardingFunction`, `withInteractivitySchema(…)`).
- **Hit-testing and the hover box are ours; grab is only a source resolver.** Grab's overlay
  is taken down wholesale (`theme.enabled: false`) and `activate()` is never called, so what
  is left of it is `getSource`, `getStack` and `getDisplayName`. `preview/picker.ts` picks
  the element and `preview/inspect.ts` draws **two** boxes, **inside the preview document**,
  so the highlight still shares a document with the cursor and cannot lag: a thin hover box
  that lives and dies with the armed session, and a solid selection box that is module-level,
  made once and never taken down. `paint()` draws both, always. The selection box used to
  *be* the hover box (`hovered ?? pinned`), so what you had picked was visible only while the
  pointer was off the canvas, and a click the app then discarded made it vanish — which reads
  as a deselect. `onDown` sets the selection synchronously, before `report()` is awaited, and
  `report()` never nulls it. Grab's own hit-test could not be steered: `Options` exposes no
  filter, its `ElementAtPointOptions.filter` is internal, and its arrow keys are *spatial*
  navigation between neighbours, not a climb to the parent.
- **Selection identity is the picked DOM node, not Remotion's `overrideId`.** Every
  `Interactive.*` rendered from one JSX call site shares one id in this preview — the bundler
  injects a `stack` prop and `with-interactivity-schema.js` keys the id on it in a
  module-level map; measured, five instances, one id. So `sameElement` comparing `targetId`
  made four claim lines one element and threw away every click after the first.
  `preview/anchor.ts` mints an anchor instead — the nearest `data-design-id` plus `:nth-child`
  steps, falling back to the canvas — which is per instance and survives a remount of the same
  tree. The **edit** still lands on the call site, because one node path per `overrideId` is
  the whole of Remotion's override model; what changes is that the pane can say `2 of 4` about
  which instance was meant. `countedIn` orders same-id instances by their index into
  `container.querySelectorAll("*")` rather than by `compareDocumentPosition`, which biome's
  `noBitwiseOperators` forbids, and an instance whose `refForOutline` is null — the normal
  case for a `<Sequence layout="none">` — sorts after every placeable one on a single total
  key, because a comparator that switched between DOM order and registration order was
  non-transitive and let the engine decide the ordinal.
- **A re-click on the instance already open is not a new selection.** It posts `repeat: true`,
  which pulses the box (a class the selection stylesheet defines, and which
  `prefers-reduced-motion` turns off) and changes nothing else — reverting what had been
  tuned and reopening the chain at the innermost link is a punishing answer to a stray second
  click. But only while a card is open. Cancel never reaches the page, so the node it last
  picked is still what it compares against and the very next click on that element arrives as
  a repeat; with no card open that has to reopen, or the pane could never be brought back on
  the element it was closed on.
- **The picker answers three questions grab got wrong.** First, *what is actually under the
  cursor*: it walks `elementsFromPoint` and takes the first element that **paints something
  at that point** — a background, a border, a shadow, a replaced element, or text near the
  point — instead of the topmost transparent wrapper, where painting now excludes what the
  frame does not show. An element whose computed `opacity` is below 0.05, or whose
  `visibility` is not `visible`, paints nothing, so an unrevealed word before its entry frame
  is not pickable; a **masked** element (`maskImage`/`webkitMaskImage` other than `none`)
  paints only where it shows text, because a mask can hide any part of a surface and text is
  the one thing it is known to show. Grab already drops `display:none`,
  `visibility:hidden` and `opacity:0`, and transparent overlays — but only ones covering
  ≥90% of the viewport on both axes, which a mid-sized animated wrapper sails past, so
  those three tests are ours now, at our own thresholds (0.05 alpha, 80% of the container).
  Second, *how much of a click a surface deserves*: a candidate covering text beats one that
  merely paints a surface, and a surface whose box covers at least 80% of the container on
  **both** axes — a full-frame glow, a scene backdrop — loses to any later candidate under
  the same point that paints and covers less. The text test decides first and returns, so an
  ordinary hover pays no whole-scene text walk twice. Third, *how much of it you meant*:
  `climb` walks up while the element is an **inline wrapper** — inline-level and painting no
  surface of its own — and stops at the first block-level element, which is the line. That is
  deliberately *not* "a short element with siblings sharing its tag": that earlier rule
  missed the two commonest shapes a text animation actually has — a word wrapped in a
  wrapper of its own
  (`<span class=word><span>mind</span></span>`, where the inner span has no siblings) and a
  line that is one word long. Painting its own surface is what stops the climb at a
  highlighted chip inside a sentence, and block-level is what keeps a grid of cards from
  collapsing into the grid. Holding **Alt** turns every rule off and picks the literal
  topmost node. The rules are pure over the DOM and tested in jsdom.
- **The text test is not element-own, and the widening is the word gap.** `nearText` walks
  every descendant text node with a `TreeWalker`, skipping text hidden by its own element or
  by an ancestor up to the candidate, and widens each text rect *horizontally* by 0.35 × the
  font size of its parent — so a click between two `inline-block` words lands on their line
  rather than on the marker or the backdrop behind it. `coversText` remains as `nearText`
  with an allowance of 0. The 0.35 is calibrated against WordPush's `0.22em` word margin;
  whether it is generous enough for looser trackings is a judgement to make on real scenes,
  not a measurement.
- **Tags are compared by `localName`, never `tagName`, because of SVG.** `tagName` upper-cases
  HTML elements but leaves SVG ones as authored, so `<svg>` reports `"svg"` and a set of
  upper-cased names misses every icon in the project. That single mistake broke both halves
  at once: an icon counted as painting nothing, so the hit test walked past it, and it
  computed to `display: inline`, so `climb` stepped straight over it. Anything in the SVG
  namespace is now **a drawing**: it always paints once it is on screen — the visibility test
  above runs first, so an `<svg>` at `opacity: 0` is no more pickable than a faded word — and
  the browser's own SVG hit-testing is
  `visiblePainted`, so being returned by `elementsFromPoint` already proves the point is on
  drawn geometry, and `fill` would never show up as a `background-color` anyway — it is never
  an inline wrapper, and `climb` folds any shape inside it up to the outermost `<svg>`,
  because what you pointed at is the icon and not one of its paths. Alt still picks the path.
  HTML inside a `foreignObject` falls out of this by itself, being in the XHTML namespace.
- **Pointer events are swallowed while armed.** `pointerdown`, `pointerup` and `click` are
  captured on `window` and stopped inside the canvas — otherwise Remotion's `clickToPlay`
  would toggle playback under every pick. Hover is recomputed on a `requestAnimationFrame`
  tick rather than per event.
- **Arming forces the canvas hit-testable, and without that a real project is unpickable.**
  `elementsFromPoint` skips a whole `pointer-events: none` subtree, and scenes routinely put
  that on an overlay layer so a title cannot eat `clickToPlay` — so a click on the words
  fell *through* them and picked the scene underneath, with nothing on screen to say why.
  `armInspect` therefore injects `.__remotion-player, .__remotion-player * { pointer-events:
  auto !important }` for the life of the session and removes it on disarm. It costs the page
  nothing, because every pointer event over the canvas is already swallowed by the rule
  above; a picker that reads the DOM cannot see what the DOM refuses to hit-test.
- **Markers and the comment card render in the app window**, over the iframe, in an
  `inset-0 pointer-events-none` overlay so hover and click still reach the page. Marker
  geometry is **normalised to the preview page's viewport**, which is exactly the iframe
  element's box, so a resize keeps markers on their elements; `cardPlacement` is a pure
  function over three rectangles and is tested without rendering anything.
- **Nothing freezes the frame any more, and picking is a mode rather than a modal.**
  The card used to send `freeze`, which stopped the picker tracking "so the frame does not
  flicker with highlights while you type" — reasoning written when the card floated *over*
  the frame. With a pane beside it the premise is gone: the pointer does not move while
  someone types, and the highlight under the cursor is the only thing that says what the
  next click would take. It also took the click with it, so the only way to reach the next
  element was to close the pane and arm again. The command is deleted rather than left
  unsent — a mechanism nothing sends is worse than no mechanism. What remains: a click
  *on the frame itself* is swallowed either way, or it would reach Remotion's
  `clickToPlay` underneath — and only on the frame itself. The swallow used to test the
  canvas **rectangle**, which is also the rectangle the Player's transport bar is drawn
  over: the bar appeared on hover and did nothing when clicked, because every one of its
  clicks and drags was eaten by a picker that never wanted them. `overCanvas` now asks
  `document.elementsFromPoint` what is actually under the point and stops the event only
  when the canvas contains it, which costs picking nothing — the overlays are
  `pointer-events: none` — and hands the transport bar back. A document that cannot
  hit-test at all falls back to the rectangle, which is what jsdom does.
  - **Picking elsewhere abandons what was pending, exactly as Cancel does.** The drafts
    live in the preview keyed by target, so a card dropped without reverting would leave
    the frame showing values the pane no longer lists and the agent will never be told
    about. Picking the *same* element again is a no-op rather than a revert, since a stray
    second click must not cost the work.
  - **The card outlives both the mode and the message.** Turning Inspect off means "stop
    picking", and Add means "send this" — neither means "close the pane", and closing it
    would silently revert work nobody asked to undo. Only Cancel closes, and its tooltip
    already says it restores the originals. Add therefore **rebases the baseline** to the
    values it just sent: without that a second Add would ask for the first one's change
    all over again. It reads the card through the ref rather than through state, so an Add
    made in the same tick as the last drag still carries it, and the comment field empties
    itself, since it is no longer unmounted between messages.
  - **Abandoning is only for what was never sent.** Picking elsewhere reverts a card that
    still has changes; a card whose changes have been added is left alone, because those
    values are what its message asks for and reverting them would leave the frame
    contradicting the request.
  - The chain strip takes a wheel sideways (`useWheelScroll` over the pure `wheelScroll`),
    because it scrolls only that way and carries no scrollbar to grab — a plain mouse would
    otherwise never reach the chips clipped off the edge. It declines the gesture when it
    cannot move, so a row two chips wide never swallows the wheel of the pane beneath it.
- **The card is not a Popover on purpose.** A popover brings Esc-to-close, outside-click-to-
  close and a focus trap, and outside-click in this mode means "select the next element".
  While it is open the page is sent `freeze`, which stops the picker tracking and ignores
  clicks, so the frame does not flicker with highlights while you type.
- **The prompt keeps the token in the sentence and appends a block per selection at the end.**
  Unlike an image, an element's payload is dozens of lines, and splicing it inline would tear
  the sentence apart. There is one block per entry in the list, not per mention, so two
  selections of the same element stay separate and a repeated mention does not duplicate the
  payload. With no selections the content is byte-for-byte what it was.
- **Availability is narrow, and the reasons differ.** Inspect is off while the composer is
  locked, while the preview is not serving, and while the preview's project differs from the
  open session's — the preview follows the *selected* project and the chat follows the *open
  session's*, and those can diverge. Element references are dropped when the open session
  moves to another project; text and images are left alone. That drop fires only on a real
  switch, never on the first `null →` resolve at boot.
- **A rebuild clears the markers and disarms**, because a box drawn over the old render lies
  about the new one, and the page that comes back has forgotten it was armed. Unsent
  references and whatever was being typed are untouched — an agent saving a file must not
  delete your draft. Marking references *stale* per changed file is deliberately deferred.
  **Disarming does not.** Add's markers and the open card both outlive the mode, so
  `InspectOverlay` is mounted whenever there is a card or a marker rather than only while
  armed; the overlay is `pointer-events-none`, so clicks are unaffected.
- **The selection box belongs to the card, not to the mode** (REM-330). Disarming keeps it —
  turning Inspect off means stop picking, not forget what I picked — but *Cancel* closes the
  pane, and a box left on the frame then refers to nothing on screen. It was worse than
  left: `highlight` carried `targetId: null` for two different things, a card with no chain
  (which wants the picked element boxed) and no card at all (which wants nothing drawn), so
  Cancel moved the box back onto the picked element and the effect, guarded on `isArmed`,
  never got to take it down. The command carries `open` now and the effect is not guarded,
  so closing the pane clears the box whether or not the mode is still on. The hover box was
  never the culprit — `stop()` removes it and its label on disarm — but both boxes draw the
  same `Name · tag` label, which is what made them look alike.
- **The chip names what the pane named** (REM-336). It read grab's source resolution, which
  answers with the function React rendered — `TitleBase`, an implementation detail that is
  not exported and never appears anywhere the person looked — while the pane honours the
  `componentName` declared on `withSchema` in three places. The chip is the only thing left
  on screen once the pane closes, so it reads `titleOf` on the link that was open when Add
  was pressed, falling back to the resolved component for a selection with no schema.
  `TuningChange.owner` was already right: `ownerOf` has always taken the target's declared
  name, so the block the agent gets never said `TitleBase`.
- **A selection with no source is still usable**, travelling with markup, component name and
  frame, and says so on its chip. Failing closed would make the feature intermittently and
  silently useless.
- **Arming is acknowledged, so the button cannot lie.** The page answers every `inspect`
  command with a status — `armed`, `disarmed`, `inert`, `no-canvas`, `no-grab` — and whether
  it held a player ref to pause. The pane prints anything that is not a clean arm, including
  "the preview never answered" once the silence outlasts `PATIENCE`, which is what a stale
  compiled page looks like from the app's side. A disabled button carries the reason it is
  disabled on its tooltip. Both exist because the first version of this failed silently in
  three different places at once and none of them were distinguishable from the outside.
- `PromptElement` carries `fps` as well as `frame`, which the prototype's shape did not: it is
  what lets the chip read `0:01.4` rather than a frame number, and it makes the block's frame
  counts interpretable. `file` is nullable for the same reason the chip needs to say "no
  source".
- **The first resolution after a rebuild costs ~210 ms** — the sourcemap fetch and parse —
  and every one after it is 0 ms, so arming warms it up with a throwaway `getStack`.
- **A curve is inert at a settled frame, so the pane moves the frame.** Every generated
  `interpolate` clamps both sides, so outside an element's own window every bezier yields the
  same constant — which is why dragging an easing looked like nothing happening, and why the
  agent itself wrote *"Set from the preview. Still inert"* into
  `need-sponsor/scenes/AskScene.tsx`. The selection now carries `window`, the element's own
  sequence span from `preview/timing.ts`, and the pane leads with a time strip: the frozen
  frame in mono, a range over `[from, until]` that seeks, and Replay. An edit to a field in
  Entry, Exit, Effects or Timing, or to anything whose path ends in `easing`, schedules **one**
  replay 250 ms after the last flush — a forked `Effect.sleep` each flush interrupts and
  re-forks, never a `setTimeout` — and is skipped outright while the preview is already
  playing. **Picking still does not seek**: the paused frame is the one being judged.
- **The playhead crosses the wire, and the boxes repaint with it.** The entry subscribes to the
  Player's own `frameupdate`/`play`/`pause` and posts `playhead` at most once per animation
  frame while playing, immediately on play, pause and seek; every `frameupdate` also calls
  `repaint()`, so the selection box tracks an element that is moving instead of lying about
  where it was. While armed the canvas wears a crosshair, restored on disarm, and the status
  slot under the frame reads `Inspect on · f 412` whenever nothing more urgent is using it.
  - **The live frame is deliberately not in the context value.** `usePreview` used to hold it
    in React state, which was free while it moved only on `selection`, `capture` and `rebuilt`
    — and cost the whole application once a `playhead` arrived every animation frame: `frame`
    is in `PreviewControl`'s memo, `PreviewControl` is in `tools`, `tools` is in the studio
    context, and ten components read that context, so playing the preview re-rendered the
    transcript, the sidebar and the composer sixty times a second. It is a ref with its own
    listener set now, read through `usePreviewFrame` (a `useSyncExternalStore`) by exactly the
    two things that draw it — the time strip and the armed readout — while the turn's
    `playing` frame is a stable getter called at send time, which is also the more correct
    moment to read it. The readout carries **no** `role="status"`: a number that changes every
    frame must never be handed to a screen reader, the same rule the pane's running-time
    ticker already follows.
- **A static override on an animated key replaces the animation with a constant, and the pane
  says so before you do it.** While a card is open and the playhead has moved off the frame it
  was picked at, the app asks the runtime what it is really holding — `tuning.read`, throttled
  to once per 250 ms with one trailing read when the frame settles, answered with
  `tuning.values` off `currentRuntimeValueDotNotation`. That reading is the component's own
  *incoming props* (`readValuesFromProps` in `with-interactivity-schema.js`), taken before
  Remotion merges the drag overrides in, which is exactly what makes it an animation detector:
  a key the code animates reports a different value at a different frame. A field whose reading
  has moved off its `originals` entry is `animated` — its row wears that badge and the hint *a
  fixed value here replaces the animation*, and the control stays editable. **The mark is
  sticky**, because a key does not stop animating in code when somebody overrides it; making
  it the latest read's answer instead cleared the badge the moment the field was edited, and
  took `sampled` off the change with it.
  - **What that reading cannot answer is whether an override bound**, and the first version
    tried: a field with a draft whose reading differed from the draft was reported as *the
    preview is no longer applying this value*. It differs **by construction** — the reading is
    pre-override — so the refusal fired on every edited field the moment the playhead moved.
    There is no merged reading to ask for: `computeEffectiveSchemaValuesDotNotation`'s result
    stays inside the wrapper and `controls` carries only the pre-override values. The
    detector is gone rather than left firing; a runtime that genuinely refuses an override
    already says so in `tune.set`'s own answer, which is where the per-row refusal comes from.
  - Because the `from` of an animated key is a runtime sample rather than a line of source, its
    `TuningChange` carries `sampled: true` and reaches the agent as
    `from (runtime value at frame N, animated in code; change the landing value, not the
    frame)`.

### Tuning what you pointed at

Clicking an element that declares an `InteractivitySchema` — `Interactive.withSchema()`, its
`controls` passed to its own `<Sequence>` (REM-6) — opens a **properties pane** to the right of
the preview. Every supported field rerenders the preview as it changes; `Add` keeps that live
result on screen and hands the agent a `{path, from, to}` diff to write into the TSX.

- **It is a pane, not a card over the frame, and that reverses the design's own first
  answer.** #6 said "no fourth global panel" and grew the anchored comment card into an
  inspector instead; on a real project that card was too small to work in, needed scrolling for
  three fields, and covered the frame whose change you were judging. So the inspector is a
  fourth `ResizablePanel` beside chat and preview — full height, dragged to width, remembered
  by the layout store like the other two. `panelIdsOf` gains the combination rather than a
  flag, because the stored layout is keyed by the id list and a two-pane width must not be
  read back into a three-pane window.
- **The pane exists while there is something in it.** It is mounted by a selection carrying a
  schema and unmounted by Cancel, so it is never an empty rail taking a third of the window.
  Closing it *is* Cancel — the originals go back — which is why the × says so on its tooltip.
- **An element with no schema keeps the compact card over the frame.** Two surfaces for one
  selection is a real cost, and it buys the case that matters: a quick comment on something
  that has nothing to tune should not move the whole window.
- **It is shaped like a design tool's inspector, because that is what people already know
  how to use.** The row is two columns — the name outside the control, the value inside it
  and left-aligned — and every control is the same compact `h-7 rounded-md control-surface`
  field, so a section reads as a column of names beside a column of values rather than a
  stack of self-contained widgets. Sections carry a sentence-case heading in the foreground
  colour, separated by rules that run the full width of the pane, ordered the way an
  inspector orders them: Transform, Layer, Typography, Fill, Stroke, the component's own
  Parameters, then Entry/Exit/Effects and Timing last. `control-surface` and
  `--elevation-control` are lifted from remocn.dev's component customizer.
- **Every number is one control, and it takes all three gestures.** `Scrubber` is a Base UI
  `NumberField` whose whole surface is the scrub area: dragging anywhere changes the value,
  pointer-locked with a cursor of its own; arrows step, shift steps by ten (`largeStep`),
  alt steps finely (`smallStep`). A click that never moved drops into typing — Base UI
  focuses the input on pointerdown and re-dispatches the click that pointer lock swallowed,
  and the field answers by taking its overlay off the input until it blurs. A *bounded*
  number paints how far along it is as a fill behind the value (`fractionOf`), because "how
  far along is this" is a question a number alone cannot answer at a glance — the separate
  track beside the field was the first version, and it read as two controls for one value.
- **Easing is an interpolation editor, not a dropdown.** A field whose path ends in
  `easing`/`ease` gets a curve card: the bezier drawn in a 100×100 view with headroom for
  overshoot (`lib/studio/easing.ts` holds the geometry, the name→bezier lookup — CSS names
  plus the Penner families in any casing — and the preset table), a preview dot whose
  `animation-timing-function` *is* the value being edited, and a preset picker. What is
  editable follows what the component can hold: a **four-number array** drags its handles
  (`useBezierDrag`, x clamped to [0,1] as `cubic-bezier()` requires, y allowed overshoot)
  and edits the four numbers as scrubbers; an **enum** of names can hold one of its own
  options and nothing else, so its curve is a reading and the picker is what changes it —
  and handles are drawn *only* where they can be dragged, or the card would show a grab
  target that does not move. That is why the conventions require the array and forbid the
  enum: the shape of the prop is what decides whether the curve is an instrument or a
  picture. A spring is deliberately not a tab here — it is ordinary damping/stiffness
  props, which already render as numbers.
- **Telling the agent was not enough, because a bundled skill tells it the opposite.**
  `remotion-interactivity`'s own words are *"the output range, easing, extrapolation and
  `output` property should use hardcoded values"* — right for Remotion Studio, which
  rewrites the call site, and wrong here, where the panel edits props at runtime. Given
  both, an agent wrote a whole video of `easing: Easing.out(Easing.cubic)` and left a
  comment saying that was *"the only shape the panel can pick up and edit"*: confidently
  backwards. The vendored tree cannot be edited (`skills:check` reads any change as
  drift), so the conventions now name the disagreement and overrule it on that one line,
  and — because an instruction contradicting a loaded skill is a coin flip —
  `sidecar/tools/tunability.ts` scans the video's own source. It is **seven rules, not one
  regex**: a constant easing (error), a spring whose physics are nailed shut (info), a run
  of text in a plain `div`/`h1`/`p`/`span` with no `Interactive.` ancestor (warning), one
  literal `name` shared by every instance a `.map()` renders (error), a curve whose window
  defaults to zero and so is never sampled (info), a schema component that never forwards
  its `controls` (error), and a raw export of the component `withSchema` wraps (error).
  They are **merged into `design_check`'s own `findings` array**, with a `tunability_*`
  code and their severity counted into its `summary` — prose appended after the JSON could
  not be a finding, and the review stage's done-condition is "every mechanical finding
  fixed or explained". That gate was chosen over a new tool precisely
  because the conventions already require calling it before finishing: a tool the agent
  may forget is no gate at all. It reads only the turn's own video folder, never a
  sibling's, and a source it cannot read costs nothing — the design check the agent is
  waiting on must not fail over a courtesy.
- **The scanner is a mask plus a tag stack, never an AST.** An AST would cost the sidecar
  bundle megabytes to answer shapes a mask already answers: comments are blanked and string
  and template *bodies* replaced character-for-character with `x`, delimiters kept, so every
  index and line number still lines up with the file the agent wrote. Three corpus shapes are
  what it is written against and each is a test — a `>` inside `style={{ … }}`
  (`enterBlur > 0`) is not the end of an open tag, a `.map(…).join(", ")` that finished
  before an unrelated primitive is not an enclosing region, and an `Easing.bezier(` whose
  arguments are all identifiers or a spread is prop-fed rather than constant. Two more are
  the shapes a mask gets wrong if you let it: an open tag's children are sliced only to the
  next `<`, so a `{list.map(…)}` child leaves an unmatched `{` behind and the residue must
  be cut rather than read as a text run, and the literal-`name` test is anchored
  `(?<![\w-])` so `data-name` cannot stand in for the primitive's own `name`. Measured over
  the eleven videos of `remocn-news-videos`: **75 findings** — constant-easing 51,
  constant-spring 9, inert-easing 8, plain-text-element 6, mapped-primitive-name 1, and zero
  of the last two, because those videos were generated after the schema conventions landed.
- **A composite control is a stack, not a row, and it shares the pane's edge.** dialkit's
  convention is a self-contained pill — label inside, value inside, one surface — and the
  easing editor cannot be one: it is a canvas, a picker and four numbers. Forcing it into
  the old row grid reserved a label column the pills do not have, so the whole block sat
  in a narrower second column and the pane read as two competing alignments. It now uses
  `dialkit-composite-control`, which the X/Y pairs had already settled: the label on its
  own line, everything under it at the pane's own edge, and the reset action in the same
  slot every other control puts it in. Two supports: the row gap is wider than the gap a
  description keeps to its control, so the prose reads as belonging to the row above it
  rather than floating between two; and the `title` that gives a clipped label back lives
  on the pill, not on the row, or hovering the curve would raise a tooltip for a label
  that was never clipped.
- **A label is one clipped line; the sentence goes under the control.** A schema's
  `description` used to *be* the label, which was right for Remotion's own built-ins — they
  describe themselves in two words ("Font size", "Opacity") and read better than the path
  would — and wrong for everything an agent writes, which is prose: *"Frames per drift
  cycle — kept coprime with the ambient periods"* wrapped out of dialkit's 36px row and
  landed under the next control. `labelFor` takes the description only while it is short
  enough to be one (24 characters), and otherwise humanises the prop's own name; the
  description then renders as prose below the row, where it has the pane's width to wrap in.
  Two supports under that: `labelOf` is sentence case, because Remotion's descriptions are
  and the two share a column; and dialkit's labels are clipped in `app/globals.css` —
  `.dialkit-slider-label` is positioned absolutely with no width of its own, and
  `.dialkit-labeled-control-label` is a flex child that refuses to shrink, so both had to
  be told. Clipping never loses the text: the row carries the label as its `title`.
- **A value that is really two numbers is edited as two numbers.** `lib/studio/tuning.ts`
  parses `"−12px 8px"`, `"50% 50%"` and `[0.5, 0.5]` into labelled axes and writes the
  chosen one back in the shape it arrived in, unit and all. Two subtleties are pinned by
  tests: a one-token value (`translate: 10px`) means x-only and CSS reads the other half as
  zero, so the panel offers both; and a bare `0` may legally drop its unit where a non-zero
  may not, so writing takes the unit from whichever half declared one and from the type when
  neither did. A value it cannot parse — `calc(100% - 4px)` — falls back to a plain text
  field rather than being guessed at.
- **Nothing the schema declares is dropped in silence any more, and two of the rules are
  coercions.** The pane whitelisted eleven field types and refused every value that did not
  match its declared type — which is how `fontWeight: 800` (a number, against 4.0.520's enum
  of *strings*) and `letterSpacing: "-0.03em"` (a unit string, against a number) vanished
  with nothing on screen to say so. The list gains `text-content` and `font-family`, and
  `readingOf` in `preview/tuning.ts` now answers for every value: a **number against an enum
  of strings** whose `String()` is one of the options becomes that option and stays editable;
  a **unit string against a number** keeps its row as a **read-only** one, so
  `Letter spacing  -0.03em` is visible and cannot be dragged; a `text-content` whose runtime
  value is not a string says *Text is built from parts — ask in words*; anything else keeps
  its row as *value in code*, printed through a guarded `JSON.stringify` — the catch-all is
  now on the path of every unreadable value, and a circular one (a React element carries
  `_owner` in development) throwing there would cost not its row but the whole `selection`
  message. The one thing still dropped is a key the runtime holds **no value for at all**: on
  4.0.520 a text element declares eight typography keys, and a component that sets none of
  them would otherwise draw eight rows reading `undefined`. `readOnly` rides the wire as an
  optional key (`field.readOnly === true`), like `TuningChange.sampled` and for the same
  reason — a decoding default would make it required in the decoded type.
- **Typography is grouped by what a key means, not by whether it is spelled `style.`.**
  `TYPOGRAPHY` matched `style.`-prefixed paths only, so a component's own
  `fontSize`/`fontWeight` — which is how every agent-written video writes them — landed under
  Parameters, one chip out from where anyone would look. Bare
  `color|fontFamily|fontSize|fontStyle|fontWeight|letterSpacing|lineHeight|textAlign` now
  group there too, `backgroundColor` falls to Fill, and a `children` field of the new
  `text-content` type leads that group.
- **Text is a field where the runtime has one, and a request where it does not.** Remotion
  4.0.513 adds `textSchema` and a `children` field of type `text-content`; 4.0.481 — what the
  template still pins — has no string field type at all, so nothing typographic can exist on
  a primitive there by anyone. So the selection carries the element's own words (`text`,
  non-null only when the innermost `Interactive`'s host node is one text node) and the loaded
  families (`fonts`, from `document.fonts`), and the pane opens a **Text** section above
  everything else labelled *sent to Claude, not previewed*. It changes no pixels and rides
  `tuningChanges` as `{path: "children"}` with the innermost component as its owner, so the
  agent is asked to change the words in the file. It exists **only** while the innermost
  target declares no live `children` field: on a Remotion that has one, the live field is the
  thing that moves the frame and a second textarea beside it would be a lie. Add rebases the
  draft exactly as it rebases the tuned values, and a stored selection chip carries `window`,
  `text` and `fonts` with it, so a reopened chip still has its time strip and its faces.
- **Opacity reads as a percentage and is stored as a fraction**, named by path rather than
  inferred from a 0–1 range, or every normalised parameter in a project would silently grow
  a percent sign.
- **`hiddenFromList` is honoured.** Remotion marks `from`, `durationInFrames`, `trimBefore`
  and `freeze` as belonging to a timeline rather than a property list; the panel is not a
  timeline, so it obeys, and those stay a sentence in the chat.
- **Colour is a swatch with an oversized native picker behind it plus an editable hex**, and
  a switch is the one control with no field behind it: it is already a surface, and a box
  inside a box is what that would be. Bare `<input type="number">` rows were the first
  version of all this and they read as a form rather than an instrument.
- **Focus is an `outline`, never a `ring`.** `control-surface` *is* a `box-shadow`, and a
  Tailwind ring utility sets `box-shadow` in the utilities layer — it would replace the
  surface and take the elevation with it. The inputs inside a field carry `outline-none`, so
  the field itself shows `focus-within` instead; dropping that would have been the one real
  accessibility regression in this pass.
- **Base UI keeps a slider's real control visually hidden**, so it carries no accessible name
  of its own and a role query cannot reach it: the thumb is named through `getAriaLabel`, and
  the test finds it by `input[type="range"]`.

- **Remotion's own interactivity runtime does the rendering, not a fiber-props mutation.**
  `preview/interactivity.tsx` provides three of the contexts the Studio would: a
  `RemotionEnvironment` claiming `isStudio` (which is the whole reason
  `withInteractivitySchema` hands a component its `controls` at all inside a Player), a
  synthetic `overrideId → nodePath` mapping, and the drag overrides themselves. The pixels
  stay the project's.
- **A drag override alone changes nothing, and that is the one thing to know here.**
  `computeEffectiveSchemaValuesDotNotation` reads `overrideValues[key]` only for a key that
  *also* carries a **prop status**; with `propStatus?.[key] ?? null` coming back null it takes
  `currentValue[key]` and the override is dropped on the floor. In the real Studio those
  statuses come from the server's analysis of the call site — inside a Player nothing
  publishes them, so the first version set overrides faithfully and moved nothing at all, in
  silence. `overridePlan` therefore publishes `{status: "static", codeValue}` for **exactly**
  the keys being overridden, and withdraws them with the override: a status left on a key
  with no override pins that prop to `codeValue` and freezes whatever animates it. It is a
  pure function so the pairing is a test rather than a thing to remember.
- **A runtime that cannot do it says so.** `setPropStatuses` missing means an override that
  merges nowhere, so `set` answers with a sentence instead of a cheerful `ok`, and a refused
  change now prints its reason on the card — reverting the row in silence is the same failure
  wearing a different coat.
- **`overrideId` is per call site, not per element.** `withInteractivitySchema` keys it off
  the JSX `stack` through a module-level map, so two `<Title>` in a file are two instances
  and two ids, while one `<Title>` inside a `.map()` is one id for every row it renders. That
  is Remotion's model and it is the right one: the edit is ultimately going to be written
  back into that one call site.
- **The pane says when an edit is shared.** One nodePath per `overrideId` is that model seen
  from the other side, so an edit on a primitive rendered from one call site genuinely moves
  every sibling — and it cannot be made per-instance through the contexts a Player exposes,
  because there is no per-instance key to publish an override against. `Shared by
  ${instances} · a change here moves all of them` under the title is the pane saying so
  rather than the person discovering it on the third line. `PropsPanel` is keyed on the
  innermost target's `instanceId`, so the comment draft and the focus effect restart per
  element instead of carrying a sentence typed for one line into the next.
- **A reset names paths, never a target.** The preview reads an empty path list as "drop this
  target's whole draft", and a `CameraRig` framing the scene is in *every* chain — so a card
  let go of used to take a camera change another card had already Added. `changedPaths` in
  `lib/studio/tuning.ts` is the one door every reset goes through: Cancel, Reset all, picking
  elsewhere, a rebuild, and removing a chip from the composer all send only the paths that
  card actually moved. `byTarget`'s empty-list branch — the last thing that could still emit
  `[]` — is deleted rather than left for a future caller to find: a reset naming no paths now
  sends nothing at all, which is the failure direction that keeps somebody else's work.
- **Reverting unsent edits says so, with Undo.** Picking elsewhere with pending changes raises
  a toast — `Reverted 2 changes on Pushed line` — whose Undo is a fiber interrupt on an
  `Effect.sleep` window and re-sends every value it took back, reopening that card. Same shape
  `hooks/use-library.ts` uses for a deleted asset, and the same ten seconds. Undo **abandons
  whatever card is open before it restores**: without that, edits made on the element you had
  moved to would be left live in the preview with nothing listing them — the exact failure
  `abandon` exists to prevent, arriving by the back door. Cancel raises no toast, because the
  × already says on its tooltip that it restores the originals.
- **A refusal belongs to a row, not to the pane.** `tuningRefusal` carries
  `{message, path, targetId}` and renders under the control that asked for it; only a refusal
  with no path of its own — a reset, or a runtime that named no field — keeps the footer line.
  A later `ok` clears it for that same target and path and nothing else, and an `ok` for a
  request nothing recorded clears nothing at all: `abandon`, a rebuild and removing a chip all
  mint request ids without registering them, so treating an untracked answer as good news let
  an unrelated reset wipe a refusal the row was still showing.
- **A refusal names the frame, and the window is read from Remotion rather than summed.** An
  element off screen at the playhead cannot take an override, so the sentence is *This element
  is not on screen at frame 42. Title runs from frame 30 to 120.* Two things in
  `preview/timing.ts` are measured corrections to the obvious implementation. Summing
  `memoizedProps.from` up the fiber chain **triple-counts** — an `Interactive.Div` is three
  fibers deep (`withInteractivitySchema`, the inner `forwardRef`, the `Sequence`), so a
  `from={30}` reads as 90 — which is why the window comes from Remotion's own
  `SequenceContext` value, `cumulatedFrom + relativeFrom`, already absolute and counted once.
  And capping the end at `min(duration, 60)` would report a 300-frame scene as ending 60
  frames in, making the sentence lie about the one thing it exists to say; 60 survives only as
  the fallback for a sequence with no finite duration.
- **A stored selection keeps the whole chain**, not the one link that was edited:
  `SelectionTuning` is `{open, originals: Record<targetId, Record<path, TuningValue>>,
  targets}`, so reopening a chip lands on the link the message was written from, and removing
  one resets every link it carried rather than only the one that happened to be on screen.
- **The agent's block groups the changes by who owns them.** `TuningChange.owner` carries the
  component, its `name`, and its file and line, and `sidecar/agent/prompt.ts` heads each run
  with `Requested changes on Title ‹headline› (src/videos/intro/Title.tsx:24):`. A flat list
  of paths taken off a three-link chain read as one component's props and sent the agent
  editing the wrong file; the heading is what makes a chain's diff writable. `owner` is
  `Schema.optionalKey`, so a turn stored before it existed still decodes.

### Taking a picture of the frame, and sending it

Snapshot: pause, click the frame for the whole thing or drag a rectangle for part of it, and
the pixels land in the composer as an ordinary attachment with an `[Image #N]` token (#21).
It answers *look at this*, where Inspect answers *change this*, which is why the two are
separate buttons and mutually exclusive rather than one mode with a switch.

- **A snapshot is a `PromptAttachment` and nothing new.** The feature adds a way to *create*
  one; `shared/ipc.ts`, the transcript fold, the history store, `content.ts`, the cards and
  `[Image #N]` are all untouched, so history, deletion and renumbering are correct on day one
  because they are not being changed. `useComposer.capture(file)` is `onPaste` without the
  clipboard, so the file goes through the same raw-body invoke into `pasted-images` — which
  is also why a snapshot survives on disk and old sessions keep their pictures.
- **One bundle serves the Player and the renderer**, because `@remotion/bundler`'s `bundle()`
  only puts `@remotion/studio/renderEntry` into the same `entry` slot `preview/entry.tsx`
  occupies. Measured on `remocn-demo`: the hybrid costs ~20 KB over Player-only, against a
  second full compile (~7 s, 1.67 GB peak) for a second bundle. Three things make it work,
  and each cost a failed run:
  - The alias `@remotion/studio/renderEntry$` goes **before** the base config's aliases —
    Remotion pins `"@remotion/studio"` to a *file* and webpack matches by prefix, so the
    subpath otherwise resolves to `dist/index.js/renderEntry`. It resolves to
    `dist/esm/renderEntry.mjs`, exactly as `bundle()` does.
  - A `{ include: renderEntry, sideEffects: true }` module rule, so nothing can tree-shake a
    module imported purely for `window.getStaticCompositions`.
  - The page needs `#video-container`, `window.siteVersion = "11"` and
    `window.remotion_version`; `video-container` is read at module scope, so it has to be in
    the HTML before the bundle loads.
- **Two pages, one bundle, and each page is what decides which half runs.** The preview page
  carries `#__remotion-studio-container` and no `#video-container`; the render page, served
  at `/__remocn/render/index.html`, carries the opposite. Our entry already returns early
  when `getPreviewDomElement()` is null, so the Player simply never mounts for a render — no
  new flag was needed. The render page's siblings resolve from the same prefix, so
  `bundle.js` and its sourcemap load next to it.
- **The preview page sets `remotion_puppeteerTimeout` on purpose.** It is the only signal
  `renderEntry` has for "headless", and in its absence the index branch mounts a read-only
  **Studio** into `#video-container` and flips `remotion_isStudio`. Setting it to 30000 — the
  value `delayRender` already defaults to — makes that branch return early and changes nothing
  else, since `isRendering` additionally requires `NODE_ENV` to be production. Verified in a
  real headless Chrome against `remocn-demo`: `remotion_isStudio` false, `#video-container`
  absent, the Player mounted with a 1280×720 canvas.
- **The render page declares `NODE_ENV=production`, and that is load-bearing.** The first
  working end-to-end render came out **blank white**: the preview compiles with
  `environment: "development"`, so `getRemotionEnvironment().isRendering` was false and
  Remotion rendered nothing into the portal. The page sets
  `window.process = {env:{NODE_ENV:"production"}}` before the bundle, and
  `remotion_envVariables` to `""` — with a truthy value `setup-environment` overwrites
  `NODE_ENV` with the compiled one, and with a falsy one it assigns nothing and ours survives.
  With that, the still is **byte-identical** to `npx remotion still` on the same frame.
- **Only frames may reach the host's stdout, and third parties do not know that.** Remotion
  forwards browser console output to stdout during a render, which put `[Tab 0, …]` lines into
  the frame channel. The host swaps `process.stdout.write` and the stdout `console` methods
  onto stderr at startup, keeping the real writer for `write()`. Patching `console` as well as
  the stream is not belt and braces: under bun `console.log` bypasses `process.stdout.write`.
- **The host is asked over its own stdin**, in the frames it already answers in — no second
  transport for one method. `preview.still` carries `{ projectId, composition, frame }` and
  answers with a path; the supervisor keeps a registry of running hosts keyed by project and
  a pending map keyed by request id, so a still for a project with no preview fails with a
  sentence rather than hanging. Stopping the preview fails everything still pending.
- **Cropping and downscaling happen in the webview, through `<canvas>`.** The host renders a
  full frame to a temp file, the webview reads it over the asset protocol, crops, downscales
  to ≈1568 px on the long edge and hands the bytes to the invoke that already stores pasted
  images. No image library reaches the sidecar or Rust. Cropping *before* downscaling is what
  keeps detail in a small region.
  - **The still is loaded `crossOrigin="anonymous"`, and it has to be.** The asset protocol is
    a different origin from the window, so a plain `<img>` load taints the canvas and
    `toBlob()` throws `SecurityError` — WKWebView words it *"The operation is insecure."*, with
    nothing in it to say which operation. Tauri answers every asset request with
    `Access-Control-Allow-Origin: <window_origin>` (`protocol/asset.rs`), so asking for CORS is
    all it takes. Displaying an attachment never needed this, which is why the cards worked
    long before the first snapshot did.
- **The rectangle is normalised to the composition in the page**, which is why a box drawn on
  a small preview crops the same region on a large render — the app only ever multiplies by
  the resolution `selectComposition` reported. That is a different transform from Inspect's,
  which normalises to the page viewport to draw markers; both are pure and tested.
  `.__remotion-player`'s rect *is* the video box (the Player scales that div by transform), so
  the contain-fit in `videoBox` is a no-op there and insurance if that ever changes.
- **A tiny drag is a click**, so a shaky hand cannot hand you a four-pixel picture, and the
  marquee is drawn inside the preview document for the same reason Inspect's box is.
- **Each capture sweeps the stills folder first** and writes a uniquely named file, which is
  safe because the composer refuses a second capture while one is in flight — and that refusal
  is also what story "a second of work must not read as a dead button" is made of.
- **`ensureBrowser` runs before every render with its progress surfaced.** It is the one place
  this feature touches the network. The render also carries a `delayRender` timeout and the
  whole capture an outer one, so a scene that never resolves fails with a sentence instead of
  hanging the app.
- **The render options come from `remotion.config.ts` too**, read the way the CLI reads them:
  `renderOptionsOf` loads the config and then asks `@remotion/renderer`'s own option objects
  for their values, so `Config.setChromiumOpenGlRenderer`, `setDelayRenderTimeoutInMilliseconds`,
  the chrome mode and the rest apply to a snapshot exactly as they apply to `npx remotion
  still`. That is the whole point of rendering through the project's renderer, and it is why
  there is **no invented default**: `--gl=angle` changes the pixels of a render that uses no
  WebGL at all (verified: different hash, visually identical antialiasing), so defaulting it
  would move every project's snapshot away from what its own export produces.
  - **A WebGL scene is the case this decides.** Remotion's default GL backend is `null` — no
    `--use-gl` flag — so the render browser has no GL context, a shader never compiles, and a
    component that only calls `continueRender()` after a successful draw hangs until the
    timeout. `remocn-neon`'s aurora fails identically under the stock `npx remotion still`,
    which is the tell that this is the project's setting to make and not ours to guess. The
    failure says so: a message mentioning `delayRender()` gets the reason and the config line
    appended to it.
- **A capture costs one page load, and it used to cost two.** Measured on `remocn-demo`:
  `openBrowser` 195 ms, `newPage` 187 ms, **`goto` 3319 ms** — the navigation *is* the cost, and
  it is the project's doing, not Remotion's: that one page pulls **19.9 MB over 71 requests, 64
  of them fonts**, because `@remotion/google-fonts` fetches at runtime and holds a
  `delayRender` until it is done. `selectComposition` and `renderStill` are ~2.9 s each for
  exactly that reason — one page load apiece.
  - **Reusing the browser buys nothing** (5799 ms → 5900 ms across a shared instance, measured):
    Remotion opens a fresh page per call and the cache does not carry, so there is no pool here
    and no state to manage.
  - **What does buy something is not measuring twice.** The `VideoConfig` from
    `selectComposition` is cached per composition in the host and passed straight to
    `renderStill`, so a capture navigates once: **8.4 s → ~3.6 s**. The cache is dropped in the
    same callback that notifies the page of a rebuild, so a recompile can never be captured
    against a stale composition.
  - **And doing it before the click.** Arming Snapshot fires `preview.warm`, which measures the
    composition while the user is still aiming — 4.4 s that used to sit inside the first click.
    Commands are handled sequentially on the host's stdin, so a click that lands mid-warm waits
    for it rather than starting a second navigation.
  - **A capture navigates zero times, because the page stays open.** `renderStill` is a
    sequence — size the page, `setPropsAndEnv` (which navigates), `remotion_setBundleMode`,
    `seekToFrame`, `takeFrame` — and only the navigation is slow. `sidecar/preview/session.ts`
    holds the page open past the first four steps, so a capture is just the last two:
    **83–122 ms**, byte-identical to `npx remotion still` on the same frame. That is the whole
    point of Snapshot being a *look at this* gesture: it has to answer at the speed of a click.
  - **The price is naming six of Remotion's internal modules** — `set-props-and-env`,
    `seek-to-frame`, `take-frame`, `puppeteer-evaluate`, `prepare-server` and `openBrowser` —
    reached the way `dist/options/*` and `@remotion/cli/dist/entry-point.js` already are.
    `warmInternalsOf` returns `null` if any export moves, and the host then falls back to
    `renderStill` per capture: slower, never wrong. An upgrade can cost the speed but not the
    feature.
  - **The warm session starts its own offthread-video proxy, and the placeholder it replaced
    made every video unrenderable** (REM-312). `OffthreadVideo` builds each frame request from
    `window.remotion_proxyPort`, which `setPropsAndEnv` writes into the page — so the `0` this
    passed produced `http://localhost:0/proxy?…`, which Chrome refuses outright as
    `ERR_UNSAFE_PORT`. The `delayRender()` the video holds then never cleared and the capture
    died on Remotion's own guess: *"could be caused by Chrome rejecting the request because the
    disk space is low"*. Nothing about disk space was involved. `renderStill` never had the bug
    because `makeOrReuseServer` prepares a proxy per capture and hands it the real port; the
    warm session now calls the same `prepareServer` with the same arguments, before the browser
    — the port has to be in the page's environment from the first navigation — and closes it
    with the session, or with the failure if the page never opened. It cost `design_check` on
    every video that uses footage, which is the gate the conventions require before finishing a
    scene. Verified end to end against `remocn-studio-teaser`: a still on a frame inside the
    `OffthreadVideo` scene now renders the footage.
  - **A page with no source map throws on every line it logs.** `newPage` takes the getter as
    `context`, and the `null` passed there before — there was no server to take one from —
    made Remotion's own log handler fail with `this.sourceMapGetter is not a function`, 916
    times in this machine's log since July. That is how an `ERR_UNSAFE_PORT` came to be buried.
    `prepareServer` returns `sourceMap`, so it is passed; measured, the same run goes from 13
    of those TypeErrors to none.
  - **The session is keyed by composition and dropped on rebuild**, in the same callback that
    forgets the measurement — a page holding the old bundle would capture code that no longer
    exists. The webview already disarms on rebuild, so re-arming re-warms.
  - **Two orderings are load-bearing and cost three iterations to find.** The viewport is set
    *before* navigating, as `renderStill` does. And `remotion_calculateComposition` cannot
    replace `selectComposition` on the warm page without `waitForReady` between the evaluation
    `setBundleMode` and the call — without it the page reports *"Available compositions:"* and
    nothing else, because `setBundleMode` re-renders asynchronously. Measuring still costs its
    own navigation; it is cached, so only the first arm pays.
  - **Do not trust a stored hash as a fidelity baseline.** A PNG rendered hours earlier
    disagreed with a fresh one, and the warm session was blamed for it — but the stock CLI
    produced the *new* hash twice in a row. Whatever the project's runtime font loading resolves
    to is machine state, not a property of the renderer. Compare against a control rendered in
    the same session, or the comparison measures the clock.
  - **The floor for the warm-up is the project's.** One navigation is ~3.3 s, and a project that
    loads six Google font families with every weight pays most of it. Remotion says so in its
    own log — *"Consider loading fewer weights and subsets by passing options to loadFont()"* —
    and that is a change in the project, not here.
- **This was the first slice of Export**, which needs the same three things: the renderer
  resolved from the project, the browser provisioned, and progress reported. See *Exporting*.

### Exporting an mp4

The Export button renders the playing composition to `out/<Composition>.mp4` through the
**project's own** `@remotion/renderer`, with progress, cancellation and a reveal in Finder (#227).
Format and quality settings, a queue and Lambda are out of scope: this renders h264, and every
other knob comes from the project's `remotion.config.ts`, read the way a snapshot reads it.

- **There is no second bundle, and that is the feature.** #227 says "bundle the project, render
  the composition" — but the preview host has *already* compiled that project and is serving the
  render page it compiled, so `preview.export` renders from the same `serveUrl` a snapshot uses.
  A second `bundle()` would cost another ~7 s and 1.67 GB peak for a byte-identical result, and it
  could differ from what is on screen — which is exactly what the acceptance criterion "content
  matches the preview" forbids. So bundling progress is the preview's existing `building` events,
  and Export is unavailable until the preview is serving rather than starting its own compile.
- **The renderer is resolved, then checked.** `renderMedia` and `makeCancelSignal` come off the
  same project module the stills already use; `exporterOf` refuses a Remotion too old to export
  with rather than throwing `undefined is not a function` mid-render. `agreedVersionIn` then reads
  `remotion`, `@remotion/renderer` and `@remotion/bundler` out of the project's `node_modules` and
  refuses when they disagree, naming **every** package that drifted — a renderer a hundred patches
  from the `remotion` the preview compiled would not match the preview, which is the one thing an
  export must never do.
- **The render writes a dotfile and is renamed at the end.** A cancel or a failure must not leave
  a half-written `Main.mp4` that looks finished, and must not destroy the export from ten minutes
  ago; rendering to `out/.Main-<token>.mp4` and renaming on success gets both, since the rename is
  atomic and the cleanup only ever removes the partial. The removal is an `acquireRelease` acquired
  *before* the render, so it releases *after* it — finalizers run in reverse.
- **Cancelling waits for Remotion to stop before deleting anything.** `Effect.callback`'s cleanup
  runs on interruption and is awaited, so it calls Remotion's `cancel()` and then awaits the
  `renderMedia` promise settling. Without that wait the partial file would be removed while ffmpeg
  was still writing it, and the write would recreate it. Ten seconds is the grace; past that the
  file is removed anyway, because a renderer ignoring its own cancel signal must not hang a quit.
- **The export is forked, because the host's stdin loop is sequential.** `Stream.runForEach` over
  stdin serves one command at a time, so a `cancel` frame arriving during a three-minute render
  would not be *read* until the render finished. The export therefore goes into a `FiberMap` keyed
  by request id: `FiberMap.remove` is the interrupt, `FiberMap.size` is the one-at-a-time gate, and
  keying by id means a late cancel for a finished export cannot kill the next one. The map belongs
  to the host's scope, so quitting interrupts the render, which is what runs the cleanup above —
  and the host is already in the sidecar's process group, so its Chrome goes with it.
- **The webview cancels by interrupting a fiber, and the frame reaches the host.** `ask`'s
  interruption finalizer in `sidecar/preview/supervisor.ts` now sends `{type:"cancel", id}` to the
  host, guarded on `pending.delete(id)` returning true so a request that already answered cannot
  emit a spurious cancel. `causeMessage` returns null for an interrupt, so a deliberate cancel
  leaves no error on screen.
- **Progress is folded in the host and worded in the webview.** `renderMedia` reports
  `{renderedFrames, encodedFrames, progress, stitchStage}` and the host turns it into one
  `progress` event; `exportStatus` in `lib/studio/export.ts` decides whether that reads
  *Rendering — 64/300 frames*, *Encoding*, or *Combining the audio and the video*. Same split as
  `lib/studio/runs.ts` against the transcript fold: numbers cross the wire, sentences do not. The
  frame count is seeded from the measured composition so the first event already has a denominator,
  and `stitchStage` is normalised to the two values the schema knows — an unknown future stage
  would otherwise fail the stream decode and drop the chunk.
- **There is no outer wall-clock timeout**, unlike a snapshot's. A long render is the normal case;
  a frame that never resolves is already bounded by the project's own `delayRender` timeout, and
  that failure arrives with the WebGL explanation the stills share.
- **A rebuild does not cancel a running export.** Remotion loads the page once per tab when the
  render starts, so an agent saving a file mid-render does not swap the code under it — and killing
  a three-minute render because a file changed would be worse than the risk. The composition
  measurement is still dropped on rebuild, so the *next* export measures again.
- **The export state carries the project it belongs to.** Switching projects therefore hides that
  result without a reset effect, and switching *back* shows a render that is still going. A running
  export in another project is the reason the button can be disabled, and it says so rather than
  going quiet.
- **Measured against `remocn-demo`**, driving the host by hand: `thumb-introducing-remocn` exports
  to a 29,974-byte h264 1280×720 mp4 with an AAC track, and the frame decoded out of it is the real
  cover art — the *blank white* the render page's `NODE_ENV=production` exists to prevent. On the
  1012-frame `introducing-remocn`, progress climbed by frame count and a cancel at 152 frames left
  the 42 MB mp4 an earlier CLI render had put in `out/` **byte-identical**, with no partial beside
  it. `SIGTERM` to the host alone — harsher than a quit, which signals the whole process group —
  exited 0 and left no `chrome-headless-shell` behind.
- **`contact-sheet` cannot be exported, and that is the project's doing**: it loads
  `staticFile("thumb-previews/introducing-opus-5.png")`, which is not on disk, so the render fails
  on the image and would fail the same way under `npx remotion render`. Worth knowing before
  reaching for it as a cheap export target.

### The environment checklist

`project.check` runs when a folder is opened and answers, in one report, the things the app depends
on but does not own (#228). It renders above the composer — an approval is a thing to answer, and so
is this — and renders **nothing at all** once every row is `ok` or `pending`, which is what "gets out
of the way" means. It re-runs on opening a project, on Recheck and after an install, never per turn.

- **Authentication is a control request, not a turn.** `Query.accountInfo()` opens the CLI, asks, and
  closes: measured 1.6 s logged in, 0.7 s logged out, and no model call in either. Logged out answers
  `{ tokenSource: "none", apiProvider: "firstParty" }`; logged in answers `email` +
  `subscriptionType` + `apiProvider` and **no `tokenSource` at all**, so `tokenSource === "none"` is
  the discriminator and everything else is authenticated. A non-`firstParty` `apiProvider` is
  authenticated externally (AWS creds, gcloud ADC) and says so.
- **`claude` is the person's own Claude Code, resolved and never bundled** (REM-309). The
  SDK's `pathToClaudeCodeExecutable` is only an override, and without it the SDK looks for
  its optional-dependency binary — which the release `.app` does not carry, so a clean Mac
  failed every turn with *Native CLI binary for darwin-arm64 not found*; it worked on the
  developer's machine only through the bun-cache fallthrough recorded below. `findClaude`
  in `sidecar/claude/cli.ts` walks `$REMOCN_STUDIO_CLAUDE` → `$PATH` → `~/.local/bin` (the
  native installer's target), `~/.claude/local`, `~/.bun/bin`, `~/.npm-global/bin`, Homebrew
  and `/usr/local/bin`, and both the account probe and the turn pass the answer to the SDK.
  No version check on purpose: people update Claude Code often, and a mismatch surfaces as
  the SDK's own error under *could not start*. The four resolvers share `findExecutable` in
  `sidecar/agent/cli.ts`, which takes its host so the walk is tested without a filesystem.
- **A provider row is three steps, not a sentence.** `PROVIDER_SETUP` in `shared/providers.ts`
  is the static table — install command and page, sign-in command, and Claude's note that
  Claude Desktop does not count — and a provider row's `fix` is `{ type: "provider", step }`
  naming only the step that is not passed; `stageStates` in `lib/studio/setup.ts` turns that
  into ticks. **The studio signs nobody in**: Anthropic does not allow third-party claude.ai
  login, so *Open in Terminal* copies the command and opens an empty window through
  `osascript` (`terminal.rs`) and the card says "⌘V, then Enter". Nothing is executed,
  no Accessibility permission is asked for. While a provider row is failed the window's
  focus forces a recheck (`useRecheckOnFocus`, once per five seconds), so coming back from
  Terminal turns the row green without a button. The model menu's failed group is a link to
  Settings › AI Accounts on that provider rather than a disabled row with a label.
- **Only being logged out locks the composer.** A folder that is not a Remotion project does not:
  asking Claude to set one up is a reasonable next move, and refusing to talk to it would remove the
  only tool that could fix it.
- **A Remotion too old for the properties pane is a warning, and the studio never upgrades
  silently.** Remotion only started declaring typography and text on its own elements in
  4.0.513 (`textSchema`/`textContentSchema` on every text tag), so below that the pane can
  edit neither text, weight, size nor colour — and saying nothing would leave a whole feature
  quietly absent. The `remotion` row therefore warns, with an *Upgrade Remotion* button that
  runs `project.upgrade`: `pmOf`'s manager, `bun add` / `npm install` / `pnpm add` /
  `yarn add`, `name@4.0.520` for every `@remotion/*` the manifest declares plus `remotion`.
  It is the same shape as the Node.js row and for the same reason (*A project installs with
  its own package manager*): the studio names what it will run and the person presses it.
  Three things about it are deliberate.
  - **It reads what is installed, not what the range allows.** `installedVersion` walks up to
    `node_modules/remotion/package.json` and the declared range is only the fallback, because
    a project on `^4.0.481` with 4.0.520 actually resolved has a working pane and must not be
    told otherwise. **A range it cannot read stays `ok`** — a caret, a tilde or a `>=` are
    stripped, and `*`, `4.x` or `workspace:*` are given up on rather than guessed at, because
    telling somebody their version is wrong when it cannot be read is worse than saying
    nothing.
  - **The `add` runs in the manifest the row read**, not in the lockfile's directory the way
    `install` does. For a workspace member those differ, and adding at the workspace root
    would write the pin into a `package.json` the row never looks at — the row would stay
    amber after a successful upgrade — while `yarn add` at a workspace root refuses outright
    without `-W`. `pmOf` still resolves the *manager* from the lockfile; only the working
    directory moved.
  - **`warn` does not lock the composer** — only a failed login does — and it no longer
    claims the project is broken. The card's heading is `troubleHeading`: *This project has
    one thing worth fixing* when every trouble is a `warn`, and the old *This project is not
    ready to run* the moment one has failed. Without that, every project on 4.0.481 — which
    today includes one scaffolded by this studio a second ago — wore a permanent banner
    saying it could not run, about a project that compiles, previews and exports.
- **`bun install --dry-run --frozen-lockfile` never looks at `node_modules`.** Measured: byte-identical
  output and exit 0 with `node_modules` deleted, because it only resolves the graph. It exits 1 for
  exactly one thing — `package.json` drifted from `bun.lock` — and it writes nothing at all, no
  lockfile and no `node_modules`, which is what makes it safe to run against the user's project. So it
  is the *drift* half of the dependency check and cannot be the *installed* half.
- **Resolution cannot be the installed half either, and that one is a trap.** Under bun,
  `createRequire(…).resolve()` answers out of **`~/.bun/install/cache`** — `typescript` resolved to
  `~/.bun/install/cache/typescript@7.0.2@@@1/package.json` for a project with no `node_modules`
  directory whatsoever. Worse, the drift check *populates* that cache, so running it made the next
  installed-check lie about the same project. `isInstalled` therefore looks for
  `<dir>/node_modules/<name>/package.json` on disk, walking up so a workspace hoist still counts, and
  bun's cache never does. This is also why `resolveFrom` in `sidecar/preview/project.ts` is a
  can-I-import check and not an is-it-installed one.
- **Offline is not an accusation.** `driftFrom` reports drift only when bun's error line mentions the
  lockfile; any other non-zero exit — a network failure, most likely — reports nothing rather than
  telling the user their lockfile is wrong.
- **One root cause is one row.** A folder with no `package.json` used to produce three failures
  (not a Remotion project, dependencies unknown, no entry point) for one fact. `checksFor` now omits
  the rows that are unanswerable rather than failing them: no manifest drops dependencies *and*
  entry, and a manifest without `remotion` drops entry alone, since dependencies is still true and
  still fixable.
- **The composition row is the preview's answer, not a second one.** The page already posts
  `{ compositionId, reason, total }` and `usePreview` already keeps it; `compositionRow` folds that
  into the checklist, so `total === 0` fails and `reason !== "main"` warns. Until the preview has
  compiled, the row is `pending` — which is quiet, or a project whose preview is not running would
  show the checklist forever. It is folded in **only when the preview's project is the open session's
  project**, because those two can diverge exactly as they do for Inspect.
- **The account probe is cached per sidecar process** and `force` — Recheck — is what clears it, so
  switching projects does not pay for it again. Warm, a whole report costs 250–800 ms.

### Tips, not a tour

The features nobody finds on their own — Inspect, Snapshot, `[Image #N]` on ⌘V, the
asset library, the plan drawer, turns that keep running while you look elsewhere — each
get one anchored card, the first time they are genuinely usable (REM-253).

- **A tip appears when its feature does, not on first launch.** A ten-step tour at
  startup is a wall that gets closed unread, and half its steps would point at controls
  that are not on screen yet: Inspect is off until the preview has compiled, the plan
  drawer does not exist until the agent writes a plan. `isAvailable` in
  `lib/studio/tours.ts` is the whole rule, and it is also what guarantees the anchor
  exists — a tip is offered only while the thing it points at is on screen.
- **The catalog is data.** One entry per tip — id, title, body, which side of its anchor
  it sits on — and a pure `nextTip` over the states the studio already keeps
  (`TourStage`). So "what can be shown, and when" is a table test rather than a walk
  through the running app, and the components decide nothing.
- **One at a time, by construction.** `nextTip` answers with a single entry, so there is
  no queue to drain and nothing that can put two cards on screen at once. Catalog order
  is the priority when several features become available together.
- **Nothing competes with something already asking.** A permission card, a wizard, the
  environment checklist, the Settings dialog: `isBlocked` withholds every tip while one
  of those is up. Availability alone is not enough either — a tip waits out a two-second
  dwell first, so a pane opened on the way somewhere else never flashes a card.
- **The anchor is named by the tip.** The element carries `data-tour="<id>"` and
  `tourAnchor(id)` is the selector, so the card and the thing it points at cannot drift
  apart; an anchor that is not on the page shows nothing rather than floating a card in
  the middle of the window. It is a Base UI popover positioned against that element —
  **no tour library**: driver.js and joyride bring their own overlay and their own
  styles, and an overlay over three resizable panes is exactly what this must not be.
- **"Got it" is remembered, clicking away is not.** `toursSeen` in `settings.json` holds
  the answered ids; an outside press or Escape drops the tip for this launch only and
  writes nothing, which is the forgiving direction. Settings → Behavior carries *Replay
  tips*, which is that list going empty.
- **"Show me" only reveals, never arms.** The library tip opens the Assets view, because
  that is one click the person could make themselves and undo the same way. Arming
  Inspect from a tip is deliberately not offered: a card that explains a mode must not
  put the app into it. The plan tip has no action at all — the strip it points at is the
  click it is teaching.
- **First-run prerequisites are not this.** Whether the app can work — a login, a
  runtime — is REM-10 and the environment checklist. The tips are about what the studio
  can do, and they start only once a project is open.

### A project installs with its own package manager

bun had two jobs and they break differently: it is the sidecar's runtime — now shipped, see *The
sidecar* — and it was also hardcoded as the package manager of every project the studio opens. The
second one is wrong for a folder that is not ours: `bun install` over a `package-lock.json` writes a
second lockfile and resolves to different versions than the project's own tooling would. `pmOf(root)`
in `sidecar/package-manager.ts` is the one place that decides, and every hardcoded `bun …` goes
through it (REM-296).

- **The lockfile names the manager**, the way the remotion skills already do it: `bun.lock(b)` → bun,
  `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` / `npm-shrinkwrap.json` → npm.
  With no lockfile anywhere the answer is bun, which is what our own scaffolds want and what the
  shipped runtime always makes available.
- **The walk up stops at the repository root.** A video project inside a workspace legitimately
  installs from the workspace's lockfile, so `pmOf` climbs — but only until it has looked in the
  directory holding `.git`. Without that bound, a project created inside somebody's unrelated repo
  would inherit that repo's manager and install at *its* root.
- **The scaffold does not ask.** `installScaffold` always uses bun, because the folder was made from
  our template a second ago and `pmOf` would otherwise read a lockfile from an enclosing repo. Every
  other install — the checklist's button, a Retry — is `installDependencies`, which asks `pmOf`. It
  runs in the lockfile's own directory, not the Remotion root, which is what makes a workspace
  install a workspace install.
- **The shipped bun is the binary for a bun project, and never for anyone else's.** `binaryOf` answers
  `process.execPath` for bun — the runtime the sidecar is already running on, so a machine with no
  bun installed still installs a bun project — and resolves npm/pnpm/yarn from `$PATH` plus the
  install locations a GUI-launched app does not inherit.
- **Drift is a bun-only claim, and silence is the honest degradation.**
  `bun install --dry-run --frozen-lockfile` looks at nothing and writes nothing (measured: byte-
  identical output and exit 0 with `node_modules` deleted); npm, yarn and pnpm have no comparable
  command, and the rule is that the studio never runs something that writes into the user's project
  to answer a checklist row. So for a non-bun project `lockfileDrift` returns `null` and the row says
  nothing rather than guessing. The *missing packages* half of that row is manager-independent — it
  reads `node_modules` — and still works everywhere.
- **The agent is told its own project's command.** `[Asset #N]`'s "not installed yet" line now names
  `npm install` / `pnpm add` / `yarn add` / `bun add` from `pmOf`; the convention that packages are
  added through an ordinary Bash card is unchanged, only the suggested command moved.
- **No manager at all is a row with a button.** A foreign project whose lockfile says npm on a machine
  with no Node is the case #218's prerequisites used to make impossible to reach. The `manager` row
  fails, says which lockfile chose the manager and why the studio will not substitute its own bun, and
  carries `fix: { type: "node" }` — Install Node.js. `node.install` in the sidecar reads
  `nodejs.org/dist/index.json`, takes the newest entry that is LTS, streams the universal `.pkg` into
  a temp folder with `{ received, total }` progress, and hands it to `/usr/bin/open`: the system
  installer, with macOS's own admin prompt. A silent user-space install (nvm, fnm) is deliberately not
  done — the studio does not want to be a Node manager in somebody else's machine. Offline, the row
  says so instead of showing a button that cannot work.
  - **A missing pnpm or yarn on a machine that *has* npm is a different fix**: `npm install -g pnpm`
    on the copyable-command row, because downloading Node again would install nothing new.
  - The dependencies row drops its own Install button while the manager is missing, so the checklist
    never offers a button that would fail.

### The asset library

Save something once and reuse it in every other video: an image, a video, a sound, or a finished
Remotion component (REM-8). It is a drawer at the foot of the left pane, and its assets reach a turn as
`[Asset #N]` — the **third** reference kind, beside `[Image #N]` and `[Element #N]`.

- **A saved stock asset is named by what you searched for, not by its alt text**
  (REM-334). Pexels' alt is a sentence — and already cut mid-clause at the source — so
  every photo landed in the library as `Dynamic wa…`, `A serene vi…`, `Close up of…`: two
  columns in a 288px sidebar give a label about twelve characters, and the descriptive
  prefix alt text always opens with is exactly the part that does not tell one photo from
  another. `stockName` in `lib/studio/stock.ts` makes it `ocean — Magda Ehlers`, and it
  lives in the webview because that is where the query is — the sidecar's `StockItem`
  never carried one, and a name is a presentation decision, not a wire change. The alt
  text stays where prose belongs: on the search result you picked from.
- **The library is a folder, not a database.** `assets/<slug>/` plus a `manifest.json` under
  `app_data_dir/library`, which Rust resolves and hands over as `REMOCN_STUDIO_LIBRARY_DIR` exactly
  as it does the history's `REMOCN_STUDIO_DATA_DIR`. Listing is a folder scan with no index to keep
  in step, and previews load over the asset protocol for free. The Schema lives in
  `shared/library.ts` next to the IPC contract, because the webview reads a manifest's fields on the
  card and the sidecar writes them.
- **The slug is the folder and never moves.** Renaming rewrites `name` in the manifest, so a
  reference already in a composer, and a copy already in a project, cannot be orphaned by a rename.
  A second asset of the same name gets `-2`.
- **Insertion is a copy, made before the turn starts.** `agent.prompt` carries the picked assets
  positionally (`assets[i]` ↔ `[Asset #{i+1}]`, the same invariant `[Image #N]` has) and
  `placeAssets` copies them in: media to `public/library/`, a component to `src/library/<slug>/`,
  resolved against `remotionRootOf(cwd)` rather than the opened folder. Three things fall out of
  doing it here rather than letting the agent fetch them: **zero permission cards** — the library is
  outside `cwd`, so an agent `Read` there would raise one every time; **zero tokens** spent retyping
  code that already exists; and a byte-for-byte copy rather than a paraphrase.
- **It never overwrites**, the same rule the scaffold has: an existing file is skipped and the block
  says *already in the project, untouched*, so an edit the agent made in an earlier turn survives a
  second insertion. A fresh copy is something the user asks for in words.
- **The block is the only thing the agent is told.** `assetBrief` names what was copied, what was
  skipped, `staticFile("library/…")` for media, and — checked with the same `isInstalled` the
  environment checklist uses — which npm packages are missing, for the agent to `bun add` through
  the ordinary Bash card. Nothing is written to `package.json` behind the turn's back.
- **A deleted asset is a sentence, not a failure.** `placeAssets` answers with a placement whose
  `reason` says the asset is gone; the turn runs. A copy that genuinely fails becomes a `notice` and
  the turn still runs, because the words the person wrote are worth more than the attachment.
- **The agent saves components, the UI saves media** — the split is about who knows the boundaries.
  The agent wrote the code and knows the import graph, so it gathers the files, names them and calls
  `save_asset` on a second MCP server, `remocn-library` — served the same stdio way as
  `remocn-pipeline` (see *The agent seam*) — and auto-allowed by the same rule in `permission.ts`: the library is app data, and `save_asset`
  only ever reads from `cwd` and writes into the library. There is no file-tree picker, because the
  studio's user does not read code.
  - **Which is why the pane lists again when a turn settles.** A component reaches the library
    through the sidecar's own MCP tool, so nothing in the webview is on that path and a save landed
    on disk that the list — read once, at boot — could not know about; a component saved by the
    agent appeared only after a relaunch. `useLibrary` takes `hasRunningTurns` and refreshes on its
    falling edge, which is the only moment the library can have changed behind the pane's back. The
    refresh is **quiet**: it does not raise `isLoading`, or every turn would end in a flash of
    skeletons reporting nothing.
- **Files keep their shape relative to what they share.** `layoutOf` takes the common ancestor of
  the saved paths and stores names relative to it, so `Scene.tsx` + `lib/ease.ts` land under
  `src/library/<slug>/` with the relative import between them still correct. Flattening would break
  every component with a helper.
- **Dedupe is by content hash, and it remembers a "no".** Each manifest carries the sha256 of its
  files and `dismissed.json` carries the hashes of files the person declined, so `library.offer`
  answers with only what is worth asking about — a long session must not re-ask about the same
  picture every turn. Two identical files in one offer are one row.
- **The end-of-turn card does not lock the composer.** It is permission-card *styled* and
  attention-shaped, but a save is not a thing the turn is waiting on; striking a file out of it is a
  decline, and a save that fails leaves its file on the card rather than reporting success.
- **A preview is best-effort, exactly like the context reading.** `library.save` from the agent
  renders one frame through the existing `preview.still` machinery, using the composition and frame
  the pane says are on screen — which the turn carries as `playing`, because the sidecar has no
  other way to know what the person is looking at. A failure never fails the save: the card falls
  back to the type icon. A single-file image is its own preview and needs no render at all.
- **Asset references are not project-scoped**, which is the point of them, so — unlike element
  references — switching projects leaves them in the composer. Picking the same asset twice reuses
  the number it already has, so the list and the text cannot disagree and a row keeps its own key.
- **The library opens out of the sidebar's bottom edge, and is not a tab.** A segmented
  Projects | Assets switcher was the first version and it read as a foreign control: it sat between
  the wordmark and New Project, and three things then competed for the top of the pane. `AssetsDrawer`
  is instead one 36px strip pinned above the footer — icon, label, count, chevron — that opens
  upward into the grid, the same shape the plan drawer opens out of the composer. Closed, the pane
  looks exactly as it did before assets existed; open, the drawer is capped at three fifths of the
  height so the project list it slid over is still there.
- **The state is `assetsDrawer`, a boolean, remembered in `settings.json`.** It was `paneTab` with
  `"projects" | "assets"` while the switcher existed; keeping that name after the tabs went would
  have left the setting describing a control that is not there.

### Entry, emphasis, exit

Keyframes are replaced by a vocabulary of named behaviours, and the vocabulary has a
skeleton: every movement belongs to one moment in the life of the thing it is attached
to (REM-290). `role: entry | emphasis | exit | scene | transition` is that axis — one
field, one value — where the pane's categories (Typography, Shaders, Filters…) answer
*what a component is about* and the role answers *when it runs*.

- **`shared/motion.ts` is the taxonomy, and the prompt is generated from it.** The
  roles, their one-line hints, the props each role expects and the twenty dictionary
  names live there; `MOTION_TAXONOMY` in `sidecar/claude/conventions.ts` composes the
  always-on paragraph out of those values, so the words the agent is given and the
  words the person reads cannot drift. A test pins that every dictionary name is
  documented in the `motion-design` skill — names in the convention, recipes in the
  skill, which is the split #290 proposed.
- **The roles of the shipped set are ours, not upstream's.** They live in
  `sidecar/library/roles.ts` rather than in the vendored manifests, because `remocn/`
  is hash-locked against a pin and `remocn:check` reads any edit there as drift — the
  classification is editorial judgement, and writing it into that tree would make every
  future `remocn:sync` a merge. A test fails when `remocn/index.json` ships a component
  nothing has classified, so a sync that adds components cannot land unclassified ones.
- **One rule settles the hard cases.** A behaviour that replaces an element's content in
  place — a value swap, a per-word crossfade, a strikethrough that reveals the new line
  — is `emphasis`: the element was there before and is there after. A behaviour that
  brings content out of nothing is `entry`, and so is a number that counts to the value
  it lands on, because the count is how that value arrives.
- **`scene` and `transition` are on the same axis, not a second one.** They are the two
  answers that are about a whole scene rather than one element, and ambiguity resolves
  outward: transition over scene over the three element roles. A component has one home,
  because the pane groups by exactly one thing.
- **The dictionary obeys `video-lessons`.** `pulse` is not in it — §1 bans pulsing — and
  `rise-in` is documented as panels-and-images only, because a text entrance travels on
  X or the glyph baselines snap (§2). A dictionary that contradicted the lessons would
  be a vocabulary for producing the exact failures the lessons record.
- **The role heading is above the tiles, not merely opaque** (REM-325). It always had the
  pane's own `bg-sidebar`; what it lacked was a layer. At `z-0` it lost to a tile's own
  positioned children — the `Attachment` trigger is `absolute inset-0 z-10` and its actions
  `z-20` — so a row scrolling under it printed straight through the word, and the only
  thing saying which role you are looking at went illegible exactly while scrolling 99
  components. `z-30` clears both. Making it visible then showed the other half: the
  heading stuck at a flat `top-11` while the search field above it is 44px only until
  `sm:`, where the input drops to `h-7.5` and the field becomes 40px — so tiles scrolled
  through a 4px band between the two. `UNDER_SEARCH_FIELD` is exported beside the field
  that defines it, because the offset and the height are one value and not two to be
  remembered together.
- **The pane groups by role.** Entry, Emphasis, Exit, Scene, Transition with a count
  each; category survives in the data and orders the tiles *inside* a group, so Scene
  reads shaders before filters. A saved component sits in its own role beside the
  shipped ones — the dictionary growing is the point — and the ones saved before roles
  existed keep a leading *Saved* group. The delete action moved from the grid to the
  tile (`isBundledSlug`), since one group now holds both kinds.
- **What the shipped set actually is, measured through `library.bundled`:** 99
  components, none unclassified — 21 entry, 15 emphasis, 4 exit, 36 scene, 23
  transition. Exit being that thin is information, and it is visible now.
- **Nothing without a role behaves differently.** The field is nullable everywhere it is
  stored, decodes to `null` for a manifest written before it existed, and `save_asset`
  takes it as an optional argument — media has no role and is not given one. The role
  travels into the turn on the `[Asset #N]` block as `(entry)` after the name.

### The moodboard

Before a video is built, the agent can assemble a moodboard: 5–8 stock photo
references, a palette extracted from them, a Google Fonts pairing and tone words
(REM-266). The AI is curator and typesetter, not painter — the visual content is
found, and only primitives are drawn.

- **The spec is neutral on purpose.** `shared/moodboard.ts` holds `MoodboardSpec`
  next to `library.ts`: images with per-block ids, role, grid spans and their own
  `AssetSource` (the manifest's `source` is one-per-asset, so per-image
  attribution has to live in the spec), palette swatches, typography pairs,
  keywords, and the project the board belongs to. The generation does not know
  which canvas renders it — the PNG is the default, and a Paper or Figma adapter
  (REM-265) is a later translation of the *same* spec.
- **The PNG render is a page, not a canvas.** `moodboardHtml` in
  `sidecar/library/moodboard.ts` builds a deterministic HTML+CSS collage authored
  to exactly 1440×900 — the viewport `captureSourcePage` already opens — so the
  render rides the preview host's existing `source` command with **zero protocol
  change**, loading the page over `file://` (the http(s)-only guard is the agent
  layer's, not the capture's). Images are local staging files; the only network
  on render is the Google Fonts stylesheet, and `document.fonts.ready` is already
  awaited. Consequence accepted in the issue: no running preview, no board.
- **A board is an ordinary asset.** `assets/<slug>/` with `spec.json` (the marker
  file, in `files`), `images/*` and the rendered `preview.png` as the card still;
  `type` stays `img`. No manifest field was added, so previews, the undo window
  and insertion all work unchanged. `board.html` is *not* stored — it is derived
  from the spec on every render.
- **Three tools on the existing `remocn-library` server** — `specs.test.ts` pins
  `TOOL_SERVERS` to exactly three servers and the permission auto-allow derives
  from that list, so a fourth server was never an option. `search_stock` speaks
  the REM-258 Pexels client (key and network stay in the sidecar; the answer
  carries `download` and `pageUrl` for the agent to pass back). `save_moodboard`
  downloads the picks, writes the spec, renders and saves; it **replaces** the
  project's existing board, which is the iteration path — "replace the third
  photo" is the same call with one block changed. `get_moodboard` is the
  idempotence gate: an existing board answers as ready spec + PNG path, and the
  brand stage's discover order calls it first, so the expensive search-and-curate
  pass is never repeated unless the person asks to start over in words.
- **`freeSlug` never overwrites** — it silently mints `slug-2` — so "already
  exists" is an explicit `findMoodboard` probe (scan for `spec.json`, match
  `spec.project`), and replacement is a `removeAsset` before the save.
- **The render callback is injected** (`MoodboardRender`), so
  `sidecar/library/moodboard.test.ts` exercises staging, replacement and the
  store against a temp library with a fake fetcher and a renderer that writes
  bytes — the one thing no seam can test is the real Chrome `file://` capture,
  which is verified in the running app.

### Video and audio in the composer

A picture and a clip are both media the person hands over, and they are carried by two different
lists, because **the API has an image block and nothing else**. `attachments` stays images-only and
keeps the `[Image #N]` invariant; `media` is video and audio, and has no reference kind at all.

- **A clip is copied, not encoded.** `placeMedia` puts each one in `public/library/` before the turn
  — the same `copyInto` the assets use, so it never overwrites — and `mediaBrief` gives the agent the
  `staticFile()` path rather than the one on the person's disk, which is outside `cwd` and would
  raise a permission card on every read. Sending it as a base64 block was never an option; dropping
  it silently was the alternative, and this is the one that makes an attached clip usable.
- **No `[Media #N]`.** Relabelling `[Image #N]` to something that covers both would stop every
  stored transcript colouring its own references, and a fourth kind would duplicate what the asset
  trailer already does for a case — two or three named files — that a sentence handles. The trailer
  names each file, so "use the intro clip" resolves without a token.
- **`MediaType` is a widening of `ImageMediaType`, not a sibling**, so an image attachment is a valid
  `PromptMedia` and `library.offer`/`dismiss`/`save` took the wider type without a second path. One
  `MediaRow` renders all three kinds — a `<video>` is its own thumbnail, audio gets the icon — which
  is why `AttachmentRow` is gone rather than living beside it and drifting.
- **Only playable files reach the media list.** `useMedia` filters on `isPlayable`, so a picture
  dropped into it would still go to the model rather than being copied into `public/`.
- **A video card shows its first frame, and that takes two nudges.** A `<video>` paints nothing until
  it has decoded a frame, and *seeking to the time it already sits at fires no seek at all* — so
  frame zero is the one time you cannot ask for. `VideoThumbnail` asks for a tenth of a second both
  ways: `#t=` on the URL, and `currentTime` set from `onLoadedMetadata`. Neither is reliable alone on
  a custom protocol; together they cost one seek. `firstFrameAt` halves the duration for a clip too
  short for that tenth, and it is the single definition both the card and the extractor read.
- **A video saved to the library gets a real still, taken once.** `firstFrame` in
  `lib/studio/thumbnail.ts` decodes the frame into a `<canvas>` and hands the PNG to the same
  raw-body invoke a pasted image uses; `AssetDraft.preview` carries its path and the sidecar files it
  as `preview.png`. The pane then renders an `<img>`, so a library of thirty clips decodes no video
  to draw its list. **The `<video>` is still the fallback** — for assets saved before this existed,
  and for any frame that would not decode — which is why the tile is never a bare icon for a video.
  - **`crossOrigin = "anonymous"` is not optional here.** The asset protocol is a different origin
    from the window, so a plain load taints the canvas and `toBlob()` throws — the same trap, and the
    same fix, as a snapshot's still.
  - **A thumbnail is decoration and never fails a save.** `copiedPreview` swallows a picture that
    would not copy and the asset lands with `preview: null`, exactly as the component preview and the
    context-window reading do.
  - **The fallback heals itself, because it would otherwise decode on every visit.** Base UI's
    `Tabs.Panel` defaults to `keepMounted: false`, so leaving the Assets tab unmounts every row and
    coming back remounts them — a `<video>` fallback would decode a frame again each time, and a clip
    that cannot decode would retry for ever and still show nothing. `useBackfilledThumbnails` takes
    the frame once, files it through `library.preview`, and the next mount is an `<img>`. It runs
    **sequentially** — decoding a library's worth of video at once is the cost this avoids, not a
    faster way to pay it — and marks each slug as *its own turn begins*, not up front, so a tail cut
    short by a new listing is retried rather than lost, while a failure is remembered for the session.
  - **`useCaret` returns a memoised handle.** It used to build a fresh object every render, which
    reminted every composer callback closing over it — `pick`, `write`, `select` — and through them
    defeated the `memo` on the asset rows, re-rendering the whole panel on every keystroke. The
    composer reads the live text from a ref for the same reason.

### A track carries its audiomap

A sound saved to the library, or attached to a message, is analysed once and the result
travels with it (REM-256): `audiomapFrom` in `lib/studio/audiomap.ts` is a pure function
over mono samples, run in the same decode that draws the waveform, and its answer lives in
the manifest beside `duration`. The agent reads it in the asset or media brief as words.

- **The verdict is the payload, not the beats.** A beat array breaks on exactly the calm
  tracks where it is most tempting: the tracker imposes a metronome. So the map carries
  energy phases, silences, hard stops and onset density too, and answers `beat_cut` only
  when the tempo is stable, the onsets cover the grid and the track is dense enough. In
  `phrase_flow` the grid is withheld from the brief altogether, or the agent would cut to it.
- **Energy-based onsets, deliberately.** Half-wave rectified rise of the log energy, an
  adaptive threshold over half a second, autocorrelation for the coarse period, the median
  onset gap for the fraction the hop rounding loses, and the phase picked by coverage.
  Whether that is enough for lo-fi and ambient is the ticket's open question and is decided
  on real tracks, not ahead of them.
- **Seconds, not frames.** The sidecar does not know a composition's fps when it writes the
  brief, so times stay seconds and the brief says to multiply.
- **`PromptMedia.audiomap` is an optional key**, so an image attachment is still a valid
  media item. An attached sound is analysed after it lands (`useAnalysedAudio`), and a
  message sent before the decode finishes goes without — a missing map hides the lines,
  never fails the turn. A library sound saved before this existed is backfilled by the
  same pass that backfills thumbnails, keyed on `audiomap === null`.

### The library is a grid of cards

The panel is a two-column grid of the `Attachment` primitives — `AttachmentMedia variant="image"`
over an `AttachmentTitle` — rather than a list of rows with an icon and a type label.

- **One still per kind, one field to hold it.** A video shows a frame; a sound shows its waveform,
  drawn from peaks by `peaksFrom` and baked to a PNG. Both land in the same `preview.png`, so the
  manifest field, the backfill, the `<img>` in the tile and the drop handling were all written once
  and neither kind is a special case downstream.
- **The waveform's colour is baked, so it cannot follow the theme.** It is a mid tone chosen to read
  against the card's muted background in both, rather than a token that would be right in one and
  invisible in the other. Peak normalisation is what stops a quiet recording drawing as a flat line.
- **`duration` is measured during the decode that was already happening** — `video.duration` while
  seeking for the frame, `AudioBuffer.duration` while decoding for the waveform — so the badge costs
  no extra pass. `clipTime` is `mm:ss` until a clip earns an hour. A length that was never measured
  badges nothing rather than showing `00:00`.
- **The card's click target is `AttachmentTrigger`**, which is `absolute inset-0 z-10`, and Delete
  is an `AttachmentAction` inside `AttachmentActions` at `z-20`. So the whole card inserts the asset
  except that button, with no hit-testing of our own — the two are siblings, not nested, so the
  trigger's handler never sees the delete click and nothing has to stop propagation.
- **Deleting forgives, exactly as deleting a session does.** The tile leaves the grid at once and
  `library.remove` is held behind an undo window — `Effect.sleep` in a forked fiber — with the
  toast's Undo a fiber interrupt that puts the card back at its old index. Quitting inside the
  window drops the delete rather than rushing it: the asset comes back next launch, which is the
  failure direction that keeps data. It is one button rather than a menu, so there is no
  confirmation dialog to dismiss; the window *is* the confirmation.
  - **The refresh above and this window have to agree.** A pending delete is still on disk, so a
    listing taken inside it would put the row back and read as the delete having failed. `load`
    therefore filters the rows against the held deletes.
- **The kind moved from a visible second line into the trigger's `aria-label`.** The tile now says
  what it is by showing it; a screen reader still hears "Neon Title, Component".

### Dragging into the library, or into the message

`onDragDropEvent` from Tauri, not HTML5 drag events: with `dragDropEnabled` on — the default — the
webview never fires them for files, and a `File` from a WKWebView drop carries no path anyway. The
event gives absolute paths, which is what the library wants and what keeps a 200 MB video off the
IPC.

- **The point arrives in CSS pixels, and believing otherwise misfiled every drop** (REM-333). Tauri
  types the drag position as a `PhysicalPosition` the whole way up, so `isInside` used to divide it
  by `devicePixelRatio`. It is not physical: on macOS wry builds it from AppKit — `draggingLocation()`
  against the view's own `frame()`, both in *points* (wry 0.55.1, `src/wkwebview/drag_drop.rs`).
  Points are CSS pixels, which is what `getBoundingClientRect()` answers in, so the division moved
  every drop up and to the left — on a 2× display far enough to push a release in the middle of the
  composer into the sidebar, where the file was silently filed in the library and the message got
  nothing. The two symptoms that hid it are the same fault: the composer never lit its drop ring,
  because as far as the app was concerned the pointer was never over it. `isInside` in
  `lib/studio/drop.ts` takes no ratio at all now, and is pure and pinned by tests, because the drag
  itself is the one part no seam can exercise.
- **Anything that is not media is refused out loud, and there are two refusals** (REM-317). A dropped
  `.tsx` is not an asset the panel can make — a component's boundaries are the agent's to work out —
  so the pane says what it skipped rather than saving half a drop in silence, naming where they did
  not go because there are two places they could have gone. A **picture** is the other case and it
  needed its own sentence: the API reads jpeg, png, gif and webp and nothing else, so a `.heic` is a
  real refusal, but *"that is not a picture"* about a photograph is unhelpful and untrue.
  `unsendableImageOf` recognises the formats the studio knows and cannot send, and the refusal names
  the format and the way out. Video and audio have no such constraint — they are never sent to the
  model, only copied into `public/library/` and played by the project's own renderer — so `.m4v`,
  `.mkv`, `.avi`, `.mpeg`, `.flac`, `.aiff`, `.opus` and `.oga` are simply taken.
- **The composer is the second zone, and there is still one watcher** (REM-255). `useFileDrops` owns
  the only `onDragDropEvent` subscription and asks `zoneAt` — an ordered list of boxes, first match
  wins — which zone a point is in; the two zones are disjoint on screen today, so the order is
  insurance rather than arbitration, and a zone whose box is `null` is simply not on screen. Two
  listeners racing over the same drop is the thing this avoids: each one would have to know the
  other's rectangle to stay out of its way.
- **A dropped file is sorted by kind, not by where it landed.** Pictures go to `attachments` with an
  `[Image #N]` written at the caret, exactly as a paste does — the gesture is the same one — and
  video and audio go to `media`, which carries no reference kind. A mixed drop splits across both,
  and each list filters the paths itself, so the split is the two `arriving` functions that already
  existed rather than a third place that decides what an image is.
- **A locked composer is not a zone.** Waiting on a permission card, a folder that is gone, a
  blocking environment check: `isComposerOpen` goes false, the box leaves the hit test and the ring
  never lights, so the composer cannot promise something it would drop on the floor. A composer that
  is not rendered at all — the new-project wizard, a transcript still loading — falls out for free,
  since its ref is null.
- **A drop that misses both zones is silent.** It also puts the left pane back: a drag that passed
  over the library to reach the composer switched the view to Assets on the way, and letting go
  anywhere reverts it.

### Tagging a file

`@` in the composer opens a list of the project's files; picking one writes its path in backticks
into the sentence being typed (REM-249). A query beginning `/` or `~` browses the whole filesystem
instead.

- **A tagged file is plain text, and that is the design.** A fourth reference kind beside
  `[Image #N]`, `[Element #N]` and `[Asset #N]` would need a field on the stored `TranscriptEntry`
  and a change in the recorder — the argument that already sank `[Media #N]` — and it would buy
  nothing, because a file needs neither a splice nor a trailer: **the path is the whole payload**.
  So `shared/references.ts`, `shared/transcript.ts`, the history store and `content.ts` are all
  untouched, and a reopened session renders what was sent because nothing about sending changed.
- **Reading the file costs nothing to arrange.** The agent's `cwd` *is* the project, and every path
  inside it is auto-allowed by the gate, so a relative path raises no card and nothing has to be
  resolved or attached on our side. A path outside the folder goes through the ordinary Allow/Deny
  card — that is the #223 invariant working, not a gap.
- **Two methods, because they are cached by different keys.** `project.files` walks the project once
  per project and the webview filters the result on every keystroke; `files.list` reads one folder
  and is cached per folder. Folding both into one "suggest" method would put an IPC round trip on
  every keystroke and make the list's responsiveness the sidecar's problem. `~` is expanded in the
  sidecar, because the webview has no home directory to expand it against.
- **The walk skips what a person would never tag** — `node_modules`, `out`, `dist`, `build`,
  `coverage`, `target`, `tmp`, and every dot entry — and stops at 4000 files, reporting `truncated`
  rather than trimming in silence. Reaching what it skipped is what typing an absolute path is for.
- **The composer owns the text, so it owns the mention**, exactly as it owns the references:
  `useMentions` holds the candidates, the query and the highlighted row and decides nothing about
  the text, while `useComposer` runs `insertMention` / `openFolder` against the live field. Its
  `onKeyDown` is consulted **first** and answers whether it took the key, so Escape closes the list
  instead of clearing the composer and Enter picks a file instead of sending the message — and when
  nothing matched, Enter falls straight through and sends, because a list with no rows must not
  swallow a keystroke.
- **Drilling into a folder does not wait for a round trip.** `choose` knows exactly what the text
  will become — `@` plus the folder plus a slash — so it sets its own query at the same moment it
  asks the composer to write it, rather than waiting for a `sync` that a programmatic `setValue`
  never fires.
- **A space ends a mention, unless the path is absolute.** `~/My Movies/` is a folder people really
  have, and the drill-down produces exactly that text; a relative query keeps the Claude Code rule
  that a space is the end of the token.
- **Escape is remembered per token.** The dismissed `@`'s offset is kept, so typing on into the same
  word does not bring the list back — while a different `@`, or moving away and starting another,
  opens it as usual.
- **A row leads with the mark of what the file *is*.** `lib/studio/file-icons.ts` maps a name to a
  kind and `components/studio/file-icon.tsx` maps that kind to a glyph — the same two-step
  `activity-icon.tsx` uses, and for the same reason it uses a `Map` rather than a `Record`: the key
  comes from a filename, so `constructor.js` would otherwise resolve off `Object.prototype`.
  Brand marks come from **Simple Icons** (`@icons-pack/react-simple-icons`) — React on a `.tsx`,
  TypeScript, JSON, Markdown, CSS — and everything with no brand to speak of falls to lucide's
  `File*` family by category: image, video, audio, font, archive, text.
  - **Imported one file at a time**, `@icons-pack/react-simple-icons/icons/SiReact`, never from the
    package root: that barrel re-exports 10,359 icons and there is no reason to hand it to the
    bundler and hope. Measured on a *clean* `out/`, sixteen brand marks cost **26 KB**.
    Measure it that way or not at all — chunk filenames carry a content hash, so a stale `out/`
    keeps every previous build's chunks and reads as a megabyte of growth that never happened.
  - **They are monochrome by construction.** Each component defaults to `color="currentColor"` and
    only paints its brand colour when asked with `color="default"`, so the column inherits
    `text-muted-foreground` like every other icon in the app. The marks are *filled* where lucide's
    are 1.5px outlines, which reads heavier at the same box — `scale-90` on the branded ones is
    what evens the two out.
  - Each Simple Icon renders a `<title>`, so the glyph is `aria-hidden`: the row's own text is what
    a screen reader should read, not "React Intro.tsx src/scenes".
- **The list scrolls to the row the keyboard is on**, which it has to: twelve rows do not fit in
  `max-h-64` and the arrows used to walk the highlight straight out of the visible part.
  `useKeptInView` is a layout effect on the row itself with `block: "nearest"`, so a row already in
  view costs nothing. Its trigger is `${keyed}:${index}` rather than the active index alone, and
  both halves earn their place: `keyed` counts *arrow presses*, so a row that is merely re-rendered
  is not dragged back into view, and `index` catches the case `keyed` cannot — a filter that keeps
  the highlighted row but moves it, where the row is the same component instance and nothing else
  would change. Hovering can only ever re-scroll a row the cursor is already on, which `nearest`
  makes a no-op.
- **The path is coloured, and colouring it costs nothing extra.** `MessageText` already draws both
  the composer's overlay and the user's bubble, so splitting its *text* segments once more — into
  plain runs and backticked paths — lights the mention in both places and in history, where the
  stored prompt is the same string. It is deliberately **not** a segment kind in
  `shared/references.ts`: `dropReference` walks those segments and treats anything that is not
  `text` as a reference to renumber, so a fourth kind there would make a typed path behave like an
  attachment. Splitting inside the renderer keeps that fold untouched.
- **A chip, and one that costs no layout.** `.file-mention` in `app/globals.css` is a background, a
  radius and a shadow — nothing that takes width. The overlay's own metrics are what position the
  caret in the textarea beneath it, so padding, a border, tracking or a weight would drift the two
  apart a character at a time; that is the accumulating error `font-medium` on a reference already
  cost once. The side air is therefore an **offset** shadow rather than a spread one: a spread would
  grow the chip vertically too, and a path that wraps — the normal case for an absolute one — would
  stack its lines' alpha where they met. `box-decoration-break: clone` is what gives each wrapped
  fragment its own rounded chip instead of one box torn across three lines.
- **The chip is `currentColor`, so one rule serves both surfaces.** It is drawn over the composer,
  where the text is `foreground`, and inside the sent bubble, which is `bg-primary` with
  `text-primary-foreground`. A fixed tint had to read on both: `--reference` teal was the first
  version and it was legible on neither. A mix of the *inherited* colour is right on each by
  construction, which is also why a file mention no longer speaks the reference colour that
  `[Image #N]` does — the two now differ in kind, a chip against a coloured word.
- **Only a path lights up, not every code span.** A backticked run counts when it holds a `/` or is
  a bare name with a real extension, so `` `src/Root.tsx` ``, `` `~/My Movies/clip.mp4` `` and
  `` `package.json` `` colour while `` `Main` `` and `` `TransitionSeries` `` — the words the
  conventions themselves put in backticks — stay plain.
- **Both pure halves are tested without rendering anything**: `lib/studio/mentions.ts` (what counts
  as a mention, where a folder query splits, the ranking, what is a path) and `sidecar/files.ts`
  (what the walk skips, the limit, `~` expansion) — and the wiring is tested through `useComposer`
  against a fake IPC, which is the only place the two meet.

## Layout

Flat root, no monorepo — per #218.

```
app/                  Next App Router (layout, page, globals.css)
components/ui/        shadcn/ui primitives (Base UI–backed)
components/studio/    app-level components (panes, sidecar status, quit guard)
hooks/                all behaviour: no logic inline in components
lib/                  cn helper, error formatting, lib/studio/* clients
preview/              what the *project's* webpack compiles instead of Studio's UI:
                      entry.tsx, the two-way bridge, hot reload, grab, source paths,
                      the element picker, anchor.ts (the per-instance selector a
                      selection is identified by) and the snapshot marquee
shared/               crash.ts: the consent contract and the one path scrubber;
                      ipc.ts: the typed contract, and the media types it carries;
                      slug.ts: the one reader of a name into a composition id;
                      providers.ts: the provider registry, capabilities and the
                      neutral tool verbs; transcript.ts: the one fold;
                      references.ts: the one reader of `[Image #N]`/`[Element #N]`/
                      `[Asset #N]`; library.ts: the asset manifest format;
                      motion.ts: the movement taxonomy — roles, the props each
                      expects, and the dictionary of named behaviours
sidecar/              bun: frame loop, method handlers, SQLite history;
                      crash.ts gates @sentry/bun on the consent Rust passes in;
                      files.ts is the project walk and the folder read behind `@`;
                      package-manager.ts is the one reader of a project's lockfile;
                      node-installer.ts fetches and opens the Node LTS installer
sidecar/agent/        the provider-neutral seam: AgentAdapter, the permission
                      gate's skeleton, the mode switch, account cache, registry,
                      and knowledge.ts — the one locator/attach contract for the
                      shipped skills bundle
sidecar/claude/       the Claude Code adapter: Agent SDK session, event and
                      failure translation, the CanUseTool guard, auth probe,
                      tool-name→verb vocabulary
sidecar/codex/        the Codex adapter: SDK thread per turn, the item-stream
                      translator, sandbox mapping, `codex login status` probe,
                      CLI resolution, and home.ts — the mirrored CODEX_HOME the
                      bundled skills arrive through
sidecar/acp/          the Agent Client Protocol bridge: the JSON-RPC peer, the
                      update translator, the permission mapping, prompt blocks
sidecar/copilot/      the Copilot adapter over that bridge: CLI resolution,
                      spawn flags, the in-band failure classifier, ACP probe
sidecar/grok/         the Grok Build adapter, second rider on the bridge
sidecar/tools/        the studio's own tools as stdio MCP: specs, execution,
                      the unix-socket gateway and the --tools-host child
sidecar/history/      driver seam, migrations, project, video and session stores,
                      recorder
sidecar/library/      the asset library: the folder store and the copy into a project,
                      roles.ts — the motion role of every shipped remocn component —
                      and moodboard.ts: the board's HTML template, its render and its
                      idempotent store
sidecar/scaffold/     what "New project…" expands and installs
templates/remotion/   that project, vendored here and shipped as a Tauri resource
agent/                the one skills bundle every provider loads: vendored skills,
                      plus video-lessons and motion-design — our own record of what
                      failed on screen and the motion bar it has to clear
scripts/              build-time tooling; skills-sync.ts is the vendoring step,
                      fetch-bun.ts pulls the bun runtime the app ships, and
                      crash-sink.ts / sourcemaps.ts are crash reporting's
                      verification and its release step
sidecar/preview/      the --preview-host child: project resolution, webpack watch, server,
                      stills for Snapshot and the mp4 export
src-tauri/            Rust core (Tauri v2), the sidecar supervisor, pasted-image writes;
                      crash.rs reads the consent and holds the panic reporter
public/               static assets
```

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

`repos/` is gitignored and excluded from `tsconfig.json` and from Zed's file scan — the checkouts
are local reference material, not part of this project's build.

## Distilled agent patterns

`agent-patterns/` holds patterns already extracted from the vendored checkouts. Read the relevant
file there **before** the upstream guide: it is shorter, every API in it was verified against the
vendored source, and it records where the upstream docs drift from the actual code.

- `agent-patterns/effect-schema.md` — `Schema` in Effect v4 (`effect@4.0.0-beta.101`). Read before
  writing any Schema code. v4 rewrote Schema, so v3 knowledge from training data is wrong rather
  than merely stale — e.g. `Schema.decode` is no longer a decoder, and the `effect/schema` import
  path in the upstream guide does not resolve.
