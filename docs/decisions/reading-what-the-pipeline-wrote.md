# Reading what the pipeline wrote

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`agent/pipeline`](../../openspec/specs/agent/pipeline/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The first four stages of the production pipeline produce only documents, and until now
the right pane showed a template composition — an empty frame — while the thing the person
was asked to read and correct sat on disk with no window (REM-311). The pane's title is a
**Preview | Docs** switch now, and Docs is where a stage's result is read.

- **The documents live inside the video**, at `src/videos/<slug>/docs/*.md`: everything about
  a video in its folder, so deleting the folder takes the documents with it, and webpack does
  not touch `.md`. The literal `video/analysis.md` the templates used to carry was relative to
  the *project* root and therefore shared by every video in it — a project's second video
  overwrote the first one's script. `docsFolderOf(slug)` in `shared/pipeline.ts` is the one
  source for both halves, and the templates carry `{docs}` and `{video}` as tokens that
  `resolveStage` fills in from the slug the handler already knows — outputs, discovery and
  done-conditions alike, so the prompt and the viewer cannot name different files. There are no
  users, so there is no migration: a document written under the old path is moved by hand.
- **The tabs are derived from `outputs`, not listed beside them.** `stageDocuments()` reads the
  markdown each stage declares, so a stage that gains or renames a document cannot leave the
  strip naming a file nothing writes. Order is the pipeline's, then everything else in the
  folder by name; a stage that has written nothing is not a tab, because the strip shows what
  is on disk rather than what is promised.
- **Two methods, and the read is a gate.** `video.documents` lists a video's markdown with the
  folder it would be written to — a folder that does not exist yet is an empty list and not an
  error, because "the pipeline has not run" is the ordinary state of a new video. `project.read`
  resolves symlinks and `..` and refuses anything outside the project, over a megabyte, or
  holding a NUL. That containment *is* the permission gate's, moved into `sidecar/contained.ts`
  so `sidecar/claude/permission.ts` and the reader share one implementation rather than two that
  would drift. The NUL check is content rather than extension, which is what makes the size cap
  the second line of defence instead of the only one.
- **No watcher.** The list is re-read on the falling edge of `hasRunningTurns`, exactly as
  `useLibrary` re-reads the library, and the open document is re-read when a `tool_use` with
  verb `create`/`edit` mentions its path — both signals the webview already receives, so the
  cost is a function call rather than a file-system subscription. `touches` searches the tool's
  whole input rather than guessing which field a given provider spells the path in.
- **The mode and the open tab are per video and live in memory**, not in `settings.json`:
  moving to another video and back lands on the tab that was open, and a relaunch starts on the
  preview. A tab the folder no longer holds falls back to the first one, so the strip never
  stands over nothing.
- **Inspect and Snapshot leave the header in Docs; Export stays.** The first two point at pixels
  that are not on screen; a render already running must not be hidden by looking at a document.
  Arming either and then switching disarms it down the path a rebuild already takes —
  `unavailableOf` gains a reason, and the effect that watches it was already there.
- **The preview is hidden, never unmounted.** Taking the iframe down would cost a page load and
  the frame the person was looking at, every time they read a document.
- **The strip is our own component, on the Base UI primitive.** `components/ui/tabs.tsx` is a
  `shadcn add` target and a segmented control besides; this is a file manager's band, so the
  open tab wears the document's own background and breaks the rule under the strip — which is
  why that rule is a filler element rather than a border on the strip itself. Activity is
  `data-active`, the indicator is unused (it slides between pills, and there are no pills), and
  the strip takes a wheel sideways through `useWheelScroll`, because six tabs do not fit a 360px
  pane and there is no scrollbar to grab. Base UI's composite gives the roving tab order; its
  arrow-key movement cannot be exercised under happy-dom, so the tests pin what can be — one Tab
  stop, on the open tab — rather than asserting movement they do not actually drive.
- **The stage row in the Video dock is the way in.** A stage whose output exists on disk becomes
  a button that switches the pane and opens the file; one that has written nothing stays a plain
  line rather than a dead button. It is the only place most people will meet the Docs pane.
- **Markdown is rendered with its animation off.** A file read off disk arrives whole, so
  revealing it word by word would be an animation of nothing happening; the transcript keeps
  the reveal.
- **Not done, deliberately:** editing between turns. During a turn the file belongs to the agent
  and writing from both sides is a race, so it needs the field locked while the video's turn
  runs and a `project.write` that refuses when `modifiedAt` moved since the read. Images in
  `brand.md` also still need `convertFileSrc` against the document's folder. Rejected: a fourth
  panel (the props pane is 340px on purpose and a document wants 600+), a Files view in the
  sidebar (18rem, and a file tree is the code editor this product walked away from), and a card
  in the transcript (that records an event; a document changes afterwards).
