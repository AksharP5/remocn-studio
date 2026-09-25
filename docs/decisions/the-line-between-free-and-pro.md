# The line between Free and Pro

> **Removed on 2026-09-24 (REM-520).** Creem declined the store, so the studio has no paid
> plan and no remocn sign-in: everything that was Pro is available to everyone, and the code
> this record explains was deleted in the `remove-paid-plan` change. Read it as history only —
> the specs it links to are gone.

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`account/plans-and-entitlement`](../../openspec/specs/account/plans-and-entitlement/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The plan flag lives in the client and the content stays in the bundle (REM-346); the
repository is private and a patched `.app` is the ordinary risk of a desktop app, so
the gate is honest rather than hardened. What it does is pin, in one list, everything
Pro adds — `PRO_FEATURES` in `shared/entitlement.ts`: the skills bundle, the pipeline
tools, the craft conventions, writing values into the code, Inspect and Snapshot — and a
test on each side asserts that its gates and the list agree, so a feature added to Pro
cannot be gated nowhere.

- **A document is believed only once it verifies.** `verifyEntitlement` is one
  Ed25519 verify over the payload's own ASCII bytes with the raw public key baked in
  as `ENTITLEMENT_PUBLIC_KEY` — the same bytes `signEntitlement` on the landing signed,
  so there is no canonical JSON to agree on. WebCrypto does it in the webview (WebKit
  and bun both carry Ed25519), and the landing's frozen `contracts/entitlement.example.json`
  is pinned in `shared/entitlement.test.ts` with the test key that signed it, so the two
  repos cannot drift on what "signed" means. Tests that need a document that verifies
  sign with a throwaway pair from `lib/studio/entitlement.fixture.ts` and swap the public
  half in with `vi.mock` — never by weakening the check.
- **The cache holds the envelope, not the document.** `entitlementCache` in
  `lib/studio/entitlement.ts` is a `plugin-store` file, `entitlement.json`, holding the
  signed answer as it came; a load re-runs the same verification a fetch does, so a file
  edited by hand reads as no cache. `readEntitlement` is the policy: the server first,
  the cache when the server cannot answer, nothing when neither verifies — and a `401`
  passes straight through, because a cached document must never paper over a device
  that was signed out. Signing out and a `401` both clear it.
- **Expiry is `planAt`'s, and it is worded, not silent.** Past `expiresAt` the document
  vouches for nothing: the plan is `free` with `unverified: true`, Settings › Account
  says the subscription could not be verified, and the trial card's `unverified` kind
  offers *Check again*. `useAccount` re-reads once a day while signed in — `REFRESH_EVERY`,
  a forked `Effect.sleep` loop interrupted when the session ends — which is how a card
  that failed reaches the app without a relaunch. Without an account there is no
  document and no request: `tierOf(null)` is `free`.
- **The plan crosses to the sidecar on every turn**, as `plan` on `agent.prompt`
  (protocol 27), decoding to `free` when absent because a missing field must never read
  as Pro. `useTurns` takes a getter and reads it at dispatch, like the provider, so a
  queued message goes out under the plan the account holds *then*: a downgrade bites
  the next turn and the running one finishes. The getter is a ref (`usePlanTier`),
  because the workspace is built before the account is.
- **Four gates in the sidecar, one module.** `sidecar/agent/plan.ts`: `locateBundle`
  answers `loaded: false, reason: "plan"` before it looks at the disk, and that one
  reason raises no notice — Free is not a failure; `serversFor` leaves `remocn-pipeline`
  out of the transports a Free turn is handed (`TurnServices.tools` is `Partial` now)
  and the pipeline brief is not written; `writesAllowed` is what `preview.write`
  refuses on, so the one gate over the person's own disk sits where the disk is;
  `conventionsFor` takes the plan and on Free returns `FREE_CONVENTIONS` — the lane, `Root.tsx`, the audiomap, editability and the
  reference paragraphs — dropping the concept, the design check, the taxonomy, the
  camera, the tunable shape, the moodboard and the pipeline. `STUDIO_CONVENTIONS` is
  the same four sections joined, so a Pro turn reads byte-for-byte what it read before;
  the library server stays on Free, and so does the design server, which reads what
  is on disk and asks nothing of the pipeline.
- **Inspect and Snapshot are disabled on Free, and the click is the way back.**
  `useTools` takes `isLocked` — `isOnFree`, so signed out counts — and answers
  `PRO_ONLY` as the reason on both tooltips; a click arms nothing and calls `onArm`,
  which on Free reopens the trial card. Export is untouched. History and the pipeline
  stages in SQLite are never touched by a downgrade and come back with Pro.
- **The key is the landing's.** `ENTITLEMENT_PUBLIC_KEY` was derived from the private
  key in the landing repo's `.env`; if production signs with another pair, the app
  reads every document as forged and lands on Free with the *not signed by the account
  server* line — the failure direction that keeps nothing it cannot prove.
