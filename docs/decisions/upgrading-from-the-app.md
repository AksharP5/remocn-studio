# Upgrading from the app

> **Removed on 2026-09-24 (REM-520).** Creem declined the store, so the studio has no paid
> plan and no remocn sign-in: everything that was Pro is available to everyone, and the code
> this record explains was deleted in the `remove-paid-plan` change. Read it as history only —
> the specs it links to are gone.

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`account/plans-and-entitlement`](../../openspec/specs/account/plans-and-entitlement/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Buying is the sign-in's shape again (REM-348): a page opened in the browser, a poll that
waits for the server to say so, and no return trip into the app.

- **The app never sees a card, or a price it did not ship.** `account_checkout` in
  `account.rs` posts the period to `/api/studio/checkout` with the device's bearer and
  answers only the `checkout_url`; `account_portal` does the same for the billing portal.
  The two prices in the menu are `PRO_PRICE` in `shared/account.ts`, a mirror of the
  landing's `lib/pricing.ts` — the one place in the app that quotes a number.
- **Buying happens in Settings › Account, on the same two cards the landing draws.**
  `PricingCards` is the account page's `UpgradeTiers` in the studio's tokens: a Yearly /
  Monthly toggle (yearly first, it is the cheaper one), Free marked as the plan the person
  is on, Pro's button carrying the period as `data-period` for `upgrade` to read off the
  event — the `noJsxPropsBind` shape every per-item handler here takes. The trial card's
  *Upgrade* and the Inspect / Snapshot tooltip only lead there; a menu of two prices on
  the card was the first version, and two prices with no features beside them is a
  choice nobody can make. The plan itself reads as one surface above the cards: the name,
  a badge with what is left, the sentence under it, and on a trial a bar of how much is
  spent between its two dates — `trialStartedAt` on the document, which the landing now
  emits so a thirty-day waitlist trial does not draw as seven.
- **The poll is `awaitSubscription`, pure and tested like `awaitSignIn`.** Every five
  seconds for ten minutes, reading the entitlement through the same `readEntitlement` the
  boot uses but counting only a *server* answer — a cached document can never say "paid".
  A poll the server could not answer is skipped, not raised, because the browser has the
  person's attention and not the app; only a `401` ends the wait, as a sign-out. Past the
  patience it stops and offers *Check again*, which is one poll on a button. Success is
  `isSubscribed` — plan `pro` with no trial and no grace — and ends on one line,
  *Subscription active*; since the plan turning Pro takes the trial card away, that line
  gets a card of its own above the composer when nothing else is showing it.
- **Cancel is a fiber interrupt** on the purchase, and signing out, a `401` and unmount all
  interrupt it too. The checkout URL is kept so *Open the checkout again* costs no second
  request — a second `POST /checkout` would be a second Creem attempt.
- **A declined card goes to the portal, not the account page.** The grace card's *Update
  card* is `openPortal`; the server answers *no subscription* for an account with none,
  and that sentence is the error line rather than a page that would say the same.
- **What the running app has to confirm:** a test-card purchase from the app ending on
  `Pro` in Settings without a relaunch, and a manual `past_due` on the server showing the
  grace card on the next daily read.
