# preview/write-to-code Specification

## Purpose
Values set in the properties pane that the studio can find at their place in the project's code are written into that code by the studio itself, through the project's own Remotion codemods, when the message is sent. Everything it cannot find, or must not touch, stays a request to the agent, and the agent is told which half is which.

## Requirements

### Requirement: The code behind a picked element is read once per pick

When the properties pane opens on an element, the studio SHALL ask the project's own codemods, through the running preview host, for one answer per declared key: whether the code holds that key as a literal value, as an animation, or as something it computes, together with the address an edit to that element would be written to. It SHALL ask once per pick and SHALL NOT poll for later answers; a rebuild is what tells it the file has changed.

#### Scenario: An element is picked in a project whose code can be read

- **WHEN** the pane opens on an element whose components recorded a place in the code and declare keys
- **THEN** one request carries every such component, and the answers are held against the open card
- **AND** the answers are published into the preview, so an override lands at the address the code names

#### Scenario: A component with no recorded place in the code

- **WHEN** a component in the chain recorded no file and line, or declares no keys
- **THEN** it is left out of the request rather than asked about

#### Scenario: The element is written outside the project folder

- **WHEN** a component's file resolves outside the opened project folder
- **THEN** that one component is answered with a reason saying the studio will not touch it
- **AND** the rest of the request is answered normally

#### Scenario: The project cannot answer

- **WHEN** the project has no preview running, or its Remotion is too old to carry the codemods
- **THEN** the request fails with a sentence naming the reason, including the release the codemods ship with
- **AND** the pane stays open and usable

#### Scenario: The agent rewrites the file

- **WHEN** the project rebuilds because the agent wrote to it
- **THEN** the open card is dropped, so the next pick reads the code as it now stands

### Requirement: Where a change goes is decided by one rule both ends read

For each changed key the studio SHALL decide between writing it into the code itself and asking the agent for it, and SHALL use the same decision for the chips it draws, for the edits it runs and for what the agent is told. A key held as a literal or as an animation SHALL be written. A key the code computes, a key in a file that is not TypeScript, a key on an element with no address in the code, a key nothing answered for, a font family the preview has not loaded, and a picture SHALL be asked of the agent, each with its own reason.

#### Scenario: A literal value

- **WHEN** the code holds the key as a literal at the element's own place in the file
- **THEN** the studio writes it

#### Scenario: An animated value

- **WHEN** the code animates the key
- **THEN** the studio writes it as a keyframe at the frame the value was judged at, so the animation survives

#### Scenario: A computed value

- **WHEN** the code computes the key's value
- **THEN** it goes to the agent, with the reason that the code computes this value

#### Scenario: A font the preview does not have

- **WHEN** the chosen family, or any family in the stack, is not among the ones the preview has loaded
- **THEN** it goes to the agent, with the reason that the font is not loaded in the preview

#### Scenario: A picture

- **WHEN** the changed key is a picture
- **THEN** it goes to the agent whatever the code holds, with the reason that an asset is written as a call that resolves it

#### Scenario: A file that is not TypeScript

- **WHEN** the element's file is not a TypeScript file
- **THEN** that is answered before anything else is considered, and the change goes to the agent

### Requirement: A key with no attribute is added, and its declared default takes it off

The studio SHALL treat a literal-held key as writable whether or not the element's place in the code carries an attribute for it, adding the attribute where there is none. Writing a value equal to the key's declared default SHALL take the attribute back off.

#### Scenario: An element written with no attributes at all

- **WHEN** the person changes a key on an element whose place in the code carries no attribute for it
- **THEN** the attribute is added there

#### Scenario: The declared default is set

- **WHEN** the person sets a key back to the value its component declares as the default
- **THEN** the attribute is removed rather than written out in full

### Requirement: A project whose code cannot be read keeps a working pane

Where no answer about the code is available at all — a Remotion with no codemods, a file that could not be read, or a preview built before this existed — the studio SHALL keep every control live by treating each drafted key as a plain value for the preview's sake, and SHALL route every change to the agent.

#### Scenario: Nothing answered

- **WHEN** the pane is holding values and no answer about the code arrived
- **THEN** the frame still shows every value as it is set
- **AND** Add leaves one chip, carrying every change as a request, and no edits to run

### Requirement: Add leaves the two halves as their own chips

Add SHALL leave up to two chips in the composer: one recording the values the studio will write into the code, and one carrying what only the agent can do. The sentence the person typed SHALL ride with the agent's chip, so an Add with nothing to ask for leaves no words in the message. Both chips SHALL carry the whole chain, so clicking either reopens the pane where the values were set.

#### Scenario: An Add split across both halves

- **WHEN** some changed keys can be written and others cannot
- **THEN** two chips are added, one marked as written by the studio and one as a request

#### Scenario: Everything can be written and nothing was typed

- **WHEN** every changed key can be written and the comment field is empty
- **THEN** one chip is added, carrying the edits and no words

#### Scenario: Nothing can be written

- **WHEN** no changed key can be written
- **THEN** one chip is added, carrying every change as a request and no edits

### Requirement: The write happens at Send, and nothing lands until everything can

The studio SHALL run the edits a message carries when the message is sent, never before, and the first attempt SHALL be all-or-nothing: if any edit is refused, no file is changed. Only the person's answer to the refusal SHALL allow the edits that worked to land while the rest do not.

