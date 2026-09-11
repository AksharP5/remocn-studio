# library/stock-search Specification

## Purpose
Stock photography and footage are searched from inside the studio and saved straight into the library with their attribution remembered. This capability covers where the key lives, what a search answers with, how a result is named and stored, and how the agent reaches the same search without ever seeing the key or the network.

## Requirements

### Requirement: The key lives in the sidecar and only its presence crosses back
The API key SHALL be held by the sidecar, in a file inside the library folder, with `REMOCN_STUDIO_PEXELS_KEY` as the fallback when nothing has been stored. The webview SHALL be able to set a key, forget it, and ask whether one is configured; it SHALL NOT be able to read the key back, and the key SHALL NOT reach the agent.

#### Scenario: A key is pasted into Settings
- **WHEN** a key is saved
- **THEN** it is written into the library folder and the answer is that stock search is configured
- **AND** the field is cleared rather than left showing what was typed

#### Scenario: The stored key is forgotten
- **WHEN** the key is forgotten
- **THEN** the stored file is removed
- **AND** the answer is that stock search is still configured only if the build ships a key of its own

#### Scenario: Nothing has been stored
- **WHEN** no key has been saved and the environment names none
- **THEN** stock search reports itself unconfigured

### Requirement: The pane says what is missing before it says nothing was found
The stock view SHALL distinguish four states: no key, an empty query, a search that found nothing, and a search that failed. With no key it SHALL say a key is needed, that it is free, and offer to open Settings.

#### Scenario: No key is configured
- **WHEN** the stock view is opened with no key
- **THEN** it says Pexels needs an API key, where to get one, that the key stays on this machine, and offers Open Settings
- **AND** no request is made

#### Scenario: The field is empty
- **WHEN** no query has been typed
- **THEN** the view explains that results land in the library with their licence and author remembered, rather than showing an empty grid

#### Scenario: A query matches nothing
- **WHEN** the search answers with no items
- **THEN** the view says nothing on Pexels matches that query, naming it

### Requirement: Searching is per kind, paged, and settles before it asks
A search SHALL be for photos or for footage, chosen by the scope switch above the field, and SHALL be sent only after typing has settled. Results SHALL arrive thirty at a time with More results offered while further pages exist; a further page SHALL be appended without repeating an item already shown.

#### Scenario: The query is typed on
- **WHEN** more characters are typed before the previous search has gone out
- **THEN** the earlier search is abandoned and only the latest is sent
- **AND** the results already on screen are not replaced by skeletons while typing continues

#### Scenario: More results is pressed
- **WHEN** another page is asked for
- **THEN** its items are appended to the ones already listed, and any item already present is dropped
- **AND** More results disappears once the last page has been reached

#### Scenario: The query is cleared
- **WHEN** the field is emptied
- **THEN** the results, the paging state and any error are cleared and no request is sent

### Requirement: A refused or failing search is worded, never raw
The studio SHALL word the three failures the API distinguishes: a key that was refused, a key that is being rate-limited, and any other status. A page entry that does not decode SHALL be dropped from the results rather than failing the whole page.

#### Scenario: The key is refused
- **WHEN** the search is answered with an unauthorised or forbidden status
- **THEN** the message says Pexels refused the API key and to check it in Settings

#### Scenario: The key is rate-limited
- **WHEN** the search is answered with a too-many-requests status
- **THEN** the message says the key is being rate-limited and to try again in a minute

#### Scenario: One result in a page is malformed
- **WHEN** an entry in the answer cannot be read, or a clip names no downloadable file
- **THEN** that entry is left out and the remaining results are shown

### Requirement: A result carries everything attribution needs
Every result SHALL carry the author, the author's page, the item's own page, a thumbnail streamed from the provider, the download address, the pixel dimensions and, for footage, its length. A clip SHALL be downloaded at the largest available version. Nothing SHALL be downloaded until a result is chosen.

#### Scenario: The grid is browsed
- **WHEN** results are shown
- **THEN** each card streams only its thumbnail and prints its author underneath
- **AND** a clip also shows its length

#### Scenario: A clip offers several files
- **WHEN** a result names several downloadable versions
- **THEN** the widest one is chosen, preferring the ones the provider marks as mp4

### Requirement: A saved result is named for what was searched, not for its alt text
An asset saved from a search SHALL be named after the query and the photographer, in that order. With no author the query alone SHALL be the name, and with no query at all the item's own name or its kind and author SHALL stand in. The item's own descriptive text SHALL stay where prose belongs — on the card that was picked from — and SHALL be cut at a word boundary rather than carried in full.

#### Scenario: A photo is saved from a search
- **WHEN** a result of a search for "ocean" by a named photographer is saved
- **THEN** the asset is named for that query and that photographer

#### Scenario: The name would run long
- **WHEN** the query and the author together exceed the label a card can show
- **THEN** the query alone is used rather than a name cut mid-word

#### Scenario: A result carries a sentence-long description
- **WHEN** the provider's description is longer than the name limit
- **THEN** it is cut at a word boundary with trailing punctuation removed, and it is used only where no query is available

### Requirement: Saving downloads into the library with the source remembered
Saving a result SHALL download it into a temporary folder, save it as an ordinary library asset, and remove the temporary folder whether or not the save succeeded. The asset SHALL record the provider, the item's id, the author, the author's page and the item's own page, and its description SHALL be the attribution sentence. Progress SHALL be reported as it downloads, and a card already saved or still saving SHALL not be startable again.

#### Scenario: A result is saved
- **WHEN** a card is clicked
- **THEN** the file is downloaded with a progress bar over the card, filed in the library, and the card is marked as saved
- **AND** the library listing is refreshed so the new asset is there

#### Scenario: The download answers badly
- **WHEN** the download answers with an error status or no body
- **THEN** a toast says the download failed, naming the item
- **AND** nothing is left in the library and the temporary folder is removed

#### Scenario: The same card is clicked twice
- **WHEN** a card that is already saving or already saved is clicked
- **THEN** nothing further is downloaded

### Requirement: The agent searches through the studio, never the network
The agent SHALL be able to search stock through the studio's own library tool, which answers with the items' names, authors, dimensions, lengths, download addresses and page addresses for it to pass back. The key and the request SHALL stay in the sidecar. A search that finds nothing SHALL answer with a sentence rather than an error.

#### Scenario: The agent searches for references
- **WHEN** the agent calls the stock search tool with a query
- **THEN** it gets the matching items as data, with the download address and attribution for each
- **AND** it is told the next page number when more results exist

#### Scenario: The agent's search finds nothing
- **WHEN** the provider matches nothing
- **THEN** the tool answers that nothing was found for that query and suggests different words

#### Scenario: No key is configured
- **WHEN** the agent searches with no key configured
- **THEN** the tool answers that searching needs a key, naming where to add one
- **AND** no request is made
