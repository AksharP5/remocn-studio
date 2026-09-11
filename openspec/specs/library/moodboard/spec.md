# library/moodboard Specification

## Purpose
Before a video is built, the agent can assemble a moodboard: a handful of stock references, a palette taken from them, a font pairing and a few tone words. This capability covers what a board is made of, how it is rendered to a picture, where it is kept, and how a project only ever holds one.

## Requirements

### Requirement: A board is a spec, and the spec is the whole board
A moodboard SHALL be described by one document holding its title, its images with a per-image id, role, grid spans, caption and attribution, its palette swatches, its font pairs, its tone words and the project it belongs to. Everything drawn SHALL be derived from that document, so the same document always produces the same picture. A document missing its title SHALL be refused; everything else SHALL decode with a default so a board written before a field existed still reads.

#### Scenario: A minimal board is read back
- **WHEN** a stored document names only a title and its images
- **THEN** it reads with an empty palette, no font pairs, no tone words and no project
- **AND** each image takes the default spans for its role

#### Scenario: A document with no title is read
- **WHEN** the stored document has no title
- **THEN** it does not decode, and the asset is not treated as a moodboard

#### Scenario: An image is marked as a texture
- **WHEN** an image's role is texture rather than photo
- **THEN** it takes a single grid cell by default, where a photo takes two by two

### Requirement: Curation is the agent's, and the studio checks what it was given
The agent SHALL curate a board through the studio's library tool: between one and twelve references, each naming exactly one of a local file or a download address, up to six palette swatches written as six-digit hex, up to six tone words and up to two font pairs. The tool SHALL ask for five to eight photographs whose light and mood agree and for a palette taken from those photographs rather than invented. A swatch that is not a hex colour, and a board with no images, SHALL be refused by name before anything is downloaded.

#### Scenario: A swatch is not a colour
- **WHEN** a swatch is given in any form other than six-digit hex
- **THEN** the save is refused with a message naming that swatch and the shape a swatch takes
- **AND** nothing is downloaded and nothing is stored

#### Scenario: A board names no images
- **WHEN** a save arrives with an empty image list
- **THEN** it is refused with a message saying a moodboard needs at least one image

#### Scenario: An image names both a file and an address
- **WHEN** an image names a local file and a download address together, or neither
- **THEN** the call is refused rather than one of the two being guessed at

### Requirement: The references are staged before the board is drawn
Each reference SHALL be brought into a staging folder before the board is rendered: a local path SHALL be copied, an address SHALL be downloaded, one at a time. Each staged file SHALL be renamed after its position in the board, keeping the extension it arrived with. The staging folder SHALL be removed whether the save succeeded or failed.

#### Scenario: A local project still is used as a reference
- **WHEN** a reference names a file inside the project
- **THEN** it is copied into staging rather than fetched over the network

#### Scenario: A download answers badly
- **WHEN** a reference's address answers with an error status
- **THEN** the save fails naming the address and the status
- **AND** the staging folder is removed and no asset is written

### Requirement: The board is rendered at a fixed size through the project's preview
The board SHALL be drawn as a page authored to exactly 1440 by 900 pixels — a dense photo grid beside a rail of title, tone words, palette, font pairs and photo credits — and captured by the preview host at that viewport, after its fonts have loaded and a frame has been drawn. The only thing fetched while rendering SHALL be the font stylesheet the chosen families need; everything else SHALL be read from the staging folder. Text the person or the agent wrote SHALL be escaped where it is drawn.

#### Scenario: The board has no font pairs and no credited photographers
- **WHEN** neither typography nor attribution is present
- **THEN** no font stylesheet is requested and no credits line is drawn

#### Scenario: The preview is not running for this project
- **WHEN** a board is saved while no preview is running for the project
- **THEN** the save fails saying the board could not be rendered because the preview is not running for this project
- **AND** no asset is stored

#### Scenario: The render fails
- **WHEN** the capture cannot be taken, or the installed Remotion does not expose what a screenshot needs
- **THEN** the save fails with a message saying the moodboard could not be rendered and why
- **AND** the staging folder is removed and no asset is written

### Requirement: A board is an ordinary library asset
A saved board SHALL be stored as one library asset of the image kind, holding its document, its staged images and the rendered picture as the asset's still. Its description SHALL be the word Moodboard followed by its tone words when it has any. It SHALL carry the library's previews, its delete-with-undo and its insertion unchanged; see `library/asset-library`.

#### Scenario: A board is saved
- **WHEN** a board is stored
- **THEN** it appears in the library as an image asset whose card is the rendered board
- **AND** the answer to the agent names the asset, its slug, how many references it holds and where the rendered picture is

#### Scenario: A board is deleted
- **WHEN** the asset is deleted from the pane
- **THEN** its document, its staged images and its rendered picture go with it, inside the same undo window every other asset has

### Requirement: A project has one board, and saving replaces it
Saving a board for a project that already has one SHALL remove the existing board before writing the new one, so that correcting a single block is the same call with only that block changed.

#### Scenario: The third photograph is wrong
- **WHEN** the board is saved again with one reference replaced
- **THEN** the previous board's asset is removed and the new one takes its place
- **AND** the library holds exactly one board for that project

#### Scenario: A board is saved for a project that has none
- **WHEN** no board exists for the project
- **THEN** nothing is removed and the new board is stored

### Requirement: An existing board is read before anything is generated
The agent SHALL be able to ask for the project's existing board and SHALL be told to do so before generating one. The answer SHALL carry the board's name, its slug, the path of the rendered picture and the whole document, together with the instruction to work from it and not regenerate unless the person explicitly asks to start over.

#### Scenario: The project already has a board
- **WHEN** the agent asks for the board and one exists
- **THEN** it gets the document and the path of the rendered picture to look at
- **AND** it is told not to regenerate the board unless asked to start over

#### Scenario: The project has no board yet
- **WHEN** the agent asks and nothing has been saved for this project
- **THEN** the answer is that there is no moodboard for this project yet

#### Scenario: The board exists but rendered no picture
- **WHEN** the stored board has no rendered picture
- **THEN** the answer says so rather than naming a path that is not there
