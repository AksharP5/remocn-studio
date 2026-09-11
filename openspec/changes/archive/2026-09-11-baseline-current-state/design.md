## Context

See proposal.md — Why. The studio is at 0.7.0 with no specs; CLAUDE.md is a long record of *why* each decision was taken and of the measurements behind it, the tests pin the behaviour, and nothing states the promises in one place. OpenSpec's model is that `openspec/specs/` is the current truth and every change is a delta against it, so the first change has to *be* the current truth. This change touches no code, no contract and no process; it only writes.

## Goals / Non-Goals

**Goals:**
- One main spec per observable capability, organised so that a later change can find the capability it modifies without reading forty files.
- Every requirement true of the code on 2026-09-11, verified against the source and the tests rather than transcribed from CLAUDE.md.
- The failure direction written down wherever the studio already has one, because that is where later changes most often regress.

**Non-Goals:**
- Replacing CLAUDE.md. The specs say *what*; CLAUDE.md keeps *why* and the measurements. The two are complementary and both stay.
- Specifying the build, the tests, CI, the release pipeline, the vendoring scripts or the smoke fixtures.
- Fixing anything found along the way. Discrepancies between CLAUDE.md and the code are reported, not resolved.

## Decisions

- **The baseline goes through a change and an archive, not through hand-written main specs.** `openspec/specs/` could have been written directly, but then nothing validates it, nothing records when it was taken, and the first real change has no example of the delta format to copy. Archiving runs `openspec validate`, seeds every main spec's Purpose from the delta, and leaves the change under `changes/archive/` as the record. The cost is one archived change whose tasks describe writing rather than building — accepted.
- **Capabilities are nested by domain** (`shell/`, `sidecar/`, `projects/`, `agent/`, `history/`, `composer/`, `preview/`, `export/`, `library/`, `account/`), one directory per seam of the app. Thirty-eight flat directories would read as a list; ten domains read as the app's layout, which is also how CLAUDE.md is sectioned and how the code is laid out (`sidecar/agent`, `sidecar/preview`, `sidecar/library`). The `rules.specs` entry in `config.yaml` asks later changes to reuse a path before creating one.
- **Capability boundaries follow ownership of the decision, not the screen.** The Docs pane lives under `agent/pipeline` because the pipeline decides what is in it; the proxy is *created* under `library/asset-library` and *served* under `preview/live-preview`; `[Element #N]` is the composer's while the selection it points at is Inspect's. Where a behaviour spans two capabilities the spec names the other capability in prose rather than duplicating the requirement.
- **The code wins over CLAUDE.md.** CLAUDE.md trails the tree in places (project settings and brand, DESIGN.md import, moving a project, the full readiness audit, motion contracts are documented only under `docs/plans/`). Each capability was written by reading the modules and the tests behind it; a claim that could not be confirmed was left out and reported.
- **Granularity: six to fourteen requirements per capability, two to four scenarios each.** Fewer and a requirement becomes a paragraph nothing can test; more and the file stops being readable in one sitting. Related rules are grouped into one requirement with several scenarios rather than one requirement per rule.
- **Numbers, file names and keys appear only where they define behaviour.** A ten-minute auto-deny, the 4000-file walk cap, `taskDock` in `settings.json`, `REMOCN_STUDIO_BUN` — these are the behaviour. Everything else is described in words so an implementation can move without invalidating the spec.
- **Nothing crosses a wire, no state is added, no protocol moves.** The design rules about process ownership, `SIDECAR_PROTOCOL`, migrations and Effect usage do not apply to a change that writes markdown; they are noted here so a reader does not look for them.

## Risks / Trade-offs

- [A requirement written as implementation] → the `rules.specs` entries in `config.yaml` and the brief every writer followed ask for observable behaviour; the review task reads each file against that rule.
- [A requirement that is not true of the code] → each capability was verified against modules and tests, and the final report lists what could not be confirmed; a later change may still find one, and the fix is a delta with a `MODIFIED` block.
- [Drift between CLAUDE.md and the specs over time] → the `operations.apply.guidance` asks every change to keep CLAUDE.md in step, and the specs are updated by archive; the two are edited in the same change.
- [Thirty-eight capabilities is a lot to keep current] → each is small and single-seam, so a change usually touches one or two; `openspec validate --specs` is the cheap check that they are still well-formed.
- [Later changes using `MODIFIED` with partial content lose scenarios at archive] → the specs instruction already warns; the archive validation refuses a `MODIFIED` block that drops a scenario the main spec has.

## Migration Plan

1. Validate the change (`openspec validate baseline-current-state --strict`).
2. Archive it (`openspec archive baseline-current-state --yes`), which creates every main spec under `openspec/specs/` and moves the change to `openspec/changes/archive/`.
3. Commit `openspec/`, `.claude/commands/opsx`, `.claude/skills/openspec-*` and `.agents/` together.
4. From then on every behaviour change is `/opsx:propose` → `/opsx:apply` → `/opsx:archive`; rollback is `git revert` of the archive commit.
