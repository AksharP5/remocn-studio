## MODIFIED Requirements

### Requirement: The rail lists the sections and flags a waiting update

The rail SHALL list Project, Appearance, Behavior, Notifications, Hotkeys, Integrations, Updates and Feedback, each with a one-line description shown as the heading of the section it opens, and SHALL mark the open one. The Updates row SHALL carry a dot whenever a release is waiting, so the page never hides it. The rail SHALL NOT offer an Account section.

#### Scenario: Switching section

- **WHEN** the person picks a row in the rail
- **THEN** that section's heading, description and body replace the column on the right

#### Scenario: A release is waiting

- **WHEN** a newer release has been found
- **THEN** the Updates row carries a marker announcing that an update is available

#### Scenario: No account to manage

- **WHEN** the person reads the rail
- **THEN** no row offers an account, a plan, devices or billing

### Requirement: Settings opens from several places, each on the section it is about

Settings SHALL open from the Settings row in the sidebar's footer, from ⌘, anywhere in the app, from a provider's *Sign in* in the model menu, and from Project Settings in the application's Project menu. The last two SHALL open on the section they concern, and the model menu's entry SHALL additionally bring that provider's row into view and mark it.

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

#### Scenario: The sidebar footer

- **WHEN** the person reads the sidebar's footer
- **THEN** it holds Send feedback and Settings, and no account row
