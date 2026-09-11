# The library is a grid of cards

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`library/asset-library`](../../openspec/specs/library/asset-library/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The panel is a two-column grid of the `Attachment` primitives — `AttachmentMedia variant="image"`
over an `AttachmentTitle` — rather than a list of rows with an icon and a type label.

- **One still per kind, one field to hold it.** A video shows a frame; a sound shows its waveform,
  drawn from peaks by `peaksFrom` and baked to a PNG. Both land in the same `preview.png`, so the
  manifest field, the backfill, the `<img>` in the tile and the drop handling were all written once
  and neither kind is a special case downstream.
- **The waveform's colour is baked, so it cannot follow the theme.** It is a mid tone chosen to read
  against the card's muted background in both, rather than a token that would be right in one and
  invisible in the other. Peak normalisation is what stops a quiet recording drawing as a flat line.
- **`duration` is measured during the decode that was already happening** — `video.duration` while
  seeking for the frame, `AudioBuffer.duration` while decoding for the waveform — so the badge costs
  no extra pass. `clipTime` is `mm:ss` until a clip earns an hour. A length that was never measured
  badges nothing rather than showing `00:00`.
- **The card's click target is `AttachmentTrigger`**, which is `absolute inset-0 z-10`, and Delete
  is an `AttachmentAction` inside `AttachmentActions` at `z-20`. So the whole card inserts the asset
  except that button, with no hit-testing of our own — the two are siblings, not nested, so the
  trigger's handler never sees the delete click and nothing has to stop propagation.
- **Deleting forgives, exactly as deleting a session does.** The tile leaves the grid at once and
  `library.remove` is held behind an undo window — `Effect.sleep` in a forked fiber — with the
  toast's Undo a fiber interrupt that puts the card back at its old index. Quitting inside the
  window drops the delete rather than rushing it: the asset comes back next launch, which is the
  failure direction that keeps data. It is one button rather than a menu, so there is no
  confirmation dialog to dismiss; the window *is* the confirmation.
  - **The refresh above and this window have to agree.** A pending delete is still on disk, so a
    listing taken inside it would put the row back and read as the delete having failed. `load`
    therefore filters the rows against the held deletes.
- **The kind moved from a visible second line into the trigger's `aria-label`.** The tile now says
  what it is by showing it; a screen reader still hears "Neon Title, Component".
