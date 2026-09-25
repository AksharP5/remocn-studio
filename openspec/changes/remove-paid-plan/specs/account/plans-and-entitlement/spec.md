## REMOVED Requirements

### Requirement: Pro is one list, and every entry on it is gated somewhere

**Reason**: No paid plan remains (REM-520). Every entry that was on the list is now served to every turn and every person.

**Migration**: None for the person. What each entry did is still specified where it lives: the skills bundle and craft conventions in `agent/knowledge`, the pipeline tools in `agent/studio-tools` and `agent/pipeline`, write-to-code in `preview/write-to-code`, Inspect in `preview/inspect`, and Snapshot in `preview/snapshot`.

### Requirement: A plan is believed only once its document verifies

**Reason**: The studio no longer reads an entitlement document, so nothing needs verifying.

**Migration**: None. A cache left by an earlier version is deleted on the first launch after the update (see `shell/quit-and-updates`).

### Requirement: The server answers first, the cache answers when it cannot

**Reason**: No entitlement is fetched or cached.

**Migration**: None.

### Requirement: A document past its own expiry vouches for nothing

**Reason**: No entitlement document exists.

**Migration**: None.

### Requirement: The plan is read again once a day while signed in

**Reason**: There is no plan to read and no sign-in.

**Migration**: None. The studio makes no requests to the account server.

### Requirement: The plan is four states, and the studio computes no dates of its own

**Reason**: No plan states remain: no Free, trial, Pro or grace.

**Migration**: None.

### Requirement: The plan crosses to the sidecar with every turn and every write

**Reason**: The sidecar no longer decides anything by plan, so turn, write and `studio.patch` frames stop carrying one. That is a protocol bump on both sides.

**Migration**: None for the person. The webview and sidecar ship in one bundle, so the bumped protocol arrives on both sides together.

### Requirement: The sidecar withholds four things on Free, and none of them is a failure

**Reason**: Nothing is withheld by plan any more.

**Migration**: Every turn is served what a Pro turn was: the skills bundle, the pipeline server and brief, the full conventions, and writes into the code.

### Requirement: Inspect and Snapshot are disabled on Free, and a click is the way back

**Reason**: Inspect and Snapshot are available to everyone.

**Migration**: Their remaining reasons to be unavailable are specified in `preview/inspect` and `preview/snapshot`.

### Requirement: One card above the composer says what the plan needs saying

**Reason**: No trial, grace or plan remains to be announced, so the trial card is removed.

**Migration**: None.

### Requirement: Closing a card is remembered per card, and stays in the app

**Reason**: The trial card no longer exists.

**Migration**: The `trialCardsDismissed` key left in `settings.json` is inert, because nothing reads it.

### Requirement: Buying happens in the browser, and the app never sees a card

**Reason**: Nothing is sold.

**Migration**: None.

### Requirement: The purchase is waited out, and only the server ends it

**Reason**: No purchase exists to wait for.

**Migration**: None.

### Requirement: A failed card is fixed in the billing portal

**Reason**: There is no subscription and no billing portal.

**Migration**: None. Existing subscriptions are the backend's to wind down.
