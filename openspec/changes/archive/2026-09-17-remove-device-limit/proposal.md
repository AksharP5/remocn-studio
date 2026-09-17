## Why

An account may be signed in on two copies of the studio at once; a third sign-in is refused with a card that lists the other Macs and sends the person to the account page. The limit protects nothing the plan model needs — a Pro subscription is one document per account, and the agent's tokens are the person's own — and the card is the roughest edge in the sign-in: it appears after the device code is spent, cannot revoke from where it stands (the REM-341 follow-up), and turns a first sign-in on a new Mac into a trip through the browser. The limit goes, on the server and in the studio, before there are users to hit it.

## What Changes

- **A sign-in is never refused for the number of devices.** The server stops counting app sessions on the device grant. Every Mac still appears in the device list with its last-seen time and can still be signed out from another Mac or from the account page.
- **The device-limit card is removed from the studio.** The sign-in controls lose the notice with the named devices, the *Open account page* button and the *Try again* wording. A sign-in ends in one of four ways — signed in, declined, expired, or failed — and a refusal the studio cannot read is worded as the failure it already words today, carrying the server's own sentence.
- **Settings › Account stops counting against a ceiling.** *N of 2 signed in* becomes a plain count of the Macs signed in.
- **The shared contract shrinks.** The `deviceLimit` poll answer leaves the studio's schema of the core's answers, and the core no longer translates the server's `device_limit` refusal into a distinct outcome.

## Non-goals

- No change to the device list, to signing another device out, or to *A refused request means this device was signed out*. The account still tracks devices; it only stops capping them.
- No raised limit and no per-plan limit. Both would keep every piece this change removes; the decision is that there is no ceiling.
- No revoke-from-the-card. That follow-up existed only to soften the limit and dies with it.
- No change to the entitlement document. It carries the devices for the account page, not for a gate.
- Landing copy that names *two devices* is the landing's own change, listed under Impact, not done here.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `account/sign-in`: *The device limit is answered on the account page* is removed; *Every way a sign-in ends is said in words* gains the unknown-refusal scenario; *A signed-in studio shows the account and its devices* counts without a ceiling.

## Impact

- **Shared contract**: `shared/account.ts` loses `DeviceLimit` from the `SignInPoll` union; `lib/studio/account.ts` loses the `deviceLimit` arm of `SignInOutcome`. This is the webview↔core contract for account commands, not `shared/ipc.ts`; no `SIDECAR_PROTOCOL` bump.
- **Sidecar**: none.
- **Rust core**: `src-tauri/src/account.rs` drops `SignInPoll::DeviceLimit` and the `device_limit` match arm, so that answer falls into the existing server-failure path with the body's message.
- **Webview**: `hooks/use-account.ts` loses the `deviceLimit` state; `components/studio/sign-in-controls.tsx` loses `DeviceLimitNotice`; `components/studio/account-section.tsx` loses `DEVICE_LIMIT`. The two tests that script a `deviceLimit` poll are replaced by ones that script an unknown refusal and assert the worded failure.
- **Server (companion, other repo)**: in `remocn-studio-landing`, `lib/devices.ts` exports `deviceLimit = 2` and `lib/auth.ts` throws `device_limit` from the session-create hook on the device-grant path. The throw and the constant go; device tracking and the revoke route stay. The server ships first: a studio built from this change against the old server still shows a sentence, only without the device list.
- **Records**: `docs/decisions/signing-in.md` keeps its paragraph on the limit as history with a pointer to this change. Linear: no ticket yet; REM-341's follow-up is closed by this change.
