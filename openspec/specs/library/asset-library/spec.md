# library/asset-library Specification

## Purpose
The library is where something made or dropped into one video is kept so it can be used in every other one: pictures, footage, sound and finished Remotion components. This capability covers where it lives, how something gets into it, how it reaches a turn, and the previews, audiomaps and proxies that make it usable at a glance.

## Requirements

### Requirement: The library is a folder of assets the core names
The library SHALL live in the folder named by `REMOCN_STUDIO_LIBRARY_DIR`, falling back to a `library` folder inside the data directory the core names and, with neither set, to a folder under the system temporary directory. Each asset SHALL be one folder under `assets/` holding its files and a `manifest.json`. Listing SHALL be a scan of that folder, newest first, and SHALL never depend on an index kept somewhere else.

#### Scenario: The pane asks for the library
- **WHEN** the assets view is opened
- **THEN** every asset folder holding a readable manifest is listed, most recently created first
- **AND** each row carries its name, kind, description, files, dependencies, length, role and, when it has one, the picture to show

#### Scenario: One asset folder is unreadable
- **WHEN** a folder under `assets/` holds no manifest, or a manifest that does not decode
- **THEN** that folder is left out of the listing
- **AND** the rest of the library is still listed rather than the whole listing failing

#### Scenario: The library cannot be read at all
- **WHEN** the listing fails
- **THEN** the pane says the library is unavailable, prints the reason and offers Try again
- **AND** nothing else in the studio is blocked by it

### Requirement: A slug is minted once and the name is a field
An asset's folder name SHALL be derived from its name at the moment it is saved, lowercased with anything unsafe folded to a hyphen, and SHALL never move afterwards. A name already taken SHALL be given a numbered suffix. Renaming SHALL rewrite only the name in the manifest.

#### Scenario: A second asset is saved under a name already used
- **WHEN** a name resolves to a folder that already exists
- **THEN** the new asset takes that name with `-2` appended, then `-3`, and so on
- **AND** the existing asset is untouched

#### Scenario: A name folds to nothing usable
- **WHEN** a name contains no characters that survive the fold
- **THEN** the folder is named `asset`, disambiguated as above, rather than left unnamed

#### Scenario: An asset is renamed
- **WHEN** a new name is given for an asset
- **THEN** only the name in its manifest changes
- **AND** its folder, its files and every reference already pointing at it keep working

### Requirement: The app saves media and the agent saves components
Media SHALL be saved from the app — from a message's attachments or from a file dropped on the pane — with the file copied into the asset's own folder. Code SHALL be saved by the agent through the library tool, which gathers every file the thing needs and names it. Files SHALL be stored relative to the deepest folder they all share, so relative imports between them keep resolving. A save naming no files SHALL be refused rather than writing an empty folder.

#### Scenario: A component and its helper are saved together
- **WHEN** the agent saves files that sit in different folders of the project
- **THEN** they are stored under the asset keeping their positions relative to the folder they share
- **AND** an import from one to the other still resolves after insertion

#### Scenario: The kind is not stated
- **WHEN** a save does not say what kind of asset it is
- **THEN** the kind is worked out from the file extensions, and a set holding any code is a component

#### Scenario: A save names no files
- **WHEN** a save is asked for with an empty file list
- **THEN** it is refused with a message saying an asset needs at least one file
- **AND** no folder is created

### Requirement: A picture of the asset is decoration, never a condition of saving
Every video and every sound SHALL be stored with a still: the frame a tenth of a second in for a video, a drawn waveform for a sound. A lone picture SHALL be its own still. An asset the agent saves while a preview is playing SHALL be given a still rendered from the frame on screen, and a component SHALL also be given a short moving clip beside it. All of this SHALL be best-effort: a still that cannot be taken, copied or rendered SHALL leave the asset with its type icon and SHALL never fail the save.

#### Scenario: A clip will not decode
- **WHEN** the frame of a video cannot be decoded within fifteen seconds, or at all
- **THEN** the asset is saved anyway
- **AND** its card falls back to the video itself, and failing that to the icon for its kind

#### Scenario: A component is saved while a video is on screen
- **WHEN** the agent saves a component and the preview is running for that project
- **THEN** a still of the frame on screen is filed beside the asset, and a short clip with it
- **AND** a failure of either leaves the asset saved with no picture rather than failing the tool call

#### Scenario: No preview is running
- **WHEN** the agent saves a component and nothing is playing
- **THEN** the asset is saved with no still, and the card shows the icon for its kind

### Requirement: An asset is copied into the project before the turn starts
When a message references assets, the studio SHALL copy each one into the project before the turn runs: media into `public/library/`, a component into `src/library/<slug>/`, resolved against the project's Remotion root. Copying SHALL never overwrite a file that is already there. The agent SHALL be told what landed, what was left untouched, how to reference it, and which npm packages it needs that the project does not have, named with the command of the project's own package manager.

