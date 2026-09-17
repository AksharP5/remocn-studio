# account/sign-in Specification

## Purpose
Signing in to the remocn account from the studio: a device-authorization grant confirmed in the browser, with the resulting token held in the login keychain by the core and never handed to the webview. Covers what the person sees while signing in, every way the attempt can end, what a signed-in studio knows about the account and its devices, and how signing out and being signed out elsewhere are told apart.

## Requirements

### Requirement: Signing in is confirmed in the browser, never in the app

The studio SHALL sign in by asking the account server for a device code, opening the server's confirmation page in the person's browser, and waiting for that page to be answered. While it waits, the studio SHALL show the user code the confirmation page displays, a way to open that page again, and a way to cancel. The studio SHALL never ask for an account password or an API key, and SHALL never collect credentials in its own window.

#### Scenario: Starting a sign-in

- **WHEN** the person presses Sign in, in Settings › Account or on the trial card
- **THEN** the confirmation page opens in the browser
- **AND** the studio shows the user code, a spinner, *Open the page again* and *Cancel*

#### Scenario: The person confirms in the browser

- **WHEN** the confirmation page is answered and the next poll reports it
- **THEN** the studio is signed in and reads the account and the plan
- **AND** no error is shown

#### Scenario: The browser would not open

- **WHEN** the confirmation page cannot be handed to the browser
- **THEN** the reason is shown and the sign-in keeps waiting
- **AND** *Open the page again* is still the way to reach the page

### Requirement: The token is the core's, in the login keychain

The session token SHALL be stored by the core in the login keychain under the service `com.remocn.remocn-studio` and the account `session-token`, and SHALL never be given to the webview. Every request to the account server SHALL be made by the core as its own command, and the pending device code SHALL be held in the core until the grant ends. A keychain that refuses SHALL be reported as the keychain refusing, with its reason.

#### Scenario: The webview asks who is signed in

- **WHEN** the webview asks the core for the account
- **THEN** it receives the profile, the devices and the plan document
- **AND** it never receives the token, nor the pending device code

#### Scenario: The keychain refuses

- **WHEN** reading or writing the keychain item fails
- **THEN** the command answers with a keychain failure carrying the system's reason
- **AND** nothing about the account is claimed

#### Scenario: The system asks for keychain access

- **WHEN** macOS prompts before letting the studio read its own keychain item
- **THEN** the studio neither suppresses nor works around the prompt

### Requirement: Every account request names this device

Each request the core makes to the account server SHALL carry a user agent of the form `Remocn Studio/<version> (macOS <os>; <device name>)`, where the device name is the machine's own name. The name SHALL be reduced to characters a header can carry, and SHALL fall back to `Mac` when the machine's name cannot be read or is empty after that reduction.

#### Scenario: The device list names this Mac

- **WHEN** the person opens Settings › Account after signing in
- **THEN** the row for this Mac carries the machine's own name and is marked *This Mac*

#### Scenario: The machine's name cannot be read

- **WHEN** the machine's name is unavailable or contains nothing a header can carry
- **THEN** the device is named `Mac` rather than the request failing

### Requirement: Polling honours the server's own pace

The studio SHALL wait before every poll, starting with the interval the server asked for, SHALL add five seconds to that wait for each time the server has answered *slow down*, and SHALL never poll faster than once a second. Cancelling SHALL interrupt the wait, tell the core to forget the pending code, and return the studio to signed out with no error.

#### Scenario: The server sets the pace

- **WHEN** the server asked for a five-second interval and has not asked to slow down
- **THEN** each poll is preceded by a five-second wait

#### Scenario: The server asks to slow down

- **WHEN** the server answers *slow down* twice
- **THEN** the wait before each later poll is fifteen seconds

#### Scenario: Cancelling

- **WHEN** the person presses Cancel while the studio is waiting
- **THEN** no further poll is made, the core forgets the pending code, and the studio reads as signed out
- **AND** no error is shown

### Requirement: Every way a sign-in ends is said in words

A sign-in that does not succeed SHALL end with a sentence rather than silence. A code the person did not confirm in time SHALL read as the code having expired, with an invitation to try again. A sign-in declined on the confirmation page SHALL read as declined. A failure to reach the server during polling SHALL end the attempt with the failure's own message. A refusal the studio has no wording of its own for SHALL end the attempt with the server's own sentence, and SHALL leave the Sign in button reading *Sign in*. The number of devices already signed in SHALL never be a reason the studio names for a sign-in ending.

#### Scenario: The code expires

- **WHEN** the server reports the device code expired
- **THEN** the studio returns to signed out and says the code expired before it was confirmed

#### Scenario: The person declines in the browser

- **WHEN** the confirmation page is declined
- **THEN** the studio returns to signed out and says the sign-in was declined in the browser

#### Scenario: A poll cannot reach the server

- **WHEN** a poll fails
- **THEN** the attempt ends, the studio returns to signed out, and the failure's message is shown

