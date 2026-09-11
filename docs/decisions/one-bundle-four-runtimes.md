# One bundle, four runtimes

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`agent/knowledge`](../../openspec/specs/agent/knowledge/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


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
  resolve `agent/skills` with `tier: "plugin-dir"` — and it stays `experimental: true` in
  `PROVIDER_INFO` until someone runs the matrix on a login that works. The flag is data
  only now: no badge is drawn from it anywhere, in the model menu or in Settings.
- **What it costs, per turn, measured on the same prompt** (bundle attached and skill-aware
  conventions, against neither): Claude **+1215** tokens, Grok **+978**, Codex **+605**. The
  catalog itself is cheap — +505, +480 and +68 respectively — because a runtime lists name and
  description and nothing else; the rest is the conventions block, 2148 characters of it. That
  ratio is the argument against inlining: the five bodies are 69 KB.
