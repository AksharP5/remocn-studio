# composer/references Specification

## Purpose
A message can point at three kinds of thing the agent cannot otherwise see: a picture, an element picked in the preview, and an asset from the library. This capability covers how those references are written, kept in step with what they stand for, coloured, carried into the turn, and how video, audio and dropped files reach a message without being references at all.

## Requirements

### Requirement: A reference is positional and its number is its identity
A reference SHALL be spelled `[Image #N]`, `[Element #N]` or `[Asset #N]`, where N counts from one into the message's own list of that kind. The item at position i SHALL always be reference i+1. A number beyond the count of that kind SHALL be plain text everywhere: uncoloured, never spliced and never renumbered.

#### Scenario: Two pictures are attached
- **WHEN** two images are attached
- **THEN** they are `[Image #1]` and `[Image #2]`, in the order they arrived

#### Scenario: A reference points past the end of the list
- **WHEN** the person types `[Image #7]` with three images attached
- **THEN** it is treated as ordinary text and nothing is attached to it

#### Scenario: Kinds are numbered separately
- **WHEN** a message carries images, element selections and assets at once
- **THEN** each kind is numbered from one on its own ladder

### Requirement: Pasting a picture attaches it and points at it
Pressing the paste shortcut with an image on the clipboard SHALL attach it and write its reference at the caret. The same gesture SHALL be used by picking an image, by capturing a still of the preview, and by dropping a picture onto the composer.

#### Scenario: An image is pasted
- **WHEN** the clipboard holds one or more images
- **THEN** each is attached and a reference for each is written where the caret was, separated from the surrounding words by a single space where one is needed

#### Scenario: A run of images arrives at once
- **WHEN** several images are pasted together
- **THEN** their references are written in the order the images arrived

#### Scenario: A plain-text paste
- **WHEN** the clipboard holds no image
- **THEN** the paste is left to the text field untouched

#### Scenario: The paste cannot be saved
- **WHEN** writing the pasted bytes to disk fails
- **THEN** the line under the composer says why, rather than the paste being dropped silently

### Requirement: Insertion never cuts a reference in half
Any insertion at the caret SHALL first move the caret out of a reference it is sitting inside, to whichever edge of the token is nearer, with a tie going to the end.

#### Scenario: The caret rests inside a token
- **WHEN** the caret is inside `[Image #1]` and a new picture is pasted
- **THEN** the new reference lands outside that token and the existing one is left whole
- **AND** the attachment the existing token stands for is not removed

### Requirement: Removing a reference removes what it stood for
Deleting a reference SHALL remove its attachment, selection or asset and renumber everything after it. Removing the item from its card SHALL remove its reference from the text the same way.

#### Scenario: Backspace touches a reference
- **WHEN** Backspace or Delete touches or sits inside a reference with no text selected
- **THEN** the whole token goes in one keystroke, along with the item it stood for, and the remaining references of that kind are renumbered

#### Scenario: A reference is removed wholesale
- **WHEN** a selection is deleted, cut, pasted over, or the field is cleared
- **THEN** the loss is detected by comparing the draft with the one before it, the item is removed, and the remaining references are renumbered

#### Scenario: A card's close button is pressed
- **WHEN** an attachment, selection or asset card is closed
- **THEN** its reference leaves the text and the rest are renumbered

#### Scenario: An ordinary keystroke
- **WHEN** Backspace is pressed in ordinary text, or with a modifier held
- **THEN** nothing is intercepted and the field behaves normally

### Requirement: A reference is coloured and differs in nothing else
A reference SHALL be drawn in its own colour both in the composer and in the sent message. The composer's coloured layer SHALL carry identical typography to the field beneath it, so no reference may differ in weight, size, family, tracking or padding.

#### Scenario: A message is typed and sent
- **WHEN** a message with references is written and then sent
- **THEN** the references read the same in the composer, in the sent bubble, and in a reopened chat

#### Scenario: The caret is moved through a coloured token
- **WHEN** the caret is placed after several references
- **THEN** it sits exactly where the visible text says it does

