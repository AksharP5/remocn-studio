## MODIFIED Requirements

### Requirement: A turn that ends elsewhere marks its row

A turn that finishes in a chat that is not the one on screen SHALL mark that chat unread, and the pane SHALL show the mark until the chat is opened. The mark SHALL read as news at a glance — a filled mark beside the title in the accent colour, with the title kept at full weight, and the same mark with a count in the group's rollup while collapsed — and SHALL NOT be a decoration-sized dot that needs looking for. Status per row — running, waiting, failed — SHALL be derived from the live turn state and never stored. The unread mark is the second link of the attention chain in `shell/attention`; a notification, when one is posted, SHALL point at the same chat the mark is on.

#### Scenario: A background turn finishes

- **WHEN** a turn ends in a chat the person is not looking at
- **THEN** its row carries an unread mark beside its title, and its group's rollup accounts for it while collapsed

#### Scenario: The chat is opened

- **WHEN** the person opens that chat
- **THEN** the unread marker goes

#### Scenario: Opened from a notification

- **WHEN** the person activates the notification for that turn
- **THEN** the chat opens and its mark goes, exactly as clicking the row would

#### Scenario: A screen reader

- **WHEN** a row is unread
- **THEN** the row's label says the chat has news
