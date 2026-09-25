## REMOVED Requirements

### Requirement: Signing in is confirmed in the browser, never in the app

**Reason**: The remocn account existed only to carry the paid plan, and no paid plan remains (REM-520). The studio has no sign-in.

**Migration**: None for the person, who has nothing to sign in to. Signing in to Claude Code, Codex, Copilot or Grok is the provider's own, is unaffected, and is specified in `agent/providers`.

### Requirement: The token is the core's, in the login keychain

**Reason**: No session token is issued or held.

**Migration**: A token left in the login keychain by an earlier version is deleted on the first launch after the update (see `shell/quit-and-updates`).

### Requirement: Every account request names this device

**Reason**: The studio makes no account requests.

**Migration**: None.

### Requirement: Polling honours the server's own pace

**Reason**: There is no device-authorization grant to poll.

**Migration**: None.

### Requirement: Every way a sign-in ends is said in words

**Reason**: There is no sign-in.

**Migration**: None.

### Requirement: A refused request means this device was signed out

**Reason**: The studio makes no account requests that could be refused.

**Migration**: None.

### Requirement: Nothing is claimed before the core has answered

**Reason**: The core no longer answers anything about an account.

**Migration**: None. The sidebar footer's account row is removed.

### Requirement: The account server's origin is configuration, and unset is a sentence

**Reason**: The studio talks to no account server, so `REMOCN_STUDIO_ACCOUNT_URL` is no longer read or baked in.

**Migration**: Remove the variable from `.env`. The build ignores it if it is left.

### Requirement: A signed-in studio shows the account and its devices

**Reason**: Settings › Account is removed.

**Migration**: None in the app. Devices were a property of the subscription, which the backend winds down.

### Requirement: Signing out ends the sign-in on the server and forgets the token

**Reason**: There is no sign-in to end.

**Migration**: The leftover token is deleted locally by the one-time cleanup in `shell/quit-and-updates`. Nothing is sent to the server.
