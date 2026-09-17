## 1. Shared contract

- [x] 1.1 In `shared/account.ts` remove `DeviceLimit` and its type and take it out of the `SignInPoll` union, leaving the five literal-tagged answers; verify with `bun run typecheck` that every remaining reader compiles once tasks 2–4 are done
- [x] 1.2 In `lib/studio/account.ts` drop the `deviceLimit` arm of `SignInOutcome` and the matching `case "deviceLimit"` in `awaitSignIn`, so the switch has `pending`, `slowDown` and the default that passes the status through; verify with `bun run test lib/studio/account.test.ts`
- [x] 1.3 In `lib/studio/account.test.ts` replace *carries the devices back when the limit is hit* with a case that scripts the poll failing with an `AccountError` of kind `server` carrying `Signed in on 2 devices already.` and asserts `awaitSignIn` fails with that same error and message; verify the file passes

## 2. Rust core

- [x] 2.1 In `src-tauri/src/account.rs` remove `SignInPoll::DeviceLimit` and the `Some("device_limit")` match arm, so that answer reaches the existing `_ => Err(failure(FailureKind::Server, said(&body, status)))`; verify with `cargo check` in `src-tauri/` and confirm the `pending` slot is still cleared for every non-pending outcome

## 3. Webview hook

- [x] 3.1 In `hooks/use-account.ts` remove `DeviceLimitHit`, the `deviceLimit` field on `Account`, the `deviceLimit` state, its two resets in `signIn` and `signOut`, and the `default` arm of `finishSignIn`, making the switch exhaustive over `signedIn`, `expired`, `denied`; verify with `bun run typecheck`
- [x] 3.2 In `hooks/use-account.test.tsx` replace *keeps the devices when the limit is hit, so the person can pick* with a case where the core's poll rejects with a `server` failure carrying the server's sentence, and assert `error` matches that sentence and `phase.kind` is `signedOut`; verify with `bun run test hooks/use-account.test.tsx`

## 4. Components

- [x] 4.1 In `components/studio/sign-in-controls.tsx` remove `DeviceLimitNotice` and its render, and make the button read *Sign in* unconditionally; verify no reference to `deviceLimit` or `lastSeen` remains in the file and `bun run typecheck` passes
- [x] 4.2 In `components/studio/account-section.tsx` remove `DEVICE_LIMIT` and word the Devices description as `1 signed in` / `N signed in` from `me.devices.length`; verify with `bun run test components/studio/trial-card.test.tsx` and that no `of ` remains in the description
- [x] 4.3 Add a scenario to `components/studio/trial-card.test.tsx` (the Settings › Account shell test) that mounts with three devices and asserts the Devices panel reads `3 signed in` and lists all three; verify it passes

## 5. Records and companion

- [x] 5.1 Add one line to the device-limit paragraph in `docs/decisions/signing-in.md` noting the limit was removed by this change on 2026-09-16 and the paragraph is history; verify the file still reads in order
- [x] 5.2 In `remocn-studio-landing`: remove `deviceLimit` from `lib/devices.ts` and the `session.create.before` throw from `lib/auth.ts`, keeping `after` (`rememberDevice`) intact, and reword the account page's Devices description so it no longer promises two; verify with that repo's `tsc --noEmit` and `biome check`
- [x] 5.3 `bun run changeset` — patch, *A sign-in is no longer refused for the number of Macs already signed in; Settings › Account counts devices without a ceiling*; verify the file lands in `.changeset/`

## 6. Verification

- [x] 6.1 `bun run check`, `bun run typecheck`, `cargo check` in `src-tauri/`; all three pass
- [x] 6.2 `bun run test lib/studio/account.test.ts hooks/use-account.test.tsx components/studio/trial-card.test.tsx`, then the full `bun run test` once before the commit; all pass
- [ ] 6.3 Deploy the landing before the studio release, then ask the user to check in the running app: signed in on one Mac, Settings › Account reads `1 signed in` with no `of 2`; against the deployed server, a third Mac signs in without a card