#### Scenario: Every edit succeeds

- **WHEN** the person sends a message whose chips carry edits and every edit can be applied
- **THEN** the files are written and the message goes out
- **AND** the places each value landed are known, by file and line

#### Scenario: One edit is refused

- **WHEN** one edit in the batch cannot be applied
- **THEN** no file on disk has been changed when the person is asked about it

#### Scenario: A message with no edits

- **WHEN** the message's chips carry no edits at all
- **THEN** nothing is written and the message goes out as it always did

### Requirement: A refusal is a question asked over an untouched disk

When an edit is refused, the studio SHALL raise a card naming each chip that failed and why, offering to send anyway or to cancel. Sending anyway SHALL re-run the edits allowing the ones that work to land, and SHALL turn every refused chip into an ordinary request to the agent. Cancelling SHALL leave the disk and the composer exactly as they were. Which edit is at fault SHALL be found by trying each one alone against the file's original text and keeping the ones that survive.

#### Scenario: The card is cancelled

- **WHEN** the person cancels the card
- **THEN** nothing is written, nothing is sent, and the composer keeps its text and its chips

#### Scenario: The card is accepted

- **WHEN** the person chooses to send anyway
- **THEN** the edits that can be applied are written, the chips that failed are sent as requests instead of as records, and the message goes out

#### Scenario: One file holds a good edit and a bad one

- **WHEN** two edits land in the same file and only one of them can be applied
- **THEN** the card names the one at fault rather than the file
- **AND** accepting writes the other

#### Scenario: The request never reached the preview

- **WHEN** the write request fails outright
- **THEN** every edit is reported as refused with that reason on the card, rather than the send throwing

### Requirement: The host produces text and the sidecar writes, inside the project only

The studio SHALL apply the codemods in the process that can resolve the project's own packages, which SHALL answer with the new contents of each file and SHALL never write one itself. The writing process SHALL check containment twice: over the files going in, and over the paths coming back, refusing the whole write when either escapes the project folder.

#### Scenario: An edit names a file outside the project

- **WHEN** an edit's file resolves outside the opened project folder
- **THEN** the write fails naming that path, and nothing is written

#### Scenario: A file cannot be read

- **WHEN** a file an edit names is not there or cannot be read
- **THEN** every edit in that file is refused by name, and the rest of the batch is judged on its own

### Requirement: Writing into the code is part of Pro

The studio SHALL refuse to write values into a project's code on the Free plan, and SHALL refuse it in the process that owns the disk rather than only in the interface. On Free the properties pane never opens in the first place, Inspect itself being locked; see `preview/inspect`.

#### Scenario: A write is asked for on Free

- **WHEN** a write request arrives carrying a Free plan
- **THEN** it is refused with a sentence saying that writing values back into the code is part of Pro
- **AND** no file is read or written

### Requirement: A message that asks for nothing starts no turn

When every change in a message was written into the code and the person typed no words, attached nothing and picked nothing else, the studio SHALL record the message in the chat's own history and SHALL NOT start a turn.

#### Scenario: Values written, nothing typed

- **WHEN** the person sends a message whose only content is changes the studio wrote itself
- **THEN** the message appears in the transcript with its chip, marked as already written
- **AND** no agent turn begins

#### Scenario: Values written and a sentence typed

- **WHEN** the person types a sentence alongside changes the studio wrote
- **THEN** a turn begins as usual, and the agent is told what was already written

### Requirement: The agent is told what the studio already did

Changes the studio wrote SHALL reach the agent under a heading naming the component, the name it declares, and its file and line, and saying plainly that they are in the file already and are to be left exactly as they are. A change held as an animation that could not be written SHALL still be marked as sampled from the running preview, so the agent is told to move the value the animation lands on.

#### Scenario: A written change reaches the prompt

- **WHEN** a message carries a chip the studio wrote
- **THEN** its changes appear under the "already written by the studio" heading with the component's file and line

#### Scenario: A requested change reaches the prompt

- **WHEN** a message carries a chip the agent is being asked for
- **THEN** its changes appear under the "requested changes" heading for the component that owns them

#### Scenario: An animated change that could not be written

- **WHEN** an animated key's change is routed to the agent
- **THEN** its line names the frame the previous value was sampled at and says to change the landing value, not the frame

### Requirement: A message carrying code edits waits while the video's turn runs

While a turn is running on the video a message belongs to, the studio SHALL refuse to send a message whose chips carry code edits, SHALL say why on the send control, and SHALL leave the message where it was typed. Such a message SHALL NOT be queued.

#### Scenario: A turn is running on this video

- **WHEN** the person presses send on a message carrying code edits while that video's turn is running
- **THEN** nothing is written, nothing is queued, and the composer keeps its text and chips
- **AND** the reason is on the send control, naming the running turn

#### Scenario: The turn settles

- **WHEN** the running turn ends
- **THEN** the same message can be sent, and its edits are written then

### Requirement: Managed values bypass JSX call-site edits

Managed property edits SHALL address the video object document rather than a shared JSX call site. Existing unmanaged Studio videos SHALL keep their legacy code editing path until explicitly converted.

#### Scenario: Repeated components
- **WHEN** one managed card among repeated cards is edited
- **THEN** only its object values change

#### Scenario: A field is unsupported
- **WHEN** a definition uses an unsupported field type
- **THEN** the managed contract is refused instead of silently dropping the field
