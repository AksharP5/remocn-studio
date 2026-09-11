# account/plans-and-entitlement Specification

## Purpose
What Free and Pro are, how the studio decides which one it is on, and what changes when they differ. Covers the signed plan document the account server issues and the one key it is checked against, the cache behind it, the four plan states a person sees, the gates in the webview and the sidecar that make Pro mean something, the card that invites a trial or reports one ending, and buying a subscription from inside the app.

## Requirements

### Requirement: Pro is one list, and every entry on it is gated somewhere

What Pro adds SHALL be one list the app carries: the bundled skills, the pipeline tools, the craft conventions, writing values into the code, Inspect and Snapshot. Every entry SHALL be gated — four of them in the sidecar, two of them in the webview — and nothing else SHALL be withheld on Free. Exporting an mp4, the live preview, the asset library, stock media and the project itself SHALL work the same on both plans, and a drop from Pro to Free SHALL take nothing away that is already on disk: the chats, the transcripts and the pipeline documents SHALL survive and SHALL come back with Pro.

#### Scenario: A Free studio still makes videos

- **WHEN** the studio is on Free
- **THEN** chats, the preview, Export, the asset library and stock search all work

#### Scenario: Losing Pro

- **WHEN** a trial ends or a subscription lapses
- **THEN** nothing is deleted, and every chat, transcript and stage document is still there
- **AND** each of them is available again the moment the plan is Pro

### Requirement: A plan is believed only once its document verifies

The plan SHALL be read from a document the account server signs, and the studio SHALL believe it only after checking that signature against the public key the app ships. A document whose signature does not check, whose envelope is not the expected shape, or whose payload is not readable SHALL be a failure and never a plan: the studio SHALL read as Free and SHALL say the document is not signed by the account server.

#### Scenario: A genuine document

- **WHEN** the server answers with a document its key signed
- **THEN** the plan it names is the plan the studio is on

#### Scenario: A document edited after signing

- **WHEN** a document's payload has been changed since it was signed
- **THEN** it is refused, the studio is on Free, and the sentence names that it is not signed by the account server

#### Scenario: A signature that is not readable at all

- **WHEN** the signature cannot be decoded
- **THEN** the check fails as a refusal rather than as a crash

### Requirement: The server answers first, the cache answers when it cannot

The studio SHALL ask the account server for the plan document, SHALL cache the signed answer as it arrived, and SHALL fall back to that cache when the server cannot be reached or answers something that does not verify. The cached answer SHALL be re-verified every time it is read, so a cache file edited by hand reads as no cache at all, and a cached answer that no longer verifies SHALL be discarded. Being signed out SHALL clear the cache, and SHALL never be papered over by it.

#### Scenario: The server answers

- **WHEN** the plan is read and the server answers with a document that verifies
- **THEN** that document is the plan and the signed answer replaces what was cached

#### Scenario: Offline with a cached document

- **WHEN** the server cannot be reached and a cached document still verifies
- **THEN** the plan is the cached one and the studio says why the server was not the source

#### Scenario: Offline with nothing cached

- **WHEN** the server cannot be reached and nothing verifies in the cache
- **THEN** there is no plan, the studio is on Free, and the reason is shown

#### Scenario: The token is refused while reading the plan

- **WHEN** the server refuses the token
- **THEN** the cache is cleared and the studio reads as signed out rather than as holding a plan

### Requirement: A document past its own expiry vouches for nothing

A plan document SHALL stop being believed once the moment it names as its expiry has passed, or if that moment cannot be read. The studio SHALL then be on Free and SHALL say the subscription could not be verified, and SHALL offer to check again, rather than reporting a downgrade it cannot prove.

#### Scenario: Offline past the document's lifetime

- **WHEN** the only document available expired before now
- **THEN** the plan is Free and marked unverified, and the card says the studio has been offline longer than the document lasts

#### Scenario: Checking again

- **WHEN** the person presses *Check again* on that card
- **THEN** the plan is read again, and a document the server can now supply restores the plan

### Requirement: The plan is read again once a day while signed in

While signed in, the studio SHALL re-read the account and the plan once every twenty-four hours, so a subscription that ended, a card that failed or a trial that ran out reaches the app without a relaunch. That reading SHALL stop when the sign-in ends.

#### Scenario: A plan that changed overnight

- **WHEN** a day passes and the server now issues a Free document
- **THEN** the studio moves to Free without being relaunched

#### Scenario: Signing out

- **WHEN** the person signs out or the token is refused
- **THEN** the daily reading stops

### Requirement: The plan is four states, and the studio computes no dates of its own

The plan SHALL be read from the document as one of four states: Free, which remembers a trial that has ended; a trial, with the moment it ends and — when the server said so — the moment it started; a paid subscription; and a grace period after a failed payment, with the moment access ends. Every date SHALL come from the document; the studio SHALL derive none. A trial, a grace period and a subscription SHALL all count as Pro. No document at all SHALL count as Free.

