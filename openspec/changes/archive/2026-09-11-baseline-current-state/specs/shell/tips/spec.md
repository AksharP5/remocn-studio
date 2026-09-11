## Purpose

Anchored one-card tips for the parts of the studio nobody finds on their own, each shown the first time its feature is genuinely usable rather than as a tour at first launch, one at a time, and never again once it is answered.

## ADDED Requirements

### Requirement: A tip appears when its feature does, not at first launch

Each tip SHALL become available only while the thing it points at is on screen and usable, which is also what guarantees its anchor exists. No tip SHALL be available before a project is open.

#### Scenario: Nothing is open

- **WHEN** no project is open
- **THEN** no tip is available, whatever else is on screen

#### Scenario: The preview has not compiled yet

- **WHEN** a project is open but the preview is not yet serving this chat's project
- **THEN** the Inspect and Snapshot tips are withheld
- **AND** they become available once the preview's tools are live

#### Scenario: A feature whose pane is hidden

- **WHEN** the sidebar is hidden
- **THEN** the tips anchored inside it are withheld

#### Scenario: The plan strip

- **WHEN** the agent has written no plan
- **THEN** the plan tip is withheld, and it becomes available once a plan is on screen

### Requirement: One tip at a time, in catalog order

The studio SHALL offer at most one tip at any moment. When several features become available together, the earlier entry in the catalog SHALL be the one shown, and the next SHALL only be offered once the one before it has been answered or dismissed.

#### Scenario: Everything is available at once

- **WHEN** every feature a tip points at is on screen
- **THEN** exactly one tip is shown, the first in the catalog

#### Scenario: Answering one

- **WHEN** the shown tip is answered
- **THEN** the next available tip in catalog order is offered

#### Scenario: A tip whose feature is not there

- **WHEN** the next entry's feature is unavailable
- **THEN** it is skipped and the one after it is offered, rather than nothing being offered at all

### Requirement: Nothing competes with something already asking

Every tip SHALL be withheld while something else is asking to be answered — a permission card, an asset-source ask, a blocking environment check, the new-project or new-video wizard, Settings, or the trial card.

#### Scenario: A permission card is up

- **WHEN** a turn is waiting on a permission card
- **THEN** no tip is shown, whatever is available

#### Scenario: Settings is open

- **WHEN** Settings is open
- **THEN** no tip is shown, and the first available one arrives after it is closed

### Requirement: A tip points at its own anchor, or shows nothing

A tip SHALL be positioned against the element that carries its own identifier, and SHALL show nothing at all when that element is not on the page rather than floating a card in the middle of the window. While a tip is shown, the rest of the window SHALL be dimmed behind it.

#### Scenario: The anchor is on screen

- **WHEN** a tip becomes available
- **THEN** the card is placed against its anchor on the side the catalog names
- **AND** the window behind it is dimmed

#### Scenario: The anchor cannot be found

- **WHEN** the element the tip names is not on the page
- **THEN** no card and no dimming are drawn

#### Scenario: The feature goes away while the tip is waiting

- **WHEN** the feature becomes unavailable before its tip has appeared
- **THEN** the tip is dropped rather than shown about something that is no longer there

### Requirement: "Got it" is remembered, clicking away is not

*Got it* SHALL record the tip as answered in `toursSeen` in `settings.json`, so it is never offered again. An outside press or Escape SHALL drop the tip for this launch only and SHALL write nothing.

#### Scenario: Answering a tip

- **WHEN** *Got it* is pressed
- **THEN** the tip is written down as answered and is not offered on the next launch

#### Scenario: Clicking away

- **WHEN** the person presses outside the card or presses Escape
- **THEN** the tip disappears for this launch and nothing is written
- **AND** it is offered again on the next launch

#### Scenario: A stored id the catalog no longer carries

- **WHEN** the stored list names a tip this build does not ship
- **THEN** it is ignored and the remaining tips are offered in order

#### Scenario: The studio does not yet know what was answered

- **WHEN** the stored settings have not been read yet
- **THEN** no tip is shown

### Requirement: "Show me" only reveals, and counts as an answer

A tip's action SHALL be limited to revealing something the person could reach themselves in one click and undo the same way — opening the Assets or the Components view, or the plan drawer. It SHALL NOT arm a mode. Using it SHALL also count as answering the tip.

#### Scenario: The library tip's action

- **WHEN** *Show me* is pressed on the library tip
- **THEN** the sidebar switches to Assets
- **AND** the tip is recorded as answered

#### Scenario: The Inspect tip

- **WHEN** the Inspect tip is shown
- **THEN** it offers no action at all, and arming Inspect is never offered from a tip

### Requirement: Tips can be replayed from Settings

Settings › Behavior SHALL offer *Replay tips*, which forgets every answered tip so each is offered again. It SHALL be unavailable while nothing has been answered.

#### Scenario: Replaying

- **WHEN** *Replay tips* is pressed
- **THEN** the answered list is emptied and written empty
- **AND** the first available tip is offered once Settings is closed

#### Scenario: Nothing has been answered

- **WHEN** no tip has ever been answered
- **THEN** *Replay tips* is unavailable