### Requirement: Pasted bytes become a file the core places
The Rust core SHALL decide where a pasted image is written; the webview SHALL never choose the location. The written name SHALL be sanitised, SHALL keep the original extension when it already implies the same media type, and SHALL be disambiguated on collision. Files written this way SHALL NOT be swept.

#### Scenario: A named image is pasted
- **WHEN** the clipboard image carries a filename whose extension matches its media type
- **THEN** that name is kept and is what the card displays

#### Scenario: The name collides with a file already there
- **WHEN** a file of that name already exists
- **THEN** a numbered variant is written instead, and neither file is overwritten

#### Scenario: The media type is one the model cannot read
- **WHEN** the bytes arrive with a media type outside jpeg, png, gif and webp
- **THEN** the write is refused with a message naming the type

#### Scenario: A past chat is reopened
- **WHEN** a chat from an earlier run of the studio is reopened
- **THEN** its pictures are still on disk and still render

### Requirement: An attachment card is the picture itself
A card SHALL show the picture itself, with the file's name as its alternative text and its hover title. A file that cannot be read SHALL fall back to an icon rather than an empty card.

#### Scenario: An image is attached
- **WHEN** the card is drawn
- **THEN** the picture itself is shown

#### Scenario: The file has gone
- **WHEN** the file cannot be read
- **THEN** the card falls back to an icon and the name is all that identifies it

### Requirement: The turn splices images where they are referenced
Building the turn's content SHALL cut the text at each image reference and put the image there. Attachments nobody referenced SHALL go first, ahead of the whole sequence. A repeated reference to the same image SHALL stay literal text so the image is sent once. Empty and whitespace-only text blocks SHALL be dropped. The transcript SHALL keep the raw text, references included.

#### Scenario: One picture is referenced mid-sentence
- **WHEN** the message reads "look at `[Image #1]` and tell me"
- **THEN** the content is the text before it, the image, then the text after it

#### Scenario: A picture is attached but never referenced
- **WHEN** an attachment has no reference in the text
- **THEN** it is placed ahead of everything else

#### Scenario: The same picture is referenced twice
- **WHEN** `[Image #1]` appears twice
- **THEN** the image is spliced at the first mention and the second stays as text

#### Scenario: Nothing is referenced at all
- **WHEN** the message carries no references
- **THEN** the content is every attachment, in order, followed by the message text as one block

### Requirement: An element selection is a chip and a block at the end
An element picked in the preview SHALL become a numbered chip and a reference in the text, and its payload SHALL be appended as one block per selection at the end of the message rather than spliced inline. The chip SHALL name the element the way the properties pane named it, falling back to the resolved component for a selection with no schema, and SHALL read the picked frame as a time.

#### Scenario: An element is picked with a comment
- **WHEN** the person writes what should change and adds it
- **THEN** the comment is written at the caret with `[Element #N]` after it, and a chip appears carrying the element's name, its change count and its time

#### Scenario: A selection has no source location
- **WHEN** the element's file could not be resolved
- **THEN** the selection is still usable, travelling with its markup, component name and frame, and the chip says it has no source location

#### Scenario: The same element is referenced twice
- **WHEN** one selection is mentioned twice in the text
- **THEN** its payload is appended once, there being one block per selection rather than per mention

#### Scenario: A chip is removed
- **WHEN** the person removes an element chip
- **THEN** its reference leaves the text and the values it had tuned in the preview are reset

### Requirement: Element references are dropped when the open chat changes project
When the open chat moves to another project, element references SHALL be dropped from the composer along with their selections. Text, images, assets and media SHALL be left alone. The first resolution from no project at all SHALL NOT count as a switch.

#### Scenario: The person switches project with selections carried
- **WHEN** the open chat's project changes
- **THEN** every element reference leaves the text and its chips go

#### Scenario: The first project resolves at launch
- **WHEN** the project goes from none to one
- **THEN** nothing is dropped

