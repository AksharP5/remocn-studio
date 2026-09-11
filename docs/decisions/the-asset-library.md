# The asset library

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`library/asset-library`](../../openspec/specs/library/asset-library/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Save something once and reuse it in every other video: an image, a video, a sound, or a finished
Remotion component (REM-8). It is a drawer at the foot of the left pane, and its assets reach a turn as
`[Asset #N]` — the **third** reference kind, beside `[Image #N]` and `[Element #N]`.

- **A saved stock asset is named by what you searched for, not by its alt text**
  (REM-334). Pexels' alt is a sentence — and already cut mid-clause at the source — so
  every photo landed in the library as `Dynamic wa…`, `A serene vi…`, `Close up of…`: two
  columns in a 288px sidebar give a label about twelve characters, and the descriptive
  prefix alt text always opens with is exactly the part that does not tell one photo from
  another. `stockName` in `lib/studio/stock.ts` makes it `ocean — Magda Ehlers`, and it
  lives in the webview because that is where the query is — the sidecar's `StockItem`
  never carried one, and a name is a presentation decision, not a wire change. The alt
  text stays where prose belongs: on the search result you picked from.
- **The library is a folder, not a database.** `assets/<slug>/` plus a `manifest.json` under
  `app_data_dir/library`, which Rust resolves and hands over as `REMOCN_STUDIO_LIBRARY_DIR` exactly
  as it does the history's `REMOCN_STUDIO_DATA_DIR`. Listing is a folder scan with no index to keep
  in step, and previews load over the asset protocol for free. The Schema lives in
  `shared/library.ts` next to the IPC contract, because the webview reads a manifest's fields on the
  card and the sidecar writes them.
- **The slug is the folder and never moves.** Renaming rewrites `name` in the manifest, so a
  reference already in a composer, and a copy already in a project, cannot be orphaned by a rename.
  A second asset of the same name gets `-2`.
- **Insertion is a copy, made before the turn starts.** `agent.prompt` carries the picked assets
  positionally (`assets[i]` ↔ `[Asset #{i+1}]`, the same invariant `[Image #N]` has) and
  `placeAssets` copies them in: media to `public/library/`, a component to `src/library/<slug>/`,
  resolved against `remotionRootOf(cwd)` rather than the opened folder. Three things fall out of
  doing it here rather than letting the agent fetch them: **zero permission cards** — the library is
  outside `cwd`, so an agent `Read` there would raise one every time; **zero tokens** spent retyping
  code that already exists; and a byte-for-byte copy rather than a paraphrase.
- **It never overwrites**, the same rule the scaffold has: an existing file is skipped and the block
  says *already in the project, untouched*, so an edit the agent made in an earlier turn survives a
  second insertion. A fresh copy is something the user asks for in words.
- **The block is the only thing the agent is told.** `assetBrief` names what was copied, what was
  skipped, `staticFile("library/…")` for media, and — checked with the same `isInstalled` the
  environment checklist uses — which npm packages are missing, for the agent to `bun add` through
  the ordinary Bash card. Nothing is written to `package.json` behind the turn's back.
- **A deleted asset is a sentence, not a failure.** `placeAssets` answers with a placement whose
  `reason` says the asset is gone; the turn runs. A copy that genuinely fails becomes a `notice` and
  the turn still runs, because the words the person wrote are worth more than the attachment.
- **The agent saves components, the UI saves media** — the split is about who knows the boundaries.
  The agent wrote the code and knows the import graph, so it gathers the files, names them and calls
  `save_asset` on a second MCP server, `remocn-library` — served the same stdio way as
  `remocn-pipeline` (see *The agent seam*) — and auto-allowed by the same rule in `permission.ts`: the library is app data, and `save_asset`
  only ever reads from `cwd` and writes into the library. There is no file-tree picker, because the
  studio's user does not read code.
  - **Which is why the pane lists again when a turn settles.** A component reaches the library
    through the sidecar's own MCP tool, so nothing in the webview is on that path and a save landed
    on disk that the list — read once, at boot — could not know about; a component saved by the
    agent appeared only after a relaunch. `useLibrary` takes `hasRunningTurns` and refreshes on its
    falling edge, which is the only moment the library can have changed behind the pane's back. The
    refresh is **quiet**: it does not raise `isLoading`, or every turn would end in a flash of
    skeletons reporting nothing.
- **Files keep their shape relative to what they share.** `layoutOf` takes the common ancestor of
  the saved paths and stores names relative to it, so `Scene.tsx` + `lib/ease.ts` land under
  `src/library/<slug>/` with the relative import between them still correct. Flattening would break
  every component with a helper.
- **Dedupe is by content hash, and it remembers a "no".** Each manifest carries the sha256 of its
  files and `dismissed.json` carries the hashes of files the person declined, so `library.offer`
  answers with only what is worth asking about — a long session must not re-ask about the same
  picture every turn. Two identical files in one offer are one row.
- **The end-of-turn card does not lock the composer.** It is permission-card *styled* and
  attention-shaped, but a save is not a thing the turn is waiting on; striking a file out of it is a
  decline, and a save that fails leaves its file on the card rather than reporting success.
- **A preview is best-effort, exactly like the context reading.** `library.save` from the agent
  renders one frame through the existing `preview.still` machinery, using the composition and frame
  the pane says are on screen — which the turn carries as `playing`, because the sidecar has no
  other way to know what the person is looking at. A failure never fails the save: the card falls
  back to the type icon. A single-file image is its own preview and needs no render at all.
- **Asset references are not project-scoped**, which is the point of them, so — unlike element
  references — switching projects leaves them in the composer. Picking the same asset twice reuses
  the number it already has, so the list and the text cannot disagree and a row keeps its own key.
- **The library opens out of the sidebar's bottom edge, and is not a tab.** A segmented
  Projects | Assets switcher was the first version and it read as a foreign control: it sat between
  the wordmark and New Project, and three things then competed for the top of the pane. `AssetsDrawer`
  is instead one 36px strip pinned above the footer — icon, label, count, chevron — that opens
  upward into the grid, the same shape the plan drawer opens out of the composer. Closed, the pane
  looks exactly as it did before assets existed; open, the drawer is capped at three fifths of the
  height so the project list it slid over is still there.
- **The state is `assetsDrawer`, a boolean, remembered in `settings.json`.** It was `paneTab` with
  `"projects" | "assets"` while the switcher existed; keeping that name after the tabs went would
  have left the setting describing a control that is not there.
