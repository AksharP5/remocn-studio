## Purpose

Typing `@` in the composer offers the project's files, and a query beginning with a slash or a tilde browses the rest of the filesystem folder by folder. This capability covers how that list is opened, filtered, navigated and dismissed, what a pick writes into the message, and why a tagged file needs no attachment of its own.

## ADDED Requirements

### Requirement: A tagged file is plain text
Picking a file SHALL write its path wrapped in backticks into the sentence being typed. It SHALL NOT become a fourth reference kind, SHALL NOT be carried as an attachment, and SHALL NOT change what is stored for the message.

#### Scenario: A project file is picked
- **WHEN** the person picks a file from the list
- **THEN** the whole `@` token is replaced by the path in backticks, followed by a space unless one already follows

#### Scenario: The agent reads a tagged file
- **WHEN** the turn runs and the agent reads a path inside the project
- **THEN** no permission card is raised for it (see `agent/permissions`)

#### Scenario: The path is outside the project
- **WHEN** the tagged path lies outside the opened folder
- **THEN** reading it goes through the ordinary permission card

#### Scenario: The chat is reopened
- **WHEN** a stored message holding a tagged path is rendered
- **THEN** it reads exactly as it was sent

### Requirement: `@` opens the list only where it means a mention
A mention SHALL begin at an `@` that starts the text or follows whitespace or an opening bracket or quote. The query SHALL NOT cross a backtick or a line break, and SHALL be abandoned past 200 characters.

#### Scenario: An `@` is typed at the start of a word
- **WHEN** the person types `@` after a space
- **THEN** the list opens for what follows it

#### Scenario: An email address is typed
- **WHEN** the `@` follows a word character
- **THEN** no list opens

#### Scenario: The caret is moved back into an earlier mention
- **WHEN** the caret sits inside an earlier `@` token
- **THEN** that token is the mention being read, not the last one in the text

#### Scenario: A mention was already inserted
- **WHEN** the caret is after an inserted backticked path
- **THEN** no list opens, a query never crossing a backtick

### Requirement: A relative query filters the project's own files
A query that does not begin with a slash or a tilde SHALL be matched against a walk of the open project, ranked with a match in the file name ahead of one in the folder, and capped at twelve rows. A space SHALL end such a query.

#### Scenario: Part of a file name is typed
- **WHEN** the person types part of a name
- **THEN** matching files are listed, with name matches above path matches and a contiguous run above an out-of-order one

#### Scenario: Nothing is typed after the `@`
- **WHEN** the query is empty
- **THEN** the head of the project's file list is offered

#### Scenario: A space is typed
- **WHEN** a space is typed into a relative query
- **THEN** the mention ends and the list closes

#### Scenario: Nothing matches
- **WHEN** no file matches and the project's walk was cut short
- **THEN** the list says the project has more files than it holds, and that an absolute path reaches the rest

### Requirement: The project walk skips what nobody would tag and reports being cut short
The walk SHALL skip `node_modules`, `out`, `dist`, `build`, `coverage`, `target`, `tmp` and every entry whose name begins with a dot, SHALL stop at 4000 files, and SHALL report that it was cut short rather than trimming in silence.

#### Scenario: A project with dependencies installed
- **WHEN** the walk runs
- **THEN** nothing under the skipped directories and no dot entry appears in the list

#### Scenario: A very large project
- **WHEN** the walk reaches 4000 files
- **THEN** it stops and reports being truncated

#### Scenario: The folder cannot be read
- **WHEN** a directory inside the project cannot be read
- **THEN** it contributes nothing and the walk continues rather than failing

### Requirement: A slash or tilde query browses the filesystem
A query beginning with a slash or a tilde SHALL list one folder at a time, with directories before files and dot entries hidden until a dot is typed. A space SHALL NOT end such a query.

#### Scenario: An absolute path is typed
- **WHEN** the person types a path ending in a slash
- **THEN** that folder's entries are listed, directories first

#### Scenario: A home path is typed
- **WHEN** the query begins with a tilde
- **THEN** it is resolved against the home directory of the machine the sidecar runs on

#### Scenario: A folder name holds a space
- **WHEN** the query is an absolute path containing a space
- **THEN** the mention continues rather than ending at the space

