## 1. Configuration

- [x] 1.1 Fill `openspec/config.yaml` with the project context (product, stack, invariants, conventions), per-artifact rules and apply/archive guidance; verify `openspec instructions specs --change baseline-current-state --json` returns the rules

## 2. Delta specs, one per capability, verified against the code and its tests

- [x] 2.1 `shell/*` — startup, layout-and-panes, settings-page, quit-and-updates, tips, crash-reporting; verify each file has a Purpose, only ADDED requirements, and a scenario per requirement
- [x] 2.2 `sidecar/*` and `projects/environment-checklist`, `projects/dependency-install`; same verification
- [x] 2.3 `projects/project-lifecycle`, `projects/project-settings-and-brand`, `projects/videos`, `projects/open-template-link`; same verification
- [x] 2.4 `agent/turns`, `agent/permissions`, `agent/providers`; same verification
- [x] 2.5 `agent/knowledge`, `agent/studio-tools`, `agent/pipeline`, `agent/design-check`; same verification
- [x] 2.6 `history/*` and `composer/*`; same verification
- [x] 2.7 `preview/live-preview`, `preview/snapshot`, `preview/inspect`; same verification
- [x] 2.8 `preview/properties-pane`, `preview/write-to-code`; same verification
- [x] 2.9 `export/*`; same verification
- [x] 2.10 `library/*`; same verification
- [x] 2.11 `account/*`; same verification

## 3. Review

- [x] 3.1 Every capability listed in proposal.md has exactly one delta spec and no delta spec exists for an unlisted capability; verify by diffing the two lists
- [x] 3.2 Read each spec against `rules.specs` (observable behaviour, failure direction, vocabulary, one seam); reword what reads as implementation
- [x] 3.3 `openspec validate baseline-current-state --strict` passes
- [x] 3.4 Discrepancies between CLAUDE.md and the code found while writing are collected into the final report for follow-up changes

## 4. Archive

- [x] 4.1 `openspec archive baseline-current-state --yes` creates every main spec under `openspec/specs/` and moves the change to `openspec/changes/archive/`
- [x] 4.2 `openspec validate --specs` passes on the main specs and `openspec list --specs` names every capability
