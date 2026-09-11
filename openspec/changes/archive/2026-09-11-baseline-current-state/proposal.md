## Why

Remocn Studio has shipped seven minor releases without a spec: the behaviour lives in the code, its tests and a very long CLAUDE.md that records *why* things are the way they are but not, in one place, *what the studio promises*. OpenSpec was adopted on 2026-09-11 so that every later change is a delta against a written baseline. This change writes that baseline — the studio as it behaves today, at version 0.7.0 — and nothing else.

## What Changes

- Every observable capability of the studio is captured as a main spec under `openspec/specs/`, organised by domain (`shell/`, `sidecar/`, `projects/`, `agent/`, `history/`, `composer/`, `preview/`, `export/`, `library/`, `account/`).
- Each spec describes current behaviour as requirements with WHEN/THEN scenarios, including the failure direction the studio already implements (what the person sees when it goes wrong).
- No code changes. No behaviour changes. Where the code and CLAUDE.md disagree, the code is what the spec records and the disagreement is reported for a follow-up.

## Non-goals

- Designing anything new. Ideas that surfaced while reading are follow-up changes, not requirements here.
- Specifying implementation: file names appear only where a behaviour is defined by them (a `settings.json` key, an env var, an IPC method a scenario is about).
- Specifying tests, CI, release tooling, the vendored skill sync or the smoke-test fixtures. They are how the studio is built, not what it does.
- studio.remocn.dev. Different product.

## Capabilities

### New Capabilities
- `shell/startup`: the first second — hidden window, in-window splash, the two startup waits, the failed-list card.
- `shell/layout-and-panes`: the three resizable panes, the properties pane, the preview toggle and collapse repair, dark-first theme, the title bar shader preference.
- `shell/settings-page`: Settings as a full-window page over an inert shell — sections, ways in and out.
- `shell/quit-and-updates`: the quit guard, in-place updates from GitHub releases, restart.
- `shell/tips`: anchored feature tips shown when a feature becomes usable, remembered on "Got it".
- `shell/crash-reporting`: opt-in crash reports across the three processes, with path scrubbing and no third-party defaults.
- `sidecar/supervision`: the one bun process the Rust core owns — spawn, restart with backoff, logs, orphan prevention, the shipped runtime.
- `sidecar/ipc-contract`: the typed frame protocol between webview, core and sidecar — decoding, protocol version, cancellation, one reply per request.
- `projects/project-lifecycle`: opening any folder, the new-project wizard, scaffold and install, missing folders, rename, remove, project switching.
- `projects/project-settings-and-brand`: the portable project manifest, the settings section, brand assets and fonts, DESIGN.md import, moving a project, applying a brand to videos.
- `projects/videos`: a video as a folder under `src/videos/`, the registry, reconcile against the bundle, soft delete and restore, slugs, register-in-project.
- `projects/environment-checklist`: the report above the composer — provider sign-in, Remotion version, dependencies, entry point, composition, package manager.
- `projects/dependency-install`: installing with the project's own package manager, one run per project, Node.js installer, Remotion upgrade.
- `projects/open-template-link`: the `remocn-studio://open-template` link that creates a project from a bundled template.
- `agent/turns`: a turn's lifecycle — what it carries, how it streams, one running turn per video, background turns, stop, queueing hand-off.
- `agent/permissions`: the gate, the three modes, the permission card, plan mode, silent denials, the ten-minute auto-deny.
- `agent/providers`: Claude, Codex, Copilot and Grok behind one seam — capabilities, model picking, account probes, per-provider trade-offs.
- `agent/knowledge`: the bundled skills and the studio conventions, delivered to all four runtimes, gated by plan.
- `agent/studio-tools`: the studio's own MCP tools (design, library, pipeline servers), the gateway, the source-asset ask.
- `agent/design-check`: the design and readiness audit the agent runs before finishing — frame, motion, video and full modes, tunability findings, motion contracts.
- `agent/pipeline`: the seven production stages, per-video documents, the Docs pane, the Video dock.
- `history/transcript-store`: the studio's own SQLite history — projects, videos, chats, blocks, migrations, crash safety.
- `history/chat-pane`: the videos-and-chats pane — ordering, attention, rollups, the cap, adaptive rows, delete with undo.
- `composer/message-composition`: the composer — verbatim text, send rules, the Model/Effort/Mode chips, the queue and plan drawers, locked states.
- `composer/references`: `[Image #N]`, `[Element #N]`, `[Asset #N]`, media attachments, paste and drop, previews.
- `composer/file-mentions`: `@` file tagging inside and outside the project.
- `preview/live-preview`: the project's own bundler with the studio's Player entry — hosts, composition selection, serving, media, recovery, failure wording.
- `preview/inspect`: pointing at an element — arming, picking, selection identity, markers and the comment card, the playhead.
- `preview/properties-pane`: tuning a selected element live — controls per field type, chains, refusals, resets, animated and keyframed values.
- `preview/write-to-code`: writing tuned values into the project's TSX at Send through the project's own codemods.
- `preview/snapshot`: a still or a cropped region of the frame as an image attachment, at click speed.
- `export/mp4-export`: the export dialog and the render job — presets, destination, pinned bundle, progress, cancel, refusals.
- `export/render-settings-and-browser`: the project's own render settings read fresh, the GL policy and probe, failure classification.
- `library/asset-library`: saving, listing, inserting, deduplicating, deleting and previewing assets; thumbnails, audiomaps and footage proxies.
- `library/stock-search`: Pexels search and save inside the studio.
- `library/moodboard`: the agent-curated board rendered to a PNG and stored as an asset.
- `library/components-and-roles`: the bundled remocn components, motion roles, the Components pane.
- `account/sign-in`: device-flow sign-in with the token held in the keychain by the core.
- `account/plans-and-entitlement`: the signed entitlement document, Free / Pro gates, the trial card, upgrading from the app.

### Modified Capabilities
- none — there are no existing specs.

## Impact

- `openspec/specs/**` gains one spec per capability above; `openspec/changes/archive/` keeps this change as the record of when the baseline was taken.
- No source, contract, sidecar, Rust or webview code is touched. CLAUDE.md is untouched; discrepancies found while writing are listed in the final report for follow-up changes.
