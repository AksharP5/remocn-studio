# A project installs with its own package manager

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`projects/dependency-install`](../../openspec/specs/projects/dependency-install/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


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
- **One run at a time per project** (REM-321). Install, the wizard's scaffold install
  and *Upgrade Remotion* all shell out into the same folder, and `dispatch` forks
  every request, so two of them genuinely ran at once — bun's linker is not safe
  against itself in one `node_modules`, and the second run printed `error: Failed to
  link @babel/parser: EEXIST`, then `Saved lockfile` and the whole package list, and
  exited 0. A `Semaphore` per canonical project root in `sidecar/scaffold/install.ts`
  makes the second wait rather than race, with its output still streaming; and a
  line shaped `error:` fails the run whatever the exit code says, because a green
  checklist row over a half-linked tree is the worst answer this app can give.
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