#### Scenario: On a trial

- **WHEN** the document names a trial end in the future on a Pro plan
- **THEN** Settings › Account shows *Pro trial* with the days left, and a bar between the trial's start and its end

#### Scenario: A subscription bought during a trial

- **WHEN** the server drops the trial from the document because the subscription is paid
- **THEN** the plan reads as a subscription rather than as the trial it was bought in

#### Scenario: A failed payment

- **WHEN** the document names a grace period that has not ended
- **THEN** the plan reads as Pro with a payment-failed badge and the date access ends

#### Scenario: Free after a trial

- **WHEN** the document is Free and names a trial end in the past
- **THEN** the plan reads as Free and names the day the trial ended

### Requirement: The plan crosses to the sidecar with every turn and every write

Each turn SHALL carry the plan it runs under, and so SHALL each request to write values into the project's code. That plan SHALL be read at the moment the turn is dispatched or the write is made, not when the message was written, so a queued message goes out under the plan the account holds when its turn comes and a change of plan bites the next turn rather than the running one. A turn that names no plan SHALL run as Free.

#### Scenario: A queued message dispatches later

- **WHEN** a message waits in the queue while the plan changes, and is then sent
- **THEN** it runs under the plan in force at dispatch

#### Scenario: A plan that ends mid-turn

- **WHEN** the plan drops to Free while a turn is running
- **THEN** that turn finishes as it started, and the next one runs as Free

#### Scenario: A stored turn from before the field existed

- **WHEN** a turn's parameters carry no plan
- **THEN** it is read as Free, never as Pro

### Requirement: The sidecar withholds four things on Free, and none of them is a failure

On a Free turn the sidecar SHALL NOT attach the bundled skills, SHALL NOT hand the agent the pipeline tools or write the pipeline brief, SHALL send the Free conventions in place of the craft conventions, and SHALL refuse to write values into the project's code with a sentence saying that is part of Pro. A bundle withheld for the plan SHALL raise no notice in the chat, where every other reason a bundle did not load SHALL raise one. The library tools and the design tools SHALL be served on both plans.

#### Scenario: A Free turn's knowledge

- **WHEN** a turn runs on Free
- **THEN** the skills bundle is not attached and nothing in the chat reports it
- **AND** the conventions carry the video's folder but name no bundled skill, no design check, no pipeline and no schema conventions

#### Scenario: A Free turn's tools

- **WHEN** a turn runs on Free
- **THEN** the agent is given the library and design tools and not the pipeline tools

#### Scenario: A write reaching the sidecar on Free

- **WHEN** a request to write values into the project's code arrives under a Free plan
- **THEN** it is refused with *Writing values back into the code is part of Pro.* and no file is touched

#### Scenario: A Pro turn is unchanged

- **WHEN** a turn runs on Pro
- **THEN** its conventions, its tools and its bundle are the full set, with nothing withheld

### Requirement: Inspect and Snapshot are disabled on Free, and a click is the way back

On Free — signed out included — the Inspect and Snapshot buttons SHALL be disabled and SHALL carry on their tooltip the reason they are, worded for who is reading it: an invitation to sign in and start the free trial when nobody is signed in, and an invitation to upgrade when someone is. A click on either SHALL arm nothing and SHALL instead bring the trial card back for this launch. Export SHALL NOT be gated.

#### Scenario: Clicking Inspect on Free

- **WHEN** the person clicks Inspect while on Free
- **THEN** no mode is armed and the trial card reappears above the composer

#### Scenario: The reason, worded for the reader

- **WHEN** the person is signed in on Free
- **THEN** the tooltip says Inspect and Snapshot are part of Pro and invites them to upgrade, rather than to start a trial

#### Scenario: A plan that has not been read yet

- **WHEN** the core has not yet answered whether anyone is signed in
- **THEN** the buttons are not locked as Free, an unread plan never counting as Free

### Requirement: One card above the composer says what the plan needs saying

The studio SHALL show at most one plan card above the composer, chosen by the state of the account: an invitation to a trial while nobody is signed in and while a sign-in is in progress, a report that a trial has ended, a warning during a grace period, and a note that the subscription could not be verified. A person on a trial, on a subscription, on Free with no trial behind them, or whose plan has not been read SHALL see no card, and no card at all SHALL be drawn before the core has answered.

#### Scenario: A signed-out studio

- **WHEN** nobody is signed in
- **THEN** the card invites a seven-day Pro trial and carries the Sign in button

#### Scenario: A trial that ended

- **WHEN** the plan is Free and names the day a trial ended
- **THEN** the card says so and offers Upgrade, which opens Settings › Account

#### Scenario: A grace period