#### Scenario: The folder is not there
- **WHEN** the named folder cannot be listed
- **THEN** the list says so rather than showing an empty result

### Requirement: Drilling into a folder needs no round trip
Choosing a directory SHALL rewrite the query to that folder with a trailing slash and set the list's own query at the same moment, rather than waiting for the field to report the change.

#### Scenario: A directory row is chosen
- **WHEN** the person picks a folder
- **THEN** the text becomes the `@` and that folder path with a trailing slash, and the list immediately shows that folder's entries

#### Scenario: The same folder is browsed again
- **WHEN** a folder already listed in this session is opened again
- **THEN** it is drawn from what was already read rather than read again

### Requirement: The list owns the keys it uses and no others
While the list is open, Escape SHALL close it, the arrow keys SHALL move the highlight with wraparound, and Enter or Tab SHALL pick the highlighted row. Every other key, and every key while the list has no rows, SHALL fall through to the composer.

#### Scenario: Enter is pressed with rows listed
- **WHEN** the list is open with at least one row
- **THEN** Enter picks the highlighted row and no message is sent

#### Scenario: Enter is pressed with nothing matching
- **WHEN** the list is open and nothing matched
- **THEN** Enter falls through and the message is sent

#### Scenario: Escape is pressed
- **WHEN** the list is open
- **THEN** it closes and the composer's own escape action does not run

### Requirement: A dismissal is remembered for that token only
Closing the list with Escape SHALL remember the position of the `@` it was opened for, so typing on in the same word does not reopen it. A different `@`, or moving away and starting another, SHALL open the list as usual.

#### Scenario: The list is dismissed and typing continues
- **WHEN** the person presses Escape and keeps typing into the same token
- **THEN** the list stays closed

#### Scenario: A new mention is started
- **WHEN** the person types another `@` elsewhere
- **THEN** the list opens for it

#### Scenario: The composer is cleared or the field loses focus
- **WHEN** the mention no longer exists, or the field is blurred
- **THEN** the list closes and the dismissal is forgotten

### Requirement: A row leads with the mark of what the file is
Each row SHALL carry an icon derived from the file's name and extension, its own name as the label and its folder as the hint, and SHALL be marked as the folder it is when it is one.

#### Scenario: A React component is listed
- **WHEN** the file's extension names a known kind
- **THEN** the row leads with that kind's mark

#### Scenario: An unknown extension
- **WHEN** the extension names no known kind
- **THEN** a plain file mark is used

### Requirement: The keyboard's row is kept in view
Moving the highlight with the arrow keys SHALL scroll that row into view by the shortest distance. The list SHALL NOT scroll for any other reason, and a row that survives a filter but moved SHALL be brought back into view.

#### Scenario: The arrow keys walk past the visible rows
- **WHEN** the highlight moves below the visible part of the list
- **THEN** the list scrolls just enough to show that row

#### Scenario: The list is redrawn without a key press
- **WHEN** the list is redrawn for any reason other than a key press
- **THEN** nothing is scrolled

#### Scenario: The filter moves the highlighted row
- **WHEN** typing narrows the list and the highlighted row changes position
- **THEN** it is scrolled back into view

#### Scenario: The pointer hovers a row
- **WHEN** the person moves the pointer over a row
- **THEN** the highlight follows it and no scroll is forced

### Requirement: A path in a message is drawn as a chip
A backticked run SHALL be drawn as a path chip in the composer, in the sent message and in a reopened chat, when and only when it holds a slash or is a bare name carrying a real extension. The chip SHALL take no layout width, so the caret still lands where the visible text says it does.

#### Scenario: A tagged path is in the draft
- **WHEN** the message holds a backticked path
- **THEN** it is drawn as a chip in the composer's coloured layer and the caret still lands where the visible text says

#### Scenario: An ordinary code span
- **WHEN** the message holds a backticked word that is neither a path nor a name with an extension
- **THEN** it stays plain text

#### Scenario: A wrapped absolute path
- **WHEN** a long path wraps across lines
- **THEN** each fragment carries its own chip rather than one box torn across the lines

#### Scenario: The message has been sent
- **WHEN** the sent message is drawn in the transcript
- **THEN** its paths read as chips, inheriting the colour of the text around them
