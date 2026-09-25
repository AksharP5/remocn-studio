## Context

See proposal.md for the why. Today the plan is decided in the webview and enforced on both sides:

- **Webview.** `useAccount` reads the signed entitlement through the core's `account_*` commands, with `entitlement.json` (a plugin-store file in app data) as the offline cache. It collapses that to a `PlanTier`. `usePlanTier` holds the tier in a ref, and every turn, every code write and every `studio.patch` reads it at the moment it goes out. The same tier locks Inspect and Snapshot in `useTools` and drives the trial card.
- **Sidecar.** `sidecar/agent/plan.ts` turns the tier into four decisions: the skills bundle (`locateBundle`), the pipeline server and brief (`serversFor`, `pipelineAllowed`), the conventions set (`conventionsFor` → `FREE_CONVENTIONS`), and writes (`writesAllowed` → `WRITES_ARE_PRO`).
- **Rust core.** `account.rs` owns the device flow, the session token in the keychain (`com.remocn.remocn-studio` / `session-token`) and every request to `REMOCN_STUDIO_ACCOUNT_URL`. The integrations keep their own items under the same service (`integration:<id>`), through `integrations/keychain.rs`.

`src-tauri/src/ipc.rs` mirrors no `plan` field. Only `PROTOCOL` has to move on the Rust side.

## Goals / Non-Goals

**Goals:**

- Every turn and write behaves exactly as a Pro one did. The conventions a turn receives are byte-for-byte the old Pro text.
- No code path, type or IPC field is left that can express a plan.
- Leftovers from an old install are removed without a prompt on a signed release, and without any network call.

**Non-Goals:**

- A feature flag, or a "Pro" type kept for later.
- Migrating or deleting the `trialCardsDismissed` key in `settings.json`.
- Changing the integrations' keychain handling.

## Decisions

### 1. Remove the `plan` field; do not pin it to `"pro"`

Always sending `"pro"` would be the smallest diff. It would also leave a dead parameter on six functions, a type import from a deleted module, and a decoding default (`"free"`) that silently downgrades any frame that forgets the field. Removing the field from `PromptParams`, `WriteParams` and `studio.patch` removes the downgrade path entirely.

The frame shape changes, so the rule applies: `SIDECAR_PROTOCOL` and Rust `PROTOCOL` go from 36 to 37, and `shared/protocol.test.ts` checks they agree. Schema structs ignore excess keys on decode, so a stray `plan` from a stale dev bundle would be harmless. The bump is still what guarantees an old sidecar never meets a new webview and falls back to its `"free"` default.

### 2. Every seam the plan passed through gets the Pro branch, and the branch disappears

| Seam | Now | After |
|---|---|---|
| `locateBundle(cwd, plan)` | returns `noBundle(PLAN_REASON)` on Free | `locateBundle(cwd)`. The `PLAN_REASON` special case in `announce` and in the notice goes |
| `conventionsFor(video, …, plan)` | `FREE_CONVENTIONS` on Free | always the full set. `FREE_CONVENTIONS` is deleted |
| `handlers.ts` turn | `serversFor(plan)`, `pipelineAllowed(plan)` | `TOOL_SERVERS` from `sidecar/tools/specs.ts` (already the list of all three), and the brief is always `pipelineBrief(stages, video)` |
| `handlers.ts` writes and patch | `writesAllowed(plan)` → `WRITES_ARE_PRO` | no check |
| `useTools` | `isLocked`, `lockedReason`, `onArm` | removed. The other unavailability reasons are unchanged |
| `useManagedObjects` | hard-coded `plan: "pro"` | field dropped |
| `useOnboarding` blocked | `… \|\| trialCard.card !== null` | term dropped |

`sidecar/agent/plan.ts` is deleted outright. Its only surviving content would have been the three-server list, which `TOOL_SERVERS` already is.

Byte-identical conventions are proved by the existing `conventions.test.ts` assertions on the Pro output. Those tests keep their expectations and lose only the `plan` argument. The Free-branch tests are deleted.

### 3. The one-time cleanup lives in the core, triggered by the cache file

**Owner.** The Rust core: it owns the keychain, and it runs before any webview code. The cleanup is a small module (`src-tauri/src/legacy_account.rs`) called from `setup` on a blocking task, so a slow keychain call cannot delay the window.

