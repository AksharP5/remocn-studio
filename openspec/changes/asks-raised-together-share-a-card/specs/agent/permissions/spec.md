## MODIFIED Requirements

### Requirement: One card at a time, above the composer

The studio SHALL show one permission card at a time for the open chat, above the composer rather than in the transcript. The card SHALL carry the oldest outstanding ask together with every other outstanding ask of that chat that has the same reason, SHALL list each ask with what it names, and SHALL never gather a plan. The studio SHALL lock that chat's composer while a card is up, SHALL put the keyboard on the card, and SHALL remove the card when it is answered. The webview owns the gathering; the sidecar still receives one answer per ask.

#### Scenario: One assistant message raises several calls

- **WHEN** more than one ask with the same reason is outstanding for the open chat
- **THEN** exactly one card is on screen, titled with the count, listing every one of those asks with its command, path or request summary

#### Scenario: Asks with different reasons

- **WHEN** a command and a path outside the project are both outstanding
- **THEN** the card carries the oldest ask's reason and every outstanding ask with that reason, and the others come up on the next card once it is answered

#### Scenario: A plan

- **WHEN** the oldest outstanding ask is the agent's plan
- **THEN** the card carries the plan alone, and nothing is gathered onto it

#### Scenario: An ask arrives while the card is up

- **WHEN** an ask with the card's reason arrives before the card is answered
- **THEN** it joins the list, the title and the approve choice count it, and focus stays where it was

#### Scenario: An ask arrives after the answer

- **WHEN** an ask arrives after the card was answered
- **THEN** it comes up on a new card, and nothing it names was approved in advance

#### Scenario: A card is up

- **WHEN** a card is showing
- **THEN** the composer is disabled and reads that the approval request has to be answered to continue, and the first choice on the card holds focus

#### Scenario: Escape

- **WHEN** the person presses Escape on a card
- **THEN** the card's own declining choice is taken for every ask on it — Decline for an ordinary call, Decline all for a gathered card, Keep planning for a plan

#### Scenario: The card is answered

- **WHEN** a choice is taken
- **THEN** the card leaves the screen with every ask it carried, and what each tool then did is left to its activity row to say

## ADDED Requirements

### Requirement: A gathered card is answered all at once or ask by ask

A card that carries more than one ask SHALL give each ask a checkbox, checked when it appears, and SHALL answer every ask it carries with one choice: the approve choice approves the checked asks and declines the unchecked ones, Decline all declines every ask, and Cancel turn stops the turn. It SHALL offer "always" only for a reason that offers it on a single card, applied to each checked call's exact signature, and SHALL NOT offer an allowance for the rest of the turn.

#### Scenario: Everything approved

- **WHEN** the person takes the approve choice with every ask checked
- **THEN** each ask on the card is approved once, and the choice read as approving all of them with their count

#### Scenario: Some asks unchecked

- **WHEN** the person unchecks an ask and takes the approve choice
- **THEN** the checked asks are approved, the unchecked one is declined, and the agent is told that call was denied

#### Scenario: Nothing checked

- **WHEN** every ask on the card is unchecked
- **THEN** the approve choices are unavailable, and Decline all and Cancel turn remain

#### Scenario: Decline all

- **WHEN** the person takes Decline all
- **THEN** every ask on the card is declined and the turn continues without them

#### Scenario: Requests to a connected service

- **WHEN** a gathered card carries requests to a connected service
- **THEN** it offers to send the checked requests once, to decline all or to cancel the turn, and never to remember the decision

#### Scenario: Always allow on a gathered card

- **WHEN** the person takes "always" on a gathered card of commands or paths
- **THEN** each checked call is remembered by its own exact signature as a single card would, and the unchecked ones are declined and not remembered

#### Scenario: The turn stops with a gathered card up

- **WHEN** the turn that raised the asks is stopped or ends
- **THEN** every ask on the card is refused and the card is gone with the turn
