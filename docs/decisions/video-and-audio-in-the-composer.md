# Video and audio in the composer

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`composer/references`](../../openspec/specs/composer/references/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


A picture and a clip are both media the person hands over, and they are carried by two different
lists, because **the API has an image block and nothing else**. `attachments` stays images-only and
keeps the `[Image #N]` invariant; `media` is video and audio, and has no reference kind at all.

- **A clip is copied, not encoded.** `placeMedia` puts each one in `public/library/` before the turn
  — the same `copyInto` the assets use, so it never overwrites — and `mediaBrief` gives the agent the
  `staticFile()` path rather than the one on the person's disk, which is outside `cwd` and would
  raise a permission card on every read. Sending it as a base64 block was never an option; dropping
  it silently was the alternative, and this is the one that makes an attached clip usable.
- **No `[Media #N]`.** Relabelling `[Image #N]` to something that covers both would stop every
  stored transcript colouring its own references, and a fourth kind would duplicate what the asset
  trailer already does for a case — two or three named files — that a sentence handles. The trailer
  names each file, so "use the intro clip" resolves without a token.
- **`MediaType` is a widening of `ImageMediaType`, not a sibling**, so an image attachment is a valid
  `PromptMedia` and `library.offer`/`dismiss`/`save` took the wider type without a second path. One
  `MediaRow` renders all three kinds — a `<video>` is its own thumbnail, audio gets the icon — which
  is why `AttachmentRow` is gone rather than living beside it and drifting.
- **Only playable files reach the media list.** `useMedia` filters on `isPlayable`, so a picture
  dropped into it would still go to the model rather than being copied into `public/`.
- **A video card shows its first frame, and that takes two nudges.** A `<video>` paints nothing until
  it has decoded a frame, and *seeking to the time it already sits at fires no seek at all* — so
  frame zero is the one time you cannot ask for. `VideoThumbnail` asks for a tenth of a second both
  ways: `#t=` on the URL, and `currentTime` set from `onLoadedMetadata`. Neither is reliable alone on
  a custom protocol; together they cost one seek. `firstFrameAt` halves the duration for a clip too
  short for that tenth, and it is the single definition both the card and the extractor read.
- **A video saved to the library gets a real still, taken once.** `firstFrame` in
  `lib/studio/thumbnail.ts` decodes the frame into a `<canvas>` and hands the PNG to the same
  raw-body invoke a pasted image uses; `AssetDraft.preview` carries its path and the sidecar files it
  as `preview.png`. The pane then renders an `<img>`, so a library of thirty clips decodes no video
  to draw its list. **The `<video>` is still the fallback** — for assets saved before this existed,
  and for any frame that would not decode — which is why the tile is never a bare icon for a video.
  - **`crossOrigin = "anonymous"` is not optional here.** The asset protocol is a different origin
    from the window, so a plain load taints the canvas and `toBlob()` throws — the same trap, and the
    same fix, as a snapshot's still.
  - **A thumbnail is decoration and never fails a save.** `copiedPreview` swallows a picture that
    would not copy and the asset lands with `preview: null`, exactly as the component preview and the
    context-window reading do.
  - **The fallback heals itself, because it would otherwise decode on every visit.** Base UI's
    `Tabs.Panel` defaults to `keepMounted: false`, so leaving the Assets tab unmounts every row and
    coming back remounts them — a `<video>` fallback would decode a frame again each time, and a clip
    that cannot decode would retry for ever and still show nothing. `useBackfilledThumbnails` takes
    the frame once, files it through `library.preview`, and the next mount is an `<img>`. It runs
    **sequentially** — decoding a library's worth of video at once is the cost this avoids, not a
    faster way to pay it — and marks each slug as *its own turn begins*, not up front, so a tail cut
    short by a new listing is retried rather than lost, while a failure is remembered for the session.
  - **`useCaret` returns a memoised handle.** It used to build a fresh object every render, which
    reminted every composer callback closing over it — `pick`, `write`, `select` — and through them
    defeated the `memo` on the asset rows, re-rendering the whole panel on every keystroke. The
    composer reads the live text from a ref for the same reason.