### Requirement: An asset reference is positional and outlives a project switch
Picking a library asset SHALL add it to the message's asset list and write `[Asset #N]`. Picking the same asset again SHALL reuse the number it already has. Asset references SHALL NOT be dropped when the project changes.

#### Scenario: An asset is picked twice
- **WHEN** the same asset is picked a second time
- **THEN** a reference with the number it already has is written and no second card appears

#### Scenario: The project changes
- **WHEN** the open chat moves to another project
- **THEN** the asset chips and their references stay

#### Scenario: The turn is built
- **WHEN** the message goes out
- **THEN** the referenced assets have already been copied into the project, and the agent is told for each one what was copied, what was skipped as already present, how to reference it, its motion role when it has one, and which packages are not installed yet with the project's own add command

### Requirement: Video and audio are carried with no reference kind
Attached video and audio SHALL live in their own list, outside the reference numbering, and SHALL be copied into the project's public folder before the turn starts. The agent SHALL be told, per file, where it now sits and how to reference it from the project's code. Only playable media SHALL enter that list. A video card SHALL show a frame from the clip rather than an icon, and an attached sound SHALL be analysed once it lands so its reading can travel with the turn.

#### Scenario: A clip is attached
- **WHEN** a video is attached and the message is sent
- **THEN** the clip is copied into the project and the agent is given its in-project path rather than the path on the person's disk
- **AND** no `[Media #N]` token exists anywhere

#### Scenario: A picture is offered to the media list
- **WHEN** an image path reaches the media list
- **THEN** it is refused there and travels as an attachment instead

#### Scenario: The same file is attached twice
- **WHEN** a path already in the list arrives again
- **THEN** it is taken once

#### Scenario: A message carries only a clip
- **WHEN** nothing but a video is attached
- **THEN** the message can still be sent

#### Scenario: A video is attached
- **WHEN** the card is drawn
- **THEN** a frame taken a fraction of a second in is shown, or half-way in for a clip too short for that

#### Scenario: A sound is attached and sent immediately
- **WHEN** the message goes out before the analysis finishes
- **THEN** it goes without the audiomap and the turn is unaffected

#### Scenario: A sound is analysed
- **WHEN** the analysis lands while the sound is still attached
- **THEN** the turn carries the reading, and the agent is given it in words

### Requirement: Dropping files has two zones and one watcher
File drops SHALL be routed by the point they landed on, against an ordered list of zones — the composer and the library — with the first match winning. A locked composer SHALL NOT be a zone at all. A drop that misses every zone SHALL be silent.

#### Scenario: Media is dropped on the composer
- **WHEN** the point is inside the composer and the composer is open
- **THEN** pictures are attached with a reference each, and video and audio join the media list

#### Scenario: Media is dropped on the library pane
- **WHEN** the point is inside the library
- **THEN** each file is saved to the library rather than to the message

#### Scenario: A drag passes over the library on the way to the composer
- **WHEN** a drag holding media hovers the left pane
- **THEN** the pane switches to the assets view while the hold lasts, and letting go anywhere else puts the previous view back

#### Scenario: The composer is locked
- **WHEN** a permission card is up, no project is open, or the checklist is blocking
- **THEN** the composer's drop indicator never lights and a drop on it does nothing

#### Scenario: A drop lands nowhere
- **WHEN** the point is in neither zone
- **THEN** nothing is attached, nothing is saved, and the pane reverts

### Requirement: A file the studio cannot take is refused out loud
A dropped file that is neither a picture, a video nor a sound SHALL be reported as skipped, naming where it did not go. A picture in a format the model cannot read SHALL be named by its format with the way out.

#### Scenario: Source code is dropped
- **WHEN** a `.tsx` file is dropped on the composer
- **THEN** a notice says it is not a picture, a video or a sound and that it did not go into the message

#### Scenario: A HEIC photograph is dropped
- **WHEN** a picture in a format the model cannot read is dropped
- **THEN** the notice names the format and says to export it as JPEG or PNG

#### Scenario: A mixed drop
- **WHEN** the drop holds both usable media and files that are not
- **THEN** the usable files land and the refusal names only what was left out
