# What the agent knows

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`agent/knowledge`](../../openspec/specs/agent/knowledge/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


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
