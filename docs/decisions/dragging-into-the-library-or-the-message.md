# Dragging into the library, or into the message

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`composer/references`](../../openspec/specs/composer/references/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`onDragDropEvent` from Tauri, not HTML5 drag events: with `dragDropEnabled` on — the default — the
webview never fires them for files, and a `File` from a WKWebView drop carries no path anyway. The
event gives absolute paths, which is what the library wants and what keeps a 200 MB video off the
IPC.

- **The point arrives in CSS pixels, and believing otherwise misfiled every drop** (REM-333). Tauri
  types the drag position as a `PhysicalPosition` the whole way up, so `isInside` used to divide it
  by `devicePixelRatio`. It is not physical: on macOS wry builds it from AppKit — `draggingLocation()`
  against the view's own `frame()`, both in *points* (wry 0.55.1, `src/wkwebview/drag_drop.rs`).
  Points are CSS pixels, which is what `getBoundingClientRect()` answers in, so the division moved
  every drop up and to the left — on a 2× display far enough to push a release in the middle of the
  composer into the sidebar, where the file was silently filed in the library and the message got
  nothing. The two symptoms that hid it are the same fault: the composer never lit its drop ring,
  because as far as the app was concerned the pointer was never over it. `isInside` in
  `lib/studio/drop.ts` takes no ratio at all now, and is pure and pinned by tests, because the drag
  itself is the one part no seam can exercise.
- **Anything that is not media is refused out loud, and there are two refusals** (REM-317). A dropped
  `.tsx` is not an asset the panel can make — a component's boundaries are the agent's to work out —
  so the pane says what it skipped rather than saving half a drop in silence, naming where they did
  not go because there are two places they could have gone. A **picture** is the other case and it
  needed its own sentence: the API reads jpeg, png, gif and webp and nothing else, so a `.heic` is a
  real refusal, but *"that is not a picture"* about a photograph is unhelpful and untrue.
  `unsendableImageOf` recognises the formats the studio knows and cannot send, and the refusal names
  the format and the way out. Video and audio have no such constraint — they are never sent to the
  model, only copied into `public/library/` and played by the project's own renderer — so `.m4v`,
  `.mkv`, `.avi`, `.mpeg`, `.flac`, `.aiff`, `.opus` and `.oga` are simply taken.
- **The composer is the second zone, and there is still one watcher** (REM-255). `useFileDrops` owns
  the only `onDragDropEvent` subscription and asks `zoneAt` — an ordered list of boxes, first match
  wins — which zone a point is in; the two zones are disjoint on screen today, so the order is
  insurance rather than arbitration, and a zone whose box is `null` is simply not on screen. Two
  listeners racing over the same drop is the thing this avoids: each one would have to know the
  other's rectangle to stay out of its way.
- **A dropped file is sorted by kind, not by where it landed.** Pictures go to `attachments` with an
  `[Image #N]` written at the caret, exactly as a paste does — the gesture is the same one — and
  video and audio go to `media`, which carries no reference kind. A mixed drop splits across both,
  and each list filters the paths itself, so the split is the two `arriving` functions that already
  existed rather than a third place that decides what an image is.
- **A locked composer is not a zone.** Waiting on a permission card, a folder that is gone, a
  blocking environment check: `isComposerOpen` goes false, the box leaves the hit test and the ring
  never lights, so the composer cannot promise something it would drop on the floor. A composer that
  is not rendered at all — the new-project wizard, a transcript still loading — falls out for free,
  since its ref is null.
- **A drop that misses both zones is silent.** It also puts the left pane back: a drag that passed
  over the library to reach the composer switched the view to Assets on the way, and letting go
  anywhere reverts it.
