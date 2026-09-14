# ElevenLabs music generation

Approved: repeat the Generate sound workflow for music.

- Show Generate music alongside Generate sound with identical visibility, locking,
  draft preservation and integration setup behavior. It inserts an editable
  instrumental-music prompt without sending a message or spending credits.
- Expose generate_music and music_status to the agent. Default to instrumental;
  allow vocals when requested. Parameters include description, duration and name.
- Reuse the durable audio operation lifecycle and its per-request permission gate,
  recovery and exactly-once dispatch. Preserve existing sound operation records.
- Use POST /v1/music, music_v1, MP3 44.1 kHz/128 kbps, prompt up to 4,100
  characters, and automatic or 3–600-second duration. Convert seconds to integer
  milliseconds. Give music requests a longer timeout and bounded download size.
- Save music model and instrumental preference to library provenance and retain
  them in chat result cards and regeneration prompts. Reuse local playback and
  explicit Use in video behavior.

Reference: https://elevenlabs.io/docs/api-reference/music/compose

Verification: schema and IPC compatibility, tool routing/defaults, approval and
no paid retries, native HTTP payload via a local mock server, library recovery,
composer insertion/setup routing, and regeneration intent. No live paid request.
