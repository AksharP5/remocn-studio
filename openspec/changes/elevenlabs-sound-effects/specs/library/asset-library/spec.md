## ADDED Requirements

### Requirement: Generated sounds retain provenance and play locally

A completed generated sound SHALL become a local audio asset with its provider, operation identifier, selected connection identifier/name and generation parameters. Existing stock provenance SHALL remain readable. The person SHALL be able to listen locally after generation without another provider request.

#### Scenario: A sound effect is completed
- **WHEN** its audio and library manifest are saved successfully
- **THEN** it appears in the library with generation provenance and local playback
- **AND** waveform or analysis failure does not prevent use of the sound

#### Scenario: Existing library assets are listed
- **WHEN** generated, Pexels and source-less assets coexist
- **THEN** all valid assets remain listed with their respective source information

### Requirement: Importing a generated result is recoverable without duplicating payment or assets

Ingestion of the same completed operation SHALL be idempotent, including concurrent recovery and restarts. An existing asset SHALL never be overwritten. A downloaded sound whose import failed SHALL remain recoverable without generating it again.

#### Scenario: A completed result is imported twice
- **WHEN** an import is repeated after a lost reply or restart
- **THEN** the existing asset is returned and neither a duplicate asset nor another paid request is created

#### Scenario: Two sounds share a name
- **WHEN** different completed operations use the same asset name
- **THEN** they receive distinct asset folders and neither overwrites the other

#### Scenario: Ingestion failed locally
- **WHEN** the library becomes writable again after an import failure
- **THEN** the completed download can be imported without contacting the generation endpoint

### Requirement: Generated sounds enter a Project or Video only by explicit selection

Saving a generated sound SHALL NOT automatically attach it to a message, write project files or change a Video. The person SHALL explicitly select the asset for the intended Project/Video; insertion SHALL preserve existing project files.

#### Scenario: The person listens before using the sound
- **WHEN** a sound has just been generated and played from the library
- **THEN** no project file or Video has been changed by generation or playback

#### Scenario: The person attaches the sound to a Video message
- **WHEN** the selected sound is included in a message for that Video
- **THEN** it is copied through normal asset insertion and is available to the Remotion project
- **AND** existing files at the destination remain untouched
