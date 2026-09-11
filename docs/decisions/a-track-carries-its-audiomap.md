# A track carries its audiomap

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`library/asset-library`](../../openspec/specs/library/asset-library/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


A sound saved to the library, or attached to a message, is analysed once and the result
travels with it (REM-256): `audiomapFrom` in `lib/studio/audiomap.ts` is a pure function
over mono samples, run in the same decode that draws the waveform, and its answer lives in
the manifest beside `duration`. The agent reads it in the asset or media brief as words.

- **The verdict is the payload, not the beats.** A beat array breaks on exactly the calm
  tracks where it is most tempting: the tracker imposes a metronome. So the map carries
  energy phases, silences, hard stops and onset density too, and answers `beat_cut` only
  when the tempo is stable, the onsets cover the grid and the track is dense enough. In
  `phrase_flow` the grid is withheld from the brief altogether, or the agent would cut to it.
- **Energy-based onsets, deliberately.** Half-wave rectified rise of the log energy, an
  adaptive threshold over half a second, autocorrelation for the coarse period, the median
  onset gap for the fraction the hop rounding loses, and the phase picked by coverage.
  Whether that is enough for lo-fi and ambient is the ticket's open question and is decided
  on real tracks, not ahead of them.
- **Seconds, not frames.** The sidecar does not know a composition's fps when it writes the
  brief, so times stay seconds and the brief says to multiply.
- **`PromptMedia.audiomap` is an optional key**, so an image attachment is still a valid
  media item. An attached sound is analysed after it lands (`useAnalysedAudio`), and a
  message sent before the decode finishes goes without — a missing map hides the lines,
  never fails the turn. A library sound saved before this existed is backfilled by the
  same pass that backfills thumbnails, keyed on `audiomap === null`.
