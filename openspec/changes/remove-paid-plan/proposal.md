## Why

REM-520. Creem declined the store, so Pro cannot be sold. The decision: there is no paid plan, and everything Pro unlocked is available to everyone, with no sign-in and no trial. The remocn account exists in the studio only to carry that plan, so it goes too. The landing and backend side is already done.

## What Changes

- **Every Pro gate is lifted, on both sides.** Every turn gets the skills bundle, the pipeline server and the stage brief, the full conventions and write-to-code. Inspect and Snapshot are never locked for a plan reason.
- **BREAKING (IPC):** `plan` leaves `agent.prompt`, the code-write request and `studio.patch`. `SIDECAR_PROTOCOL` and Rust `PROTOCOL` go from 36 to 37.
- **The account stack is deleted, not hidden.** That covers the device-flow sign-in, the keychain session token, the signed entitlement document and its cache, checkout, the billing portal, the device list, the trial card, Settings › Account, the account row in the sidebar footer, and every trial, Pro, Upgrade and price string.
- **The core drops `account.rs`** (ten commands) and `REMOCN_STUDIO_ACCOUNT_URL`. `keyring` and `reqwest` stay for the integrations.
- **Installed copies are cleaned once.** The first launch after the update deletes the old session token from the keychain and the `entitlement.json` cache. Nothing is sent anywhere.
- A changeset tells people who started a trial that everything is now free.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account/plans-and-entitlement`: every requirement removed.
- `account/sign-in`: every requirement removed.
- `agent/knowledge`: the bundle is always located and the conventions are always the full set. The Free requirement and the "plan" exception to the failure notice are removed.
- `agent/pipeline`: the stage brief rides on every turn with an active stage.
- `agent/studio-tools`: every turn gets all three servers.
- `agent/turns`: a queued message re-reads no plan at dispatch.
- `preview/write-to-code`: "Writing into the code is part of Pro" is removed.
- `preview/inspect`, `preview/snapshot`: the plan is no longer a reason to be unavailable.
- `projects/open-template-link`: "A link works signed out and on Free" is removed. There is nothing left to be free of.
- `shell/settings-page`: no Account section, and Settings no longer opens from the account row or the trial card.
- `shell/quit-and-updates`: an update removes what the old account left on the Mac.

## Non-goals

- **Keeping sign-in "for later".** Nothing else needs it, and dormant keychain, signature and polling code is only surface for bugs. Git history holds the whole Free & Pro milestone.
- **Landing and backend work.** Switching off `/api/studio/*` for old builds is the backend's job.
- **Provider sign-in, integrations, stock media and template links.** None of them depend on the account.
- **Clearing `trialCardsDismissed` from `settings.json`.** Once nothing reads it, the key is inert.
- **"plan" in its other sense.** The agent's plan and plan mode stay. Only Free/Pro leaves.

## Impact

- **Shared contract:** the `plan` fields in `shared/ipc.ts`, and `SIDECAR_PROTOCOL` 37. `shared/entitlement.ts` and `shared/account.ts` are deleted.
- **Sidecar:** `agent/plan.ts` is deleted. `knowledge.ts`, `claude/conventions.ts`, `handlers.ts`, the four adapters and `acp/turn.ts` lose their `plan` argument.
- **Rust core:** `account.rs` is deleted. `lib.rs` gains the one-time cleanup. `ipc.rs` goes to `PROTOCOL` 37, and `build.rs`, `.env.example` and `publish.yml` are updated.
- **Webview:** the account, entitlement, trial-card and plan-tier hooks, libs and components are deleted. The `plan` plumbing and the Pro lock are removed from their hooks. Settings, the sidebar footer and the chat pane lose their account UI.
- **Tests:** suites for deleted code are deleted, and fixtures carrying `plan` or `trialCardsDismissed` are updated.
- **Docs:** CLAUDE.md, `openspec/config.yaml`, the three decision records (marked historical), and the `integrations-framework` delta that still names Account and the trial card.