#### Scenario: The same asset is inserted a second time
- **WHEN** an asset is referenced again in a project it was already copied into
- **THEN** the existing files are left exactly as they are, edits included
- **AND** the agent is told they are already in the project, untouched

#### Scenario: The asset needs a package the project has not installed
- **WHEN** an inserted asset declares dependencies the project does not have
- **THEN** the agent is given their names and the add command for the project's package manager
- **AND** nothing is written into the project's manifest on the turn's behalf

#### Scenario: The asset was deleted since the message was written
- **WHEN** a referenced asset is no longer in the library
- **THEN** the agent is told in a sentence that it is gone and to build it from scratch or ask again
- **AND** the turn runs

#### Scenario: The copy itself fails
- **WHEN** the files cannot be copied into the project
- **THEN** a notice says which group could not be copied and why
- **AND** the turn runs with the words the person wrote

### Requirement: The studio offers to keep what a turn used
When a turn settles, the studio SHALL offer to keep the files that last message carried, as a card above the composer. A file whose contents are already in the library, or that was declined before, SHALL NOT be offered again; two identical files in one offer SHALL be one row. The card SHALL NOT lock the composer. The offer SHALL be controlled by `assetOffers` in `settings.json`, which is on unless it is turned off.

#### Scenario: A file already in the library comes round again
- **WHEN** a turn settles carrying a file whose contents match an asset already saved
- **THEN** it is not offered
- **AND** a file declined on an earlier card is not offered either

#### Scenario: One file of several is struck out
- **WHEN** a row is struck from the card
- **THEN** that file is remembered as declined and leaves the card
- **AND** the remaining rows still stand

#### Scenario: One of the saves fails
- **WHEN** Save to library is pressed and one file cannot be saved
- **THEN** the files that were saved leave the card
- **AND** the one that failed stays on it rather than being reported as kept

#### Scenario: Suggestions are switched off
- **WHEN** `assetOffers` is off
- **THEN** no card is raised when a turn settles

### Requirement: The pane is a grid of cards that insert on click
The library SHALL be shown as a two-column grid, each card showing the asset's own picture, its name and, where a length was measured, that length as minutes and seconds. Clicking anywhere on a card except its own Delete action SHALL put the asset in the composer. A card's accessible name SHALL carry the asset's kind. A card with a moving clip SHALL play it in a popover beside the card after the pointer settles, never in place of the card.

#### Scenario: No length was ever measured
- **WHEN** an asset has no measured length
- **THEN** no length badge is drawn, rather than a zero

#### Scenario: The stored picture will not load
- **WHEN** the still named by the manifest cannot be loaded
- **THEN** a video falls back to the file itself and anything else to the icon for its kind

#### Scenario: The hover clip will not play
- **WHEN** the moving clip fails to start or decode
- **THEN** the popover settles on the still
- **AND** the clip is not retried for the life of that card

#### Scenario: The library is searched
- **WHEN** a query is typed into the field pinned above the list
- **THEN** only assets whose names contain it are shown
- **AND** a query that matches nothing says so by name rather than showing an empty grid

### Requirement: Deleting forgives
Deleting an asset SHALL take its card out of the grid at once and remove the folder only after a ten-second window, with an Undo on the toast. Undo SHALL put the card back at the index it left from. A listing taken inside the window SHALL NOT show an asset whose delete is still pending. Quitting inside the window SHALL leave the asset on disk.

#### Scenario: Undo is pressed
- **WHEN** Undo is pressed inside the window
- **THEN** the delete never runs and the card returns to its old position
- **AND** no file was ever removed

#### Scenario: A turn settles inside the window
- **WHEN** a turn settles while a delete is pending and the pane re-lists
- **THEN** the pending asset is filtered out of the new listing
- **AND** the delete still runs when its window closes

#### Scenario: The app is quit inside the window
- **WHEN** the studio quits before the window closes
- **THEN** the delete is dropped rather than rushed, and the asset is there at the next launch

### Requirement: The pane looks again when a turn settles
The library SHALL be re-listed on the falling edge of a running turn, the agent being able to write into it through its own tool without the pane hearing. That listing SHALL be quiet: it SHALL NOT raise the loading state.

#### Scenario: The agent saves a component mid-turn
- **WHEN** a turn that called the library tool settles
- **THEN** the pane lists again and the new component is there without a relaunch

#### Scenario: A turn is still running
- **WHEN** a turn is running
- **THEN** no extra listing is taken

#### Scenario: The quiet listing runs
- **WHEN** the pane re-lists after a turn
- **THEN** no skeleton rows are shown in place of the grid

