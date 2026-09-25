# Signing in, and what a trial card is for

> **Removed on 2026-09-24 (REM-520).** Creem declined the store, so the studio has no paid
> plan and no remocn sign-in: everything that was Pro is available to everyone, and the code
> this record explains was deleted in the `remove-paid-plan` change. Read it as history only —
> the specs it links to are gone.

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`account/sign-in`](../../openspec/specs/account/sign-in/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Free needs no account; signing in is the door to the trial and to Pro (REM-347). The
studio signs in through the landing's better-auth **device authorization** grant, the
same way a CLI does: it asks for a code, opens the confirmation page in the browser, and
polls until the person confirms there.

- **The token never enters the webview, and neither does the HTTP.** `src-tauri/src/account.rs`
  holds both: the session token lives in the login keychain under
  `com.remocn.remocn-studio` / `session-token` through the `keyring` crate, and every
  request to the account server is a Rust command — `account_sign_in_start`,
  `account_sign_in_poll`, `account_sign_in_cancel`, `account_me`, `account_entitlement`,
  `account_revoke_device`, `account_sign_out`, `account_status`. Two measurements forced
  this rather than a `fetch` from the page: the landing sets no CORS headers, so a
  `tauri://localhost` origin cannot call it; and the device's *name* travels in the
  `User-Agent` (`Remocn Studio/<version> (macOS <os>; <ComputerName>)`, the shape
  `describeDevice` parses), a header a browser refuses to let a page set. The issue's
  `auth_read` — a command handing the token to the webview — therefore does not exist:
  a command that *uses* the token is one fewer place it can be logged from.
- **The pending device code stays in Rust too.** `account_sign_in_start` keeps it in a
  `Mutex` and answers only the user code, the confirmation URL, the lifetime and the
  interval; `account_sign_in_poll` reads it back. So the page holds nothing it could
  replay, and cancelling is `account_sign_in_cancel` clearing the slot.
- **Polling is a fiber, and Stop is an interrupt.** `awaitSignIn` in
  `lib/studio/account.ts` is the loop — sleep the server's interval, poll, and add five
  seconds per `slow_down` (`pollDelay`, tested on its own); `expired_token`,
  `access_denied` and the device limit are *outcomes* of that effect, not failures, so
  the hook words each of them and a genuine failure is the only thing that reaches the
  error line. `useAccount` keeps the fiber in a ref and `Effect.onInterrupt` tells the
  core to forget the code, exactly as a turn's cancel sends the cancel frame. The wait is
  injectable (`sleep` in `AccountOptions`) so the hook's test steps the loop through a
  gate instead of a timer — a `sleep` of zero starved the test DOM's event loop and hung the
  suite for a hundred seconds before the gate existed.
- **A `401` is this device having been signed out, and the core forgets the token.** The
  account page's *Sign out on this device* deletes the session, so the app's next request
  gets `401`; `signed()` in `account.rs` clears the keychain on exactly that status and
  answers `kind: "unauthorized"`, which the webview turns into *This device was signed
  out* and the signed-out state. Offline (`is_connect`/`is_timeout`) and any other status
  are `offline` and `server`, and both leave the token where it is.
- **The device limit is answered in the browser, not in the app, and that is a gap
  worth knowing.** `session.create.before` throws `device_limit` with the device list
  *after* `redeemDeviceCode` has consumed the code and *before* a session exists — so
  the app has a list and no token to revoke with, and the code it holds is spent. The
  card therefore shows the devices with their last-seen times, opens `/account` to sign
  one out, and *Try again* starts a fresh grant. Revoking from inside the card needs a
  backend endpoint that accepts something other than a session (REM-341 follow-up).
  *History as of 2026-09-16*: the limit itself was removed by the `remove-device-limit`
  change — the server no longer refuses the grant for the count, the card is gone, and
  the follow-up is moot; the paragraph stays as the record of why the card was shaped so.
- **The plan is read from the entitlement document, and only from it.**
  `shared/entitlement.ts` is the contract with the landing's `buildEntitlement` +
  `signEntitlement`: `{ payload, signature, algorithm }`, the payload base64 of the
  document's JSON, pinned by a fixture test in the shape the server emits. `planAt`
  reads the four states Settings › Account shows — free (remembering an ended trial),
  trial, pro, grace — from `plan`, `trialEndsAt` and `graceEndsAt`; the app computes no
  date of its own, so the trial starts when the *server* says it started, which is at
  first sign-in and never at install. The signature is checked, the document is
  cached, and the plan gates the app — see *The line between Free and Pro*.
- **A paid subscription retires the trial on the server's side** (REM-348). `planAt`
  reads grace before trial before pro, and the document carries no subscription status,
  so a purchase made mid-trial used to read as the trial it was made in; `buildEntitlement`
  on the landing now emits `trialEndsAt: null` once a subscription is paid, which is what
  lets `isSubscribed` — plan `pro`, no trial, no grace — mean "bought". What the document
  still cannot tell apart is an active subscription from one whose `graceEndsAt` merely
  lingers from an earlier failure; a `status` field on the document is the fix, server-side.
- **The trial card is the environment checklist's slot, worded three ways.**
  `trialCardOf` in `lib/studio/trial-card.ts` is the pure rule: `invite` while signed
  out (and while signing in — the card hosts the pending state), `trialEnded` once a
  free document names a `trialEndsAt` in the past, `grace` while `graceEndsAt` is ahead.
  Each carries an id — `invite`, `trial-ended:<date>`, `grace:<date>` — and
  `trialCardsDismissed` in `settings.json` is the list of ids answered with the ×, so an
  ended trial asks once and a second trial (there is none, but the id says so) would ask
  again. Nothing about the dismissal reaches the server.
- **Inspect and Snapshot bring the invite back on Free.** `useTools` takes `onArm`, called
  when either mode is armed, and `useTrialCard.reopen` lifts the dismissal for this launch
  only when `isOnFree` — signed out, or a document whose plan is free; an unread plan is
  not Free. On Free the buttons are disabled and the click is routed here — see *The line
  between Free and Pro* — with the tooltip worded for whoever is reading it: sign in to
  start the trial, or upgrade to keep them.
- **No card until the core has answered.** `phase: "unknown"` — no `account_status` yet,
  or no core at all, which is every existing test's fake — shows nothing, so a browser
  tab running `bun dev` and the whole suite see the studio as it was. A card that
  appeared before the app knew whether someone was signed in would be the wrong card
  half the time.
- **The origin is `REMOCN_STUDIO_ACCOUNT_URL`, and it lives in `.env`.** Baked at
  compile time with `option_env!`, and `src-tauri/build.rs` is what puts it there: it
  reads the repo's `.env` itself and emits `cargo:rustc-env`, with the process
  environment winning (the release job sets it in `publish.yml`). Measured before that
  existed: `bun tauri dev` loads `.env` into bun's own `process.env` but the value never
  reached the compiled binary, so the app reported the variable unset with the line
  sitting right there in the file. `rerun-if-changed` on `.env` means editing the value
  rebuilds the core on the next `bun tauri dev`. The same variable on the *running* core's environment wins
  over the baked one, for a landing on `localhost:3000`. There is no literal fallback in
  the code — unset, every account command answers *REMOCN_STUDIO_ACCOUNT_URL is not
  set* rather than quietly talking to a domain nobody chose. The webview learns the
  origin from `account_status` and builds `/account/billing` from it for *Manage
  billing*, *Upgrade* and *Update card*, and `/account` for the device-limit card; the confirmation URL itself comes from the server's
  `verification_uri_complete`.
- **A development build is unsigned, and the keychain knows.** macOS ties an item's
  access to the binary that wrote it; each rebuild of `target/debug/remocn-studio` is a
  different binary, so the first keychain read after a rebuild may raise the system's
  own *wants to use your confidential information* prompt. A released, signed build
  asks once. Nothing in the app can suppress it, and nothing should.
