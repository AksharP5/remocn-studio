## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: The device limit is answered on the account page

**Reason**: The account no longer caps how many copies of the studio may be signed in. The server stops refusing the device grant for the count, so the card that showed the named devices, opened the account page and turned Sign in into *Try again* has nothing left to answer.

**Migration**: Nothing for the person to do. A studio built from this change that still meets an old server's refusal shows the server's own sentence as an ordinary sign-in failure, under *Every way a sign-in ends is said in words*; the device list and signing another device out remain in Settings › Account under *A signed-in studio shows the account and its devices*.
