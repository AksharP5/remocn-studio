## Context

See proposal.md for why. Today `placeMedia(cwd, media)` in `sidecar/library/insert.ts` copies each attached file with the same `copyInto` that library assets use. `copyInto` takes `public/library/<basename>` and, when that path exists, reports it as `skipped` without comparing anything. `mediaBrief` then names `[...copied, ...skipped][0]`, so a skipped name hands the agent whatever file was already there.

The turn handler (`sidecar/handlers.ts`) already resolves the open video before placement: `videoRow.compositionId` is the video's slug. The same slug names `src/videos/<slug>/` (`projects/videos`: the slug is the folder name and the composition id), so the value is at hand and nothing new crosses the wire.

## Goals / Non-Goals

**Goals:**
- The path in the media brief always holds the bytes that were attached.
- A video's attached footage sits in a folder only that video's turns write into.
- The whole change stays in the sidecar, with no new state and no frame change.

**Non-Goals:**
- Changing how `[Asset #N]` library assets are placed. `copyInto` keeps its skip-on-name rule for them.
- Reorganising media already in `public/library/`.

## Decisions

### The media folder is `public/library/<video-slug>/`

`MEDIA_FOLDER` stays the root, and attached media goes one level down, into the slug of the video the turn runs for. `staticFile("library/<slug>/<file>")` resolves because Remotion serves `public/` recursively, and the preview's asset picker (`sidecar/preview/statics.ts`) already walks nested folders.

- *Alternative: inside the video's source folder, `src/videos/<slug>/media/`.* This keeps a video's footage next to its code, but `staticFile()` only serves `public/`, so the clip would have to be imported through webpack. Remotion's docs steer large media away from that, and every brief and skill would have to change what "reference it" means. Rejected.
- *Alternative: `public/videos/<slug>/`.* This works just as well, but it starts a second media root beside `library/`. The agent and the person already know `library/` as the place where studio-placed media lives. Rejected.
- *A library asset file and a video slug share `public/library/`.* An asset file always carries an extension (`intro.mp4`), and a slug never has a dot (`slugFor` keeps `[a-z0-9-]` only, and Remotion refuses a composition id with a dot in it), so a file and a folder can never claim the same name. The numbered names follow `freeSlug`'s `-2`, `-3` pattern, so the project reads one convention.

`placeMedia` takes the slug as a parameter: `placeMedia(cwd, video, media)`. The handler passes the `video` it already holds. The sidecar owns the decision end to end.

### A taken name is resolved by content, not skipped

For each attached file, the sidecar walks the candidate names in order: `<stem><ext>`, then `<stem>-2<ext>`, `<stem>-3<ext>`, and so on.

- The candidate does not exist: copy there, and report it as `copied`.
- The candidate exists and is identical: reuse it, and report it as `skipped` (the brief already says "sits at").
- The candidate exists and differs: try the next number.

This terminates at the first free name. Re-attaching a clip that already got `-2` finds `-2` identical and reuses it rather than minting `-3`. Placement stays sequential (`Effect.forEach` without concurrency), so two different `footage.mp4` files in one message land as `footage.mp4` and `footage-2.mp4` rather than racing for the same name.

- *Alternative: always copy under a fresh unique name (timestamp or hash suffix).* This is simpler, but every re-send of the same clip would add another copy and the file names would become noise the agent writes into code. Rejected.
- *Alternative: name the copy by content hash.* It is stable and de-duplicates for free, but `staticFile("library/intro/3f9a….mp4")` loses the person's own name, which is what the brief relies on to connect "use the intro clip" to a file. Rejected.

### Identity is size, then a streamed SHA-256

Sizes are compared first with `stat`. Only equal sizes are hashed, both files streamed through `createHash("sha256")`, never read whole: clips can run to gigabytes, and `proxies.ts` reads whole files only because it caches the result per host. The cost is paid only when a same-named file has the same byte length, which in practice means it is the same clip. `proxies.ts` measured SHA-256 at about 40 ms on a 15 MB clip, which is roughly 2.7 s per GB, once per turn at most.

- *Alternative: compare mtime and size only.* A copy made by `copyFile` does not preserve the source mtime on every filesystem, so identical files would read as different and be copied again. Rejected.

### A copy lands under its real name only once it is complete

The copy goes to a dot-prefixed partial name in the same folder and is renamed into place. A copy interrupted mid-write (the sidecar killed, the disk full) would otherwise leave a truncated `footage.mp4` behind. That file would compare as different forever and push every later attach to `-2`, and meanwhile the preview would play a broken clip under the attached name. The partial file is removed on failure.

### Failure direction

Placement already runs inside the handler's `copied("attached media", …)` wrapper. A `LibraryError` is logged, the person sees the notice "The attached media could not be copied into the project: …", and the turn proceeds without a media brief. That stays as it is. A failure never fails the turn, and it is never silent: the notice is the spec's failure scenario. A hash or stat error is a `LibraryError` like any other copy error, so it cannot degrade into a wrong path. The only path the brief can name is one this placement copied or verified.

### No wire, history or settings change

`PromptMedia` and the turn frame are unchanged, so there is no `SIDECAR_PROTOCOL` / Rust `PROTOCOL` bump, no migration in `sidecar/history/migrations.ts`, and no new `settings.json` key.

## Risks / Trade-offs

- [The same clip attached to two videos is stored twice] → This is intended (see the proposal's Non-goals). Footage is large, but a per-video folder that can be read without cross-references is the point of the change.
- [Existing chats resume with code pointing at `library/<file>`] → Nothing moves, so those references keep resolving. Only new attaches go into the per-video folder.
- [An orphaned `.partial` file after a hard kill] → It is dot-prefixed, so the name walk never considers it, and `statics.ts` already skips dot entries, so the asset picker never offers it. The next attempt overwrites it.
- [Hashing a multi-GB clip of equal size stalls the turn start for seconds] → This happens only when a same-named file of identical length exists, which is almost always the same clip. The sidecar reports nothing during it. The turn starts once placement finishes, as it does today for a large copy.
