# The environment checklist

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`projects/environment-checklist`](../../openspec/specs/projects/environment-checklist/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


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