### Requirement: Stills are backfilled once per launch, one at a time
An asset that has no stored still, and a sound that has no audiomap, SHALL have one taken and filed the first time it is listed. The backfill SHALL run one asset at a time. An asset whose still could not be taken SHALL NOT be attempted again for the rest of that launch.

#### Scenario: A video saved before stills existed is listed
- **WHEN** the library holds a video with no stored still
- **THEN** its frame is taken once, filed against the asset, and the card becomes a picture
- **AND** the next visit to the pane decodes nothing

#### Scenario: A clip that will not decode is listed repeatedly
- **WHEN** the same undecodable video is listed several times in one launch
- **THEN** it is attempted exactly once
- **AND** the failure is not shown to the person

#### Scenario: Nothing is missing a still
- **WHEN** every asset already has what it needs
- **THEN** nothing is decoded at all

### Requirement: A sound carries an audiomap
A sound SHALL be analysed during the same decode that draws its waveform and the result stored on its manifest. The map SHALL answer one of two verdicts — a clear rhythm, or a rhythm not to be trusted — together with energy phases, silences, hard stops and the onset rate. When the rhythm is not trusted the beat grid SHALL be withheld from what the agent is told, so it cannot cut to a grid the studio does not believe in. All times SHALL be seconds from the start of the file, with the agent told to multiply by the video's frame rate.

#### Scenario: A track with a clear pulse is analysed
- **WHEN** the tempo, the onset coverage and the onset rate all clear their thresholds
- **THEN** the verdict is a beat cut, the tempo is reported, and the beats are given to the agent
- **AND** the agent is told to cut on the hard stops and energy jumps rather than on every beat

#### Scenario: A calm swell is analysed
- **WHEN** the rhythm is weak or absent
- **THEN** the verdict is a phrase flow, no tempo and no beats are stored
- **AND** the brief tells the agent to pace by the energy phases and the silences instead

#### Scenario: A sound saved before audiomaps existed is listed
- **WHEN** a stored sound has no audiomap
- **THEN** it is analysed by the same backfill that takes stills and the map is filed against it

#### Scenario: A message is sent before the analysis finishes
- **WHEN** a sound attached to a message has not been analysed yet
- **THEN** the message goes without the map rather than waiting or failing

### Requirement: Footage too tall to seek previews from a proxy
A video asset taller than 1080 pixels SHALL have a 1080-line proxy made for it in the background, one asset at a time, and the decision SHALL be recorded on its manifest so it is never measured twice. A proxy SHALL live beside the asset's still, inside the asset's own folder, so deleting the asset takes it. A webview that cannot encode, and a file already at or under the target, SHALL both record the decision that no proxy is wanted. The preview serves the proxy; the export and a snapshot never do — see `preview/live-preview`.

#### Scenario: A 4K clip is saved
- **WHEN** a video taller than 1080 lines is in the library and the webview can encode
- **THEN** a proxy is made and filed against the asset
- **AND** the asset is usable from the moment it lands, streaming the original until the proxy exists

#### Scenario: The webview has no encoder
- **WHEN** the encoder is unavailable
- **THEN** the decision is recorded against the asset and no proxy is attempted again
- **AND** the original keeps playing

#### Scenario: The conversion fails
- **WHEN** reading, converting or filing the proxy fails
- **THEN** nothing is shown to the person and the asset keeps its original
- **AND** the step that gave up and the reason are written to the console

#### Scenario: An asset with a proxy is deleted
- **WHEN** the asset's folder is removed
- **THEN** its proxy goes with it, no copy of it having lived anywhere else

### Requirement: Files dropped on the pane are saved, and refusals are said out loud
Dropping files on the left pane SHALL save every picture, video and sound among them into the library. A drag holding media over the pane SHALL switch it to the assets view for the length of the hold and put the previous view back if the drop lands elsewhere. Anything that is neither a picture, a video nor a sound SHALL be refused in a message naming what was left out and where it did not go; a picture in a format the model cannot read SHALL be refused by format, with the way out named. Dropping on the composer is the composer's own zone; see `composer/references`.

#### Scenario: A picture and a stray source file are dropped together
- **WHEN** the drop holds one image and one `.tsx`
- **THEN** the image is saved into the library
- **AND** a message says the other is not a picture, a video or a sound, so it did not go into the library

#### Scenario: An unsupported picture format is dropped
- **WHEN** the drop holds a picture in a format the model cannot read
- **THEN** it is left out and the message names the format and says to export it as JPEG or PNG

#### Scenario: A drag crosses the pane on its way elsewhere
- **WHEN** media is dragged over the pane and released somewhere else
- **THEN** the view that was open before the drag is put back
- **AND** nothing is saved