- **WHEN** the plan is in its grace period
- **THEN** the card says the card was declined, names the day Pro stops, and offers *Update card*

#### Scenario: Nothing to say

- **WHEN** the person is on a trial or a subscription
- **THEN** no card is shown

### Requirement: Closing a card is remembered per card, and stays in the app

Closing a plan card SHALL be remembered by the identity of that card in `trialCardsDismissed` in the studio's settings, so the invitation asks once, and a card about a different trial ending or a different grace period asks again. A dismissal SHALL never be sent to the account server. Arming Inspect or Snapshot on Free SHALL bring the card back for this launch only, without erasing what was remembered.

#### Scenario: Closing the invitation

- **WHEN** the person closes the invitation card
- **THEN** it does not return on this or a later launch

#### Scenario: A later trial ending

- **WHEN** the invitation was closed and a trial later ends
- **THEN** a card about that trial ending is shown, its identity being a different one

#### Scenario: Bringing it back

- **WHEN** a Free studio's Inspect button is clicked after the card was closed
- **THEN** the card is shown again for this launch, and closing it again is what writes the dismissal

### Requirement: Buying happens in the browser, and the app never sees a card

Upgrading SHALL be offered in Settings › Account as two tiers side by side with a yearly-or-monthly switch, yearly leading, quoting $19 a month billed monthly and $15 a month billed yearly. Pressing the Pro tier's button SHALL ask the core for a hosted checkout page for the period chosen and open that page in the browser. The studio SHALL never collect payment details, and SHALL quote no price the app does not carry itself. The plan card's Upgrade SHALL only lead to Settings › Account, never start a checkout of its own.

#### Scenario: Starting a purchase

- **WHEN** the person picks Monthly and presses the Pro tier's button
- **THEN** a checkout for the monthly period is requested and opened in the browser
- **AND** the studio shows that it is waiting for the purchase to come through

#### Scenario: The card's Upgrade

- **WHEN** the person presses Upgrade on a plan card
- **THEN** Settings › Account opens on the tiers, and no checkout has started

#### Scenario: A period the server does not take

- **WHEN** anything other than a monthly or a yearly period is requested
- **THEN** the core refuses it rather than asking the server

### Requirement: The purchase is waited out, and only the server ends it

While a checkout is open, the studio SHALL ask the account server for the plan every five seconds for ten minutes, SHALL count only an answer from the server — never a cached document — as evidence of a purchase, and SHALL treat a poll the server could not answer as a skipped poll rather than a failure. Only a refusal of the token SHALL end the wait, and it SHALL end it as this device having been signed out. Past ten minutes the studio SHALL stop asking and offer *Check again*, together with a way to open the checkout page again and a way to cancel. Cancelling, signing out, or leaving the screen SHALL interrupt the wait. The line saying *Subscription active* SHALL be given a card of its own above the composer when no plan card is left to carry it, and SHALL also appear in Settings › Account beside the plan; it SHALL be dismissible.

#### Scenario: The payment comes through

- **WHEN** the server answers with a paid subscription — Pro with no trial and no grace period
- **THEN** the account is read again and the studio says *Subscription active*

#### Scenario: The server cannot be reached during the wait

- **WHEN** a poll fails because the server is unreachable
- **THEN** the wait continues and nothing is reported as wrong

#### Scenario: Ten minutes with no answer

- **WHEN** the patience runs out
- **THEN** the studio stops polling and offers *Check again*, *Open the checkout again* and *Cancel*
- **AND** *Open the checkout again* opens the page already obtained rather than starting a second checkout

#### Scenario: Cancelling the wait

- **WHEN** the person cancels
- **THEN** the polling stops, the plan is left exactly as it was, and no error is shown

#### Scenario: Buying while no card is on screen

- **WHEN** the purchase completes and there is no plan card left to carry the line
- **THEN** a card above the composer says *Subscription active*

#### Scenario: Buying from Settings

- **WHEN** the purchase completes while Settings › Account is open
- **THEN** the line appears there beside the plan, which now reads Pro

### Requirement: A failed card is fixed in the billing portal

*Update card* on the grace card SHALL ask the core for a link into the account server's billing portal and open it in the browser, so the card and the invoices are handled where they live. An account with no subscription to manage SHALL be told so in the server's own words rather than being sent to a page that would say the same. *Manage billing* in Settings › Account SHALL open the account server's billing page in the browser instead, which needs no request of its own.

#### Scenario: Updating a declined card

- **WHEN** the person presses *Update card* during a grace period
- **THEN** a portal link is obtained and the billing portal opens in the browser

#### Scenario: Nothing to manage

- **WHEN** the account has no subscription and the portal link is asked for
- **THEN** the server's sentence saying there is nothing to manage is shown

#### Scenario: Managing billing from Settings

- **WHEN** the person presses *Manage billing*
- **THEN** the account server's billing page opens in the browser
