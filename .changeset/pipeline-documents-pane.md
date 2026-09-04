---
"remocn-studio": minor
---

The documents the production pipeline writes — analysis, brand, script,
motion, choreography, review — can be read in the app. The right pane's title
becomes a **Preview | Docs** switch, and Docs is a file manager's tab strip
over the document itself: one tab per markdown file the video's docs folder
holds, in pipeline order with anything else after it by name, each carrying
its file icon and its stage's name. Inspect and Snapshot leave the header in
Docs — they point at pixels that are not on screen — while Export stays,
because a render already running must not be hidden by looking at a document;
arming either and switching to Docs disarms it, down the same path a rebuild
takes. The preview iframe is hidden rather than unmounted, so coming back
costs neither a page load nor the frame you were on. In the Video dock, a
stage whose document is on disk becomes a button that opens it; a stage that
has written nothing stays a plain line.

The documents also moved: `src/videos/<slug>/docs/*.md`, inside the video
rather than at `video/*.md` in the project root. The old literal path was
shared by every video in a project, so a second video overwrote the first
one's script. `docsFolderOf(slug)` in `shared/pipeline.ts` is now the one
source for both the agent's brief and the viewer, and the stage templates
carry the folder as a token the turn's own slug fills in — outputs, discovery
and done-conditions alike. There are no users and no migration; documents
written under the old path have to be moved by hand.

Two sidecar methods carry it: `video.documents` lists a video's markdown with
its folder — a folder that does not exist yet answers with an empty list, not
an error — and `project.read` reads one file, resolving symlinks and `..` and
refusing anything outside the project, larger than a megabyte, or holding
bytes no text file holds. That containment is the permission gate's own check,
moved to `sidecar/contained.ts` so there is one implementation of it rather
than two. The list is re-read when a turn settles and the open document is
re-read when the agent writes to it, both off signals the webview already
receives; no watcher was added.