#### Scenario: The server refuses for a reason the studio does not know

- **WHEN** the server answers the poll with a refusal that is none of *pending*, *slow down*, *expired* or *declined*
- **THEN** the attempt ends, the studio returns to signed out, and the server's own sentence is shown as the failure
- **AND** the Sign in button still reads *Sign in*

### Requirement: A refused request means this device was signed out

When the account server refuses a request the studio made with its token, the core SHALL delete the keychain item and answer that the device is not authorized, and the studio SHALL return to signed out saying this device was signed out and to sign in again. Any other failure — the server unreachable, or answering with an error of its own — SHALL leave the token in place and SHALL NOT end the sign-in.

#### Scenario: Signed out from another device

- **WHEN** the account page on another device signs this one out and the studio's next request is refused
- **THEN** the token is forgotten, the studio reads as signed out, and the sentence names what happened

#### Scenario: The account server cannot be reached

- **WHEN** a request fails because the server is unreachable
- **THEN** the studio stays signed in, keeps the token, and shows the reason it could not reach the server

#### Scenario: The server answers with an error

- **WHEN** the server answers with a failure that is not a refusal of the token
- **THEN** the studio stays signed in and shows the server's own message

### Requirement: Nothing is claimed before the core has answered

Until the core has answered whether a token is stored, the studio SHALL treat the account as unknown: no sign-in state is asserted, Settings › Account SHALL say it is waiting for the core, and no trial card SHALL be drawn. A failure to reach the core at all SHALL leave the account unknown and SHALL raise no error; any other failure of that first question SHALL read as signed out with its message.

#### Scenario: The first moments of a launch

- **WHEN** the app has started and the core has not yet answered
- **THEN** Settings › Account reads *Waiting for the Tauri core* and no card about plans is shown

#### Scenario: Running without a core

- **WHEN** there is no core to ask, as when the webview is opened in a browser
- **THEN** the account stays unknown and no error is shown

#### Scenario: A stored token

- **WHEN** the core answers that a token is stored
- **THEN** the studio reads the account and the plan, and shows the account's origin

### Requirement: The account server's origin is configuration, and unset is a sentence

The account server's origin SHALL come from `REMOCN_STUDIO_ACCOUNT_URL`, read from the running environment if set there and otherwise from the value baked into the core at build time, with a trailing slash removed. With no origin from either source, every account command SHALL answer *REMOCN_STUDIO_ACCOUNT_URL is not set, so the studio does not know where to sign in.* and the studio SHALL NOT fall back to any default domain.

#### Scenario: No origin configured

- **WHEN** the origin is set in neither place and the studio asks whether anyone is signed in
- **THEN** the studio reads as signed out and shows the sentence naming the variable
- **AND** no request is made to any server

#### Scenario: Pointing at a local account server

- **WHEN** the core runs with the variable set in its environment
- **THEN** that origin is used in preference to the one baked in at build time

### Requirement: A signed-in studio shows the account and its devices

Signed in, Settings › Account SHALL show the account's name and email, the plan, and the devices signed in with how long ago each was last seen, and SHALL mark the row for this Mac. The Devices panel SHALL say how many are signed in and SHALL NOT name a ceiling, there being none. Every other device's row SHALL offer to sign that device out; this Mac's row SHALL NOT, this device being signed out from the Sign out button on the profile instead. Refresh SHALL re-read the account and the plan. A sign-out of another device SHALL be followed by re-reading the list.

#### Scenario: Reading the account

- **WHEN** the person opens Settings › Account while signed in
- **THEN** the email, the plan and the device list are shown, with *This Mac* on this device's row

#### Scenario: The count names no ceiling

- **WHEN** three Macs are signed in to the account
- **THEN** the Devices panel says three are signed in and lists all three
- **AND** no line reads *of N*

#### Scenario: Signing another device out

- **WHEN** the person presses Sign out on another device's row
- **THEN** that device is signed out and the list is read again

#### Scenario: The profile could not be read but the plan could

- **WHEN** reading the account's profile fails without the token being refused
- **THEN** the studio stays signed in, shows the failure's message, and shows no device list

### Requirement: Signing out ends the sign-in on the server and forgets the token

Sign out SHALL tell the account server to end this device's sign-in and SHALL delete the keychain item, and SHALL then leave the studio signed out with nothing about the account remembered. A sign-out whose keychain step fails SHALL report that failure and SHALL NOT claim the studio is signed out.

#### Scenario: Signing out

- **WHEN** the person presses Sign out
- **THEN** the server is told, the token is deleted, and the studio reads as signed out with no error

#### Scenario: The server cannot be told

- **WHEN** the server cannot be reached during sign-out
- **THEN** the token is still deleted and the studio reads as signed out

#### Scenario: The keychain refuses to delete

- **WHEN** deleting the keychain item fails
- **THEN** the failure's reason is shown and the studio does not claim to be signed out
