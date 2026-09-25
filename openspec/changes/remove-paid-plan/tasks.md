## 1. Shared contract

- [x] 1.1 Remove `plan` from `PromptParams`, `WriteParams` and the `studio.patch` params in `shared/ipc.ts`, and drop the `PlanTier` import and its decoding default. Bump `SIDECAR_PROTOCOL` to 37 there and `PROTOCOL` to 37 in `src-tauri/src/ipc.rs`. Verify with `bun run test shared/protocol.test.ts`.
- [x] 1.2 Move `shortDay` from `lib/studio/account.ts` into `lib/studio/time.ts`, carrying its cases over from `lib/studio/account.test.ts` into `lib/studio/time.test.ts`. Verify with `bun run test lib/studio/time.test.ts`.

## 2. Sidecar

- [x] 2.1 `sidecar/agent/knowledge.ts`: `locateBundle(cwd)` with no `plan`, and remove the `PLAN_REASON` branches in `announce` and the notice. Update the call sites in `claude/adapter.ts`, `codex/adapter.ts`, `copilot/adapter.ts` and `grok/adapter.ts`. Verify with `bun run test sidecar/agent/knowledge.test.ts`: Free cases deleted, and a not-loaded bundle for any reason still raises one notice.
- [x] 2.2 `sidecar/claude/conventions.ts`: delete `FREE_CONVENTIONS`, and `conventionsFor` loses `plan`. Update the calls in `claude/session.ts`, `codex/adapter.ts` and `acp/turn.ts`. Verify with `bun run test sidecar/claude/conventions.test.ts`: the former Pro expectations pass unchanged, which proves the text is byte-identical.
- [x] 2.3 `sidecar/handlers.ts`: the turn gets `TOOL_SERVERS` and always `pipelineBrief(stages, video)`. The code-write and `studio.patch` handlers lose the `writesAllowed` refusal. Delete `sidecar/agent/plan.ts` and `sidecar/agent/plan.test.ts`. No handler suite exists, so verify with `bun run typecheck`, plus `git grep -n "params.plan" sidecar`, which must come back empty.
- [x] 2.4 Drop `plan` from the sidecar fixtures in `sidecar/agent/plugin-args.test.ts`, `sidecar/claude/content.test.ts`, `sidecar/codex/content.test.ts` and `sidecar/history/recorder.test.ts`. Verify by running those four files.

## 3. Rust core

- [x] 3.1 Delete `src-tauri/src/account.rs`, and remove `mod account`, the ten `account::*` command registrations and `app.manage(account::Account::new(…))` from `lib.rs`. Remove `REMOCN_STUDIO_ACCOUNT_URL` from `build.rs`, `.env.example`, the local `.env` and `.github/workflows/publish.yml`. Keep `keyring` and `reqwest`, which the integrations use. Verify that `cargo check` and `cargo check --features crash-reports` pass in `src-tauri/`.
- [x] 3.2 Add `src-tauri/src/legacy_account.rs`, called from `setup` on a blocking task. If `app_data_dir()/entitlement.json` exists, delete the keychain item `com.remocn.remocn-studio` / `session-token` (with `NoEntry` as success), log any other failure to stderr, then remove the file. Add Rust unit tests over the decision (file present → token delete and file removal; file absent → no keychain call; delete failure → file still removed) with the keychain behind a small trait or closure. Verify with `cargo test legacy_account`.

## 4. Webview hooks and libs

- [x] 4.1 Delete `hooks/use-account.ts`, `hooks/use-plan-tier.ts`, `hooks/use-trial-card.ts`, `lib/studio/account.ts`, `lib/studio/entitlement.ts` (and its fixture), `lib/studio/trial-card.ts`, `shared/account.ts` and `shared/entitlement.ts`, together with `hooks/use-account.test.tsx`, `lib/studio/account.test.ts`, `lib/studio/entitlement.test.ts`, `lib/studio/trial-card.test.ts` and `shared/entitlement.test.ts`. Verify that `bun run typecheck` names every remaining importer, and fix those in 4.2–4.5.
- [x] 4.2 Remove the `plan` plumbing: `useTurns` (the `plan` argument and `FREE`), `useOpenTurn`, `useCodeWrites`, `useWorkspace`, and the hard-coded `plan: "pro"` in `useManagedObjects` (draft save and undo). Update the fixtures in `hooks/use-turns.test.tsx`, `hooks/use-code-writes.test.tsx`, `hooks/use-workspace.test.tsx` and `lib/studio/sidecar.test.ts`. Verify by running those four files.
- [x] 4.3 `hooks/use-tools.ts`: remove `isLocked`, `lockedReason`, `onArm`, `PRO_ONLY`, `PRO_ONLY_UPGRADE` and their branches in `unavailableOf` and the toggles. Delete the "useTools on Free" block in `hooks/use-tools.test.tsx`, and add a case asserting that Inspect and Snapshot arm when nothing else is in the way. Verify with `bun run test hooks/use-tools.test.tsx`.
- [x] 4.4 `hooks/use-settings-view.ts`: drop `"account"` from `SETTINGS_SECTIONS` and remove `openAccount`. `lib/studio/settings.ts`: drop `trialCardsDismissed`, `TRIAL_CARDS_KEY` and `saveTrialCardsDismissed`. Verify with `bun run test lib/studio/settings.test.ts components/studio/settings-page.test.tsx`.
- [x] 4.5 `components/studio/studio-provider.tsx`: remove `account`, `trialCard`, `plan` / `PlanHandle` / `useFollowPlanTier` / `planReaderOf`, the Inspect/Snapshot lock arguments, and `trialCard.card !== null` from the onboarding `blocked`. `app-shell.tsx`: remove `usePlanTier`. Verify with `bun run typecheck` and `bun run test app/page.test.tsx`.