**Steps.** If `app_data_dir()/entitlement.json` exists, the core runs `keyring::Entry::new("com.remocn.remocn-studio", "session-token").delete_credential()`, treating `NoEntry` as success, then removes the file. Failures go to the core's log (stderr), never to the person.

**Why the file is the trigger.** The trigger has to fire once and never again without a new marker. The cache's existence already marks "this Mac ran a version that was signed in", because the entitlement is cached right after the device flow completes. Deleting the file afterwards is what makes the cleanup one-time.

**Alternatives ruled out:**
- *Delete the keychain item unconditionally on every launch.* That is cheap (a missing item is `NoEntry`), but it is permanent code and a keychain call per launch, forever.
- *A dedicated marker file or `settings.json` key.* That is new state added only to delete old state.
- *Doing it from the webview.* The webview cannot reach the keychain; only Rust holds secrets.

**Failure direction.** If the token deletion fails, the file is removed anyway. Retrying on every launch would re-raise a keychain prompt on every debug launch, while a leftover token for a dead service harms nothing. The one gap: a Mac that signed in but never cached an entitlement (the fetch failed right after the device flow) keeps its token. That is an accepted edge case.

**Keychain prompt.** A signed release deletes an item created by the same Team ID with no prompt: the item's ACL names the designated requirement, not the cdhash. An unsigned debug build deleting an item written by an earlier debug build may raise the system prompt once, the same class of prompt CLAUDE.md already documents for integrations.

### 4. Delete the account UI and its state

Deleted outright: `hooks/use-account.ts`, `use-plan-tier.ts`, `use-trial-card.ts`; `lib/studio/account.ts`, `entitlement.ts`, `trial-card.ts`; `shared/account.ts`, `shared/entitlement.ts`; and `components/studio/account-section.tsx`, `account-status.tsx`, `pricing-cards.tsx`, `checkout-status.tsx`, `sign-in-controls.tsx`, `trial-card.tsx`. All of them go with their tests and fixtures.

- `SETTINGS_SECTIONS` loses `"account"`, and `openAccount` goes. The open section is in-memory React state, not persisted, so nothing needs migrating.
- `settings-page.tsx` still needs `shortDay` for the Updates section's *Published …* line. It moves from `lib/studio/account.ts` into `lib/studio/time.ts`, with its test.
- `projects-pane` keeps `useNow`, which it also passes to rows. Only the `<AccountStatus>` item leaves the footer.
- `lib/studio/settings.ts` drops the `trialCardsDismissed` field, its key constant and `saveTrialCardsDismissed`.

### 5. Specs and records

**Settings-page overlap.** The open `integrations-framework` change already rewrites the two `shell/settings-page` requirements this change touches, and its text still lists Account and the trial card. Its delta is edited to match this one, so the end state is the same whichever change archives first.

**Tips overlap.** `feature-onboarding` (complete, unarchived) removes the tips requirement that named the trial card. This change therefore carries no `shell/tips` delta.

**Emptied capabilities.** After archive, `account/plans-and-entitlement` and `account/sign-in` hold zero requirements, and their directories are deleted by hand.

**Purpose and config text.** `shell/settings-page`'s Purpose mentions "the account itself" and is edited directly. `openspec/config.yaml` loses the Free/Pro invariant and "plan (Free / Pro)" from its vocabulary.

**Decision records.** `docs/decisions/signing-in.md`, `the-line-between-free-and-pro.md` and `upgrading-from-the-app.md` get a first line saying the feature was removed by REM-520 and the file is history.

## Risks / Trade-offs

- **An old build keeps calling `/api/studio/*` until it updates.** The backend owns keeping those endpoints answering until the rollout. Nothing on the app side can change it.
- **A person mid-trial sees the card and the sidebar row vanish with no explanation.** The changeset's release note says Pro is now free for everyone.
- **A large deletion hides a missed reference.** `bun run typecheck` catches every import of a deleted module, and a final `git grep` for `PlanTier|entitlement|trial|PRO_` outside `docs/` and `openspec/changes/archive` must come back empty.
- **The cleanup is written for a population that shrinks to zero.** It is ten lines in its own module and can be deleted a few releases later.

## Migration Plan

Ship as one release. Rollback means reverting the commit. A rolled-back build would find no token and no cache, and would read as signed out on Free, which is the correct state for a reinstated paid plan.

## Open Questions

- When to delete the cleanup module. It is safe after any release that most installs have passed through. The updater's adoption is not measured (there is no telemetry), so pick a version by judgement.
