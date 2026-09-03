# Inspect usability: implementation overview

Six specs implement the design record in
`docs/plans/2026-09-02-inspect-usability-design.md`. Each spec is written to be
handed to an implementer on its own: it carries the context it needs, the exact
changes by file, the tests, and the acceptance in the running app. Read the
design record for the *why*; the specs are the *what*.

## Order and dependencies

| Spec | Title | Effort | Depends on |
| --- | --- | --- | --- |
| 01 | Selection identity and feedback | M | nothing |
| 04 | The picker aims at what the person sees | S | nothing |
| 02 | Honest edits: rebinding, per-path resets, owners | M | 01 |
| 03 | Time in the pane | M | 02 |
| 05 | Text and type as real fields, template pin | M | 02 (for the pin), 01 (for the request-only row) |
| 06 | Codegen conventions and design_check rules | M | 01, 05 |

Ship in that order. 01 and 04 can go in parallel; 05a (pane field types and
coercion) can land any time after 01, 05b (the pin and the Upgrade row) waits
for 02 and for the live gate described in 05.

Milestones, each leaving the feature strictly more usable:

1. **See what you picked**: 01 + 04.
2. **Edits land where they say**: 02.
3. **See the change move**: 03.
4. **Text and type, and code that feeds them**: 05, then 06.

## Ground rules for every spec

These repeat the repository's own rules; the implementer reads `CLAUDE.md` and
`AGENTS.md` first and follows them over anything here.

- **Never start a dev server.** `bun dev`, `bun tauri dev` and equivalents are
  the owner's to run. Verify what a build can verify, then say what must be
  checked in the running app.
- **bun, not npm.** `bun run check` (formatter and linter, read-only, what CI
  runs), `bun run fix`, `bun run typecheck`, `bun run test`. After `bun run fix`
  always run `bun run typecheck`: the fixer has dropped a JSX attribute and
  duplicated another before.
- **Effect is the default** in `lib/**`, `hooks/**` and `sidecar/**`: functions
  return `Effect`, hooks run it, failures are `Data.TaggedError`, cancellation is
  fiber interruption. Schema code follows `agent-patterns/effect-schema.md`
  (Effect v4: `Schema.decodeUnknownExit`, `Effect.callback`, `Effect.catch`).
- **Logic lives in hooks, not in components.** No `useEffect` bodies or async
  work inline in a component; a named hook in `hooks/`.
- **No new code comments.** Put the rationale in the PR description. Existing
  comments stay unless the code they explain is gone.
- **Biome rules that shape components**: `noArrayIndexKey` (rows carry their own
  id), `noJsxPropsBind` (no inline arrows in props; a per-item handler reads
  `event.currentTarget.value`). UI primitives are `@base-ui/react`, never Radix.
- **`preview/` is compiled by the project's webpack**, not by the app: it is
  excluded from `tsconfig.json`, cannot import from `@/`, and every file under
  it needs its own entry in `src-tauri/tauri.conf.json` `resources`. Message
  shapes are duplicated between `preview/bridge.ts` (page side) and
  `lib/studio/preview.ts` (app side, Effect Schema); `lib/studio/preview.test.ts`
  is what keeps the two in step. Every new field on a message the page sends
  gets a decoding default in `lib/studio/preview.ts`, so a page from an older
  compiled build still decodes.
- **Tests are Vitest.** jsdom by default; sidecar suites that touch SQLite carry
  `// @vitest-environment node`; anything that reaches Tauri IPC installs a fake
  with `mockIPC` (`app/page.test.tsx` is the worked example). Pure functions get
  pure tests; the preview picker is tested in jsdom against fixture DOM.
- **Done means** `bun run check`, `bun run typecheck` and `bun run test` are
  green, a changeset was recorded with `bun run changeset`, and the `CLAUDE.md`
  paragraphs the change makes wrong were updated (the repository keeps its
  design notes there). Report faithfully what could not be verified without the
  running app; do not claim runtime behaviour you did not see.

## Two projects the specs refer to

- **The studio**: this repository. Line numbers in the specs are against branch
  `feature/rem-309` on 2026-09-02; re-locate by symbol if they have drifted.
- **The videos project**: `~/projects/opensource/remocn-news-videos/remocn-news-videos`,
  a real Remotion 4.0.481 project with eleven agent-generated videos under
  `src/videos/`. Acceptance steps name videos there. Its `node_modules/remotion`
  is where the Remotion internals the specs cite live (`dist/cjs/*.js`).

## Measurements that gate a spec

- Spec 02 begins with a measurement: whether `new Error().stack` under
  JavaScriptCore is identical for one JSX call site across render passes. The
  registry is designed for either answer; the measurement decides how
  "2 of 4" counts instances.
- Spec 05b begins with a measurement: the studio's preview runtime against a
  copy of the videos project bumped to Remotion 4.0.520, in the running app. The
  pin does not move until that is seen working.
- Spec 03 asks one question of the running app before its passthrough predicate
  is written: whether the Player's transport bar overlaps the canvas rect.
