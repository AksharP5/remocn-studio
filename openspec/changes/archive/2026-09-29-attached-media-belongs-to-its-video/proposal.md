## Why

A clip attached in one video's chat can make the agent use another video's footage. Every attached clip or sound lands in the project-wide `public/library/` under its own file name. Copying skips a file whose name is already taken, and the brief still names that path. Attach `footage.mp4` to video A, then a different `footage.mp4` to video B, and B's turn is told "footage.mp4 sits at `public/library/footage.mp4`", which is A's clip. The agent does what it is told and builds B out of A's footage. Names collide more often than it seems: `IMG_0001.MOV` from a phone, `video.mp4` from a download, a re-export under the same name.

Even when names differ, every video's footage shares one flat folder. An agent that lists `public/library/`, or reads another video's code for style, meets clips that were never handed to this video.

Found in use; no issue is filed.

## What Changes

- An attached clip or sound lands in the open video's own media folder, `public/library/<video-slug>/`, not in the flat `public/library/`. The brief names that path and its `staticFile("library/<video-slug>/<file>")` form.
- When the name is already taken in that folder, the contents are compared. An identical file is reused and reported as already there. A different file is copied under the lowest free numbered name (`footage-2.mp4`, `footage-3.mp4`, …) and the brief names that copy. An attached file never resolves to a different file.
- Re-attaching a file that already has a numbered copy reuses that copy rather than minting another one.
- Media already in the flat `public/library/` from earlier turns stays where it is; code that references it keeps working.

## Non-goals

- **Assets referenced from the studio's library** (`[Asset #N]`) keep landing in the flat `public/library/`. There, one name really is one asset (it is copied from the library under its own slug), so skipping an existing file is still the right answer. `library/asset-library` does not change.
- **No migration of existing files.** Moving `public/library/*` into video folders would rewrite `staticFile()` paths in code the person or the agent wrote. Nothing is written into the project except what a turn asks for.
- **No clean-up when a video is deleted.** Deleting a video leaves its source folder on disk today, and its media folder follows the same rule.
- **No de-duplication across videos.** The same clip attached to A and to B is copied into both folders. One copy per video keeps the rule simple: a video's footage is what sits in its own folder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `composer/references`: the requirement *Video and audio are carried with no reference kind* now says where an attached clip lands (the open video's media folder) and what happens on a name collision (identical is reused, different gets a free name). The agent is never pointed at a file other than the one attached.

## Impact

- **Shared contract**: none. `PromptMedia` and the turn frame are unchanged, so no protocol bump.
- **Sidecar**: `sidecar/library/insert.ts` gets `placeMedia(cwd, video, media)`, a per-video target folder and a content-aware copy that is separate from `copyInto`, which assets keep. `sidecar/handlers.ts` passes the turn's resolved video slug. `sidecar/library/insert.test.ts` replaces the test that pinned the old skip-on-name behaviour.
- **Preview host**: unaffected. `statics.ts` already walks `public/` recursively, so the properties pane's asset picker lists `library/<slug>/…`. Proxies match by content hash, not by path.
- **Rust core / webview**: none.