## 5. Components

- [x] 5.1 Delete `components/studio/account-section.tsx`, `account-status.tsx`, `pricing-cards.tsx`, `checkout-status.tsx`, `sign-in-controls.tsx`, `trial-card.tsx` and `trial-card.test.tsx`. Remove `<TrialCard />` from `chat-pane.tsx`, `<AccountStatus>` and its footer item from `projects-pane.tsx`, and the Account rail entry and section from `settings-page.tsx`, which now imports `shortDay` from `lib/studio/time`. Update `task-dock.test.tsx`'s fixture. Verify with `bun run test components/studio/task-dock.test.tsx components/studio/settings-page.test.tsx`, with a case in the settings-page suite asserting that the rail has no Account row.
- [x] 5.2 Confirm no Pro or trial copy is left. `git grep -nE "\bPro\b|[Tt]rial|Upgrade|\\$1[59]|PlanTier|entitlement|PRO_FEATURES" -- app components hooks lib shared sidecar src-tauri/src` must return only the known unrelated matches: Remotion upgrade, "Pro or Max", Gemini Pro, the ElevenLabs plan, and `Entitlements.plist`.

## 6. Specs, docs and release note

- [x] 6.1 Edit `openspec/changes/integrations-framework/specs/shell/settings-page/spec.md` so its two requirements match this change's: no Account in the rail, no account row or trial card among the ways in, "the last two". Verify that `openspec validate integrations-framework --strict` passes.
- [x] 6.2 Edit `openspec/specs/shell/settings-page/spec.md`'s Purpose to drop "the account itself". Edit `openspec/config.yaml` to drop the Free/Pro invariant and "plan (Free / Pro)" from the vocabulary, and to replace "keychain-held account token" in the stack line with the integration secrets. Verify that `openspec validate --all --strict` passes.
- [x] 6.3 CLAUDE.md: remove the *Account and plans* map line, the *Free / Pro* working rule, `REMOCN_STUDIO_ACCOUNT_URL` from the Rust rule, "the account token in the keychain" from the Rust core line, and the account-token comparison in the keychain paragraph. Remove `account.ts + entitlement.ts` and `account.rs` from the Layout. Add a first line to `docs/decisions/signing-in.md`, `the-line-between-free-and-pro.md` and `upgrading-from-the-app.md` marking them history, removed by REM-520. Verify that `git grep -n "PRO_FEATURES\|entitlement" CLAUDE.md openspec/config.yaml` is empty.
- [x] 6.4 Add a changeset (`bun run changeset`, minor) saying Pro is gone and everything it had is free for everyone, with no sign-in, and that an old sign-in is forgotten on first launch.

## 7. Verification

- [x] 7.1 Run `bun run fix`, then `bun run check` and `bun run typecheck` (fix can drop or duplicate a JSX attribute), and `cargo check` with and without `--features crash-reports`.
- [x] 7.2 Run the full `bun run test` once. All green.
- [ ] 7.3 Ask the user to check in the running app (`bun tauri dev`):
  - Settings has no Account row, and the sidebar footer has no account row.
  - No trial card appears above the composer.
  - Inspect and Snapshot arm on a serving preview with nobody signed in.
  - A turn's catalog shows the pipeline tools and the skills bundle loads, with no "not loaded" notice.
  - A properties-pane edit is written into the code.
  - On a Mac that was signed in, the first launch removes `~/Library/Application Support/com.remocn.remocn-studio/entitlement.json` and the `session-token` item from Keychain Access, while the `integration:*` items stay. A debug build may raise one keychain prompt.
- [ ] 7.4 After archive, delete the emptied `openspec/specs/account/plans-and-entitlement/` and `openspec/specs/account/sign-in/` directories, and verify that `openspec validate --all --strict` still passes.
