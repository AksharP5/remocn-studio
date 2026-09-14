## Purpose

Lets a person generate a sound effect through their own ElevenLabs connection and retain the result locally, with explicit payment consent and no automatic repeat charge after an uncertain outcome.

## ADDED Requirements

### Requirement: Generation uses a current connection without exposing its credential

The core SHALL use the selected ElevenLabs connection and its locally held credential. Removed, disabled, rejected or changed connections SHALL be refused before paid dispatch. Credentials SHALL NOT appear in model input, tool results, history, logs or project files.

#### Scenario: A connection changes while approval is pending
- **WHEN** the selected connection is disabled, removed or reauthorized before execution
- **THEN** the prepared operation is refused and the person is asked to prepare it again
- **AND** no paid request uses the stale approval

#### Scenario: Two ElevenLabs connections exist
- **WHEN** the person approves a sound effect using one connection
- **THEN** only that connection is used and both credentials remain private

### Requirement: Sound parameters and access limits are checked honestly

The service SHALL accept a nonempty description, a requested duration from 0.5 through 30 seconds or automatic duration, and MP3 at 44.1 kHz with 128 or 192 kbps. It SHALL refuse invalid inputs and known unavailable formats before paid dispatch. Account verification SHALL NOT be presented as proof of sound-generation permission when the provider does not disclose that permission; operation-specific access SHALL be verified by the explicitly approved operation.

#### Scenario: The input is invalid
- **WHEN** the description is empty, the duration is nonfinite/out of range, or the format is unsupported
- **THEN** a sentence identifies the invalid parameter and no paid request is sent

#### Scenario: A restricted format is selected
- **WHEN** the selected account is not known to qualify for 192 kbps MP3
- **THEN** generation is refused with format/tier guidance and the format is not silently changed

#### Scenario: The key permits account reads but refuses sound generation
- **WHEN** an approved operation receives a missing-permission response
- **THEN** the person is told to enable sound-generation access or replace the key
- **AND** no automatic retry or successful sound is reported

### Requirement: Each approved operation sends at most one paid request

The core SHALL retain the identity and outcome of every dispatched operation. Repeated execution, lost replies and application restarts SHALL NOT repeat the paid request. An uncertain outcome SHALL state that credits may have been consumed. Another generation SHALL require a new explicit approval.

#### Scenario: An execution is delivered twice
- **WHEN** the same operation is committed twice, including concurrently
- **THEN** at most one paid request is sent and the existing operation status is returned

#### Scenario: The provider reply is lost
- **WHEN** the request was dispatched but its result cannot be established
- **THEN** the operation is reported as uncertain and is not resent

#### Scenario: The app restarts during a dispatched operation
- **WHEN** a persisted operation has no completed result after restart
- **THEN** it remains uncertain and the person can inspect its status without initiating another generation

### Requirement: Cancellation distinguishes waiting from dispatched work

The service SHALL cancel an unapproved operation without payment. Cancellation after dispatch SHALL retain operation status and SHALL NOT claim the provider cancelled billing. Any fully downloaded result SHALL remain recoverable locally.

#### Scenario: A turn stops while approval is waiting
- **WHEN** the turn is stopped before approval
- **THEN** the request is declined and nothing is generated

#### Scenario: A turn stops after dispatch
- **WHEN** the paid request has already been sent
- **THEN** waiting stops, possible credit use is explained, and status remains available

### Requirement: Provider and local failures produce actionable outcomes

The service SHALL distinguish authorization, missing permission, quota/balance, rate limit, unsupported format, network uncertainty and local storage failures. Incomplete or non-audio responses SHALL NOT be published as sound assets. A local storage failure SHALL NOT cause paid regeneration.

#### Scenario: The response is invalid audio
- **WHEN** the provider returns empty, truncated, oversized or non-audio content
- **THEN** no playable asset is announced and the person receives a worded failure

#### Scenario: Credits are exhausted
- **WHEN** the provider refuses the approved request because of quota or balance
- **THEN** the person is told to review their ElevenLabs allowance and nothing is retried automatically

#### Scenario: A local write fails after generation
- **WHEN** generation succeeded but the library cannot accept the file
- **THEN** the person is told the local save failed and any completed download is retained for local recovery

### Requirement: Sound generation is offered after an agent response

The chat SHALL show an English “Generate sound” pill above TaskDock and QueueDock, aligned with the empty composer, only when the current chat contains a nonempty assistant response, transcript loading has finished, and no turn is running or awaiting approval. New chats and empty projects SHALL NOT show the pill. It SHALL read current connections when activated, respect composer locking, and preserve carried attachments and text entered while checking. Connection-read failures SHALL be visible and retryable.

#### Scenario: ElevenLabs is ready
- **WHEN** the person activates the pill with a usable ElevenLabs audio connection
- **THEN** “Generate a sound effect: ” is inserted into the empty composer and focused with the cursor at the end
- **AND** no message or generation request is sent

#### Scenario: ElevenLabs requires setup
- **WHEN** no usable ElevenLabs audio connection exists
- **THEN** Settings opens at Integrations without altering the draft

#### Scenario: A person is already writing
- **WHEN** the draft contains text
- **THEN** the pill is hidden

#### Scenario: A new chat or empty project
- **WHEN** the current chat has no assistant response
- **THEN** the Generate sound pill is hidden

#### Scenario: An agent response finishes
- **WHEN** the current chat contains an assistant response and execution has ended
- **THEN** the pill is available if the composer is empty and enabled
- **AND** it is hidden again during the next turn or while approval is pending

### Requirement: A saved sound has a persistent result card

After successful library ingestion, a typed sound result SHALL be rendered in the originating transcript with a local audio player and English Use in video and Regenerate actions, independently of the assistant's text. The result SHALL persist with history and duplicate result events within a turn SHALL update the same card. No credential or temporary download path SHALL be stored in the card.

#### Scenario: The sound finishes
- **WHEN** the generated audio is saved into the library
- **THEN** a Sound ready card appears with local playback and seeking without autoplay
- **AND** reopening the chat retains the card

#### Scenario: The person uses the sound
- **WHEN** Use in video is pressed
- **THEN** a new request with the current library asset is sent through the existing turn submission or queue path
- **AND** the composer draft is preserved and duplicate clicks while sending are ignored
- **AND** missing media or a refused send produces an inline error

#### Scenario: The person regenerates
- **WHEN** Regenerate is pressed
- **THEN** the composer receives an editable prompt containing the original generation parameters
- **AND** no message is sent and no generation is started by that action
