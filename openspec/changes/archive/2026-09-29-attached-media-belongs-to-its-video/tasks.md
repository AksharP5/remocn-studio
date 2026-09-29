## 1. Sidecar placement

- [x] 1.1 `sidecar/library/insert.ts`: add `sameContent(one, other)`, which compares sizes via `stat` and hashes both files with a streamed SHA-256 only when the sizes match, as an Effect that fails with `LibraryError`. Verify in `sidecar/library/insert.test.ts` with identical files, files of the same size but different bytes, and files of different sizes.
- [x] 1.2 `sidecar/library/insert.ts`: add the media copy, separate from `copyInto` (which the assets keep). It walks `<stem><ext>`, `<stem>-2<ext>`, … under `public/library/<video>/`, reuses the first identical candidate as `skipped`, and otherwise copies to the first free name through a dot-prefixed partial file that is renamed into place and removed on failure. Verify in `insert.test.ts`: a free name is copied, an identical file is reused, a different file lands at `-2`, re-attaching the `-2` bytes reuses `-2`, and a failed copy leaves no file under the real name.
- [x] 1.3 `placeMedia(cwd, video, media)`: target `public/library/<video>/` and place the items sequentially. Replace the test *leaves a file already in the project untouched* with the collision cases from 1.2. Update *copies an attached video into public/library and says where* so it expects `public/library/<video>/intro.mp4`. Add two same-named, different files in one call landing as `name` and `name-2`. Verify in `insert.test.ts`.
- [x] 1.4 Verify in `insert.test.ts` that `mediaBrief` names `staticFile("library/<video>/<file>")` for a nested path, and that a file already in the flat `public/library/` is neither read nor touched by a new placement.
- [x] 1.5 `sidecar/handlers.ts`: pass the turn's resolved `video` (the video row's slug) to `placeMedia`. Verify with `bun run typecheck`, plus the handler test if one covers media placement (`grep -rn placeMedia sidecar`).

## 2. Verification

- [x] 2.1 Add a changeset (`bun run changeset`, patch): "Footage attached in one video's chat can no longer be swapped for another video's clip that has the same file name."
- [x] 2.2 Run `bun run check`, `bun run typecheck`, `bun run test sidecar/library/insert.test.ts`, then the full `bun run test` once.
- [x] 2.3 `openspec validate attached-media-belongs-to-its-video --strict` passes.
- [x] 2.4 In the running app (the user runs `bun tauri dev`), in one project:
  - Attach a clip named `footage.mp4` in video A's chat and send. It lands at `public/library/<a-slug>/footage.mp4`.
  - Create video B and attach a *different* clip, also named `footage.mp4`. It lands at `public/library/<b-slug>/footage.mp4`, and B's preview plays B's clip, not A's.
  - Attach another different `footage.mp4` in B. It lands as `footage-2.mp4`.
  - Re-attach the first one in B. No third copy appears.
  - The properties pane's asset picker lists `library/<slug>/…`.
