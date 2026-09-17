## Context

See proposal.md — Why. The limit has two halves in two repositories. The server half is `remocn-studio-landing`: `lib/devices.ts` exports `deviceLimit = 2`, and the `session.create.before` hook in `lib/auth.ts` throws `device_limit` with the active device list when the device-grant path would mint a third app session. The studio half is a distinct outcome threaded through four files: `account.rs` matches `device_limit` into `SignInPoll::DeviceLimit`, `shared/account.ts` decodes it, `awaitSignIn` in `lib/studio/account.ts` turns it into a `SignInOutcome`, and `useAccount` keeps it as `deviceLimit` state that `SignInControls` renders as the card and `AccountSection` echoes as `N of 2 signed in`.

Two constraints shape the removal. The Rust poll already has a fallback for any `error` string it does not know — `failure(FailureKind::Server, said(&body, status))`, where `said` reads `message`, then `error_description`, then `error` — so the server's sentence reaches the person without a dedicated branch. And the two halves cannot ship in the same commit, so one order has to be safe.

## Goals / Non-Goals

**Goals:**

- Leave no code path in the studio that knows a device count can end a sign-in.
- Keep the device list, *This Mac*, revoke-another-device and *A refused request means this device was signed out* untouched.
- Be safe in either shipping order between the server and the studio.

**Non-Goals:**

- Changing the landing's copy or pricing page; noted in the proposal's Impact, done there.
- Reworking the sign-in flow beyond the removal.

## Decisions

**Remove the branch, do not keep it as a defensive fallback.** The alternative was to leave `SignInPoll::DeviceLimit` and the card in place and only stop the server from sending it. That keeps ~90 lines, a schema member, a hook state and two tests alive for an answer the server will never give, and it leaves the spec describing a card no one can reach. The fallback the studio already has covers the case the defensive branch would: an unknown refusal becomes an `AccountError` of kind `server` carrying the server's `error_description`, `awaitSignIn` fails with it, and `useAccount` words it on the error line the same way an unreachable server is worded. The person loses only the device list from the failure, which is exactly the list they can read in Settings › Account on any Mac that is signed in.

**The unknown-refusal path is the existing one; nothing new crosses the wire.** Every account request is a Tauri command answered by the core, so this is the webview↔core contract in `shared/account.ts`, not `shared/ipc.ts`. No `SIDECAR_PROTOCOL` or Rust `PROTOCOL` bump, no history migration, no settings key. `SignInPoll` shrinks to five literal-tagged structs; `SignInOutcome` to four. The hook's `switch` over the outcome keeps a `default` arm only because Biome's `useDefaultSwitchClause` demands one; it is `absurd(outcome)` from Effect, so `signedIn`, `expired`, `denied` stay exhaustive and a new outcome fails `typecheck` rather than being ignored.

**Server first.** With the server still refusing and the new studio installed, the refusal reads as a sentence on the sign-in error line — degraded but worded, under *Every way a sign-in ends is said in words*. With the server no longer refusing and the old studio installed, nothing is ever sent, so the card's code is merely dead. Both orders are safe; the server goes first so no built studio ever shows the degraded form to a person.

**The count keeps a number and drops the denominator.** `N of 2 signed in` becomes `N signed in` (singular when one). Reading the count off `me.devices.length` stays; only the constant goes. The alternative — dropping the line and letting the list speak — loses the one-glance answer when the list is long, and the panel's description slot is where the spec says the count lives.

**The decision record stays as written.** `docs/decisions/signing-in.md`'s paragraph on the limit being answered in the browser is history: it explains why the card was shaped as it was. A one-line pointer to this change's date is added there rather than deleting the paragraph, so the failed-run record survives the feature.

## Risks / Trade-offs

- [The server still refuses when a studio built from this change reaches it] → The person sees *Signed in on 2 devices already. Sign one out to continue.* on the error line, without the list; Settings › Account on another Mac still lists and revokes. Server ships first so this never occurs in a release.
- [The landing's server refusal message names a screen that no longer exists] → The message is deleted with the throw; no message is left to drift.
- [A future per-plan device limit] → Would be a new capability with its own design; nothing removed here would be reused as-is, since the card's shape depended on the code being spent before the refusal.
- [`useAccount`'s outcome `switch` silently swallowing a future outcome] → the `default` arm is `absurd(outcome)`, so `bun run typecheck` fails if any outcome is left unhandled; the hook test that scripted `deviceLimit` is replaced by one that scripts an `AccountError` of kind `server` from the poll and asserts the error line carries its message and the phase is `signedOut`.

## Migration Plan

1. Landing: remove `deviceLimit` and the `session.create.before` throw; keep `rememberDevice`, `activeDevices`, `touchDevice` and the revoke route. Deploy.
2. Studio: this change, released through the normal Changesets flow.
3. Rollback: revert either half independently; both orders are safe as argued above.
