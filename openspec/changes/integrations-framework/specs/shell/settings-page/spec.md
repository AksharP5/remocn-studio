## MODIFIED Requirements

### Requirement: The rail lists the sections and flags a waiting update

The rail SHALL list Project, Account, Appearance, Behavior, Notifications, Hotkeys, Integrations, Updates and Feedback, each with a one-line description shown as the heading of the section it opens, and SHALL mark the open one. The Updates row SHALL carry a dot whenever a release is waiting, so the page never hides it.

#### Scenario: Switching section

- **WHEN** the person picks a row in the rail
- **THEN** that section's heading, description and body replace the column on the right

#### Scenario: A release is waiting

- **WHEN** a newer release has been found
- **THEN** the Updates row carries a marker announcing that an update is available

### Requirement: Settings opens from several places, each on the section it is about

Settings SHALL open from the Settings row in the sidebar's footer, from ⌘, anywhere in the app, from the account row in the sidebar's footer, from the trial card's Upgrade, from a provider's *Sign in* in the model menu, and from Project Settings in the application's Project menu. The last four SHALL open on the section they concern, and the model menu's entry SHALL additionally bring that provider's row into view and mark it.

#### Scenario: The keyboard shortcut

- **WHEN** the person presses ⌘, anywhere in the app
- **THEN** Settings opens, whether or not the sidebar is showing

#### Scenario: Signing a provider in from the composer

- **WHEN** the person picks *Sign in* on a provider in the model menu
- **THEN** Settings opens on Integrations with that provider's row scrolled into view and outlined

#### Scenario: The gear opens where it left off

- **WHEN** Settings is opened from the sidebar's Settings row or with ⌘,
- **THEN** it opens on the section that was last open, and on Appearance the first time

#### Scenario: Project Settings from the menu

- **WHEN** Project Settings is chosen in the application's Project menu
- **THEN** Settings opens on the Project section bound to the open project

## REMOVED Requirements

### Requirement: Stock media holds a Pexels key on this Mac

**Reason**: The Pexels key is no longer something the person sets. Stock search runs on the key the build ships and on `REMOCN_STUDIO_PEXELS_KEY`, so the section had nothing left to offer and the rail row is removed with it.

**Migration**: None for the person — stock search keeps working on the shipped key. A key stored earlier is ignored; the way to use a different one is the environment variable. `library/stock-search` carries the changed behaviour.

### Requirement: AI Accounts lists every provider with its own probe's answer

**Reason**: AI accounts are one kind of connection among several now, so they sit inside Integrations rather than in a rail section of their own.

**Migration**: The behaviour is unchanged and moves verbatim to `integrations/settings-section`, as the AI accounts group. Anything that opened Settings on AI Accounts now opens it on Integrations with that provider's row marked.
