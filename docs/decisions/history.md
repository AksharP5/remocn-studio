# History

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`history/transcript-store`](../../openspec/specs/history/transcript-store/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Chats and transcripts live in **our own SQLite**, opened by the sidecar with
`bun:sqlite` — not in the Claude Code transcript files, whose format is not a
public contract and would break the left pane on any CLI update. Only
`sdk_session_id` is kept, and only so the SDK can `resume`.

- **The sidecar owns it, because the sidecar is where the events are.** Writing
  from the webview would mean a Tauri IPC round trip per text delta; here it is
  a function call on the same object that just emitted the chunk. `bun:sqlite`
  also costs nothing to add — it is part of the runtime the sidecar already is,
  where `tauri-plugin-sql` would have pulled sqlx into the Rust build and put raw
  SQL in the webview. Accepted cost: the pane needs the sidecar up, which every
  other part of the app already does.
- **The database file is the core's decision, not the sidecar's.** Rust resolves
  `app_data_dir()`, creates it and passes it as `REMOCN_STUDIO_DATA_DIR`, next to
  `REMOCN_STUDIO_HOST_PID`. Run by hand without it, the sidecar falls back to a
  temp dir and says so on stderr.
- **A block is a transcript entry, and there is exactly one fold.**
  `shared/transcript.ts` holds `fold`; the webview runs it to render the live
  stream and `sidecar/history/recorder.ts` runs the *same* function to decide
  what to store. The recorder writes only the entries whose identity changed —
  `fold` is immutable, so that is at most one row per event. Two folds that had
  to agree would drift; this one cannot.
- **Grouping runs of activity is render-time, and lives nowhere near that fold.**
  `lib/studio/runs.ts` takes the entries and returns items that are either one
  entry or a run of consecutive tool calls; the pane folds a run of two or more
  into a single row showing the last of them and a `+N`, which expands into
  exactly the rows it replaced. Doing it in `shared/transcript.ts` instead would
  put presentation into SQLite and make the stored transcript lossy — and because
  the grouper is a pure function over the entries, a session loaded from history
  groups identically to one folded live.
- **The plan Claude writes is one checklist, derived the same way.** Claude Code
  plans with `TaskCreate`/`TaskUpdate`, not `TodoWrite`, and those calls used to
  render as a wall of wrench rows labelled with a truncated *description*.
  `lib/studio/tasks.ts` folds every task call of a turn into one checklist
  anchored at the first `TaskCreate`, which `lib/studio/runs.ts` emits in place of
  those entries before it groups the rest. Identity comes from the id in the
  create's `result` (`Task #1 created successfully: …`), with position among the
  creates as the fallback while the result is still in flight, since ids are
  assigned in order; an update naming an unknown id changes nothing rather than
  inventing a row. Because it is a pure function over the stored entries, a
  session reopened from SQLite renders the checklist the live turn showed, no
  `TranscriptEntry` variant was added and no migration was needed. A **failed**
  task call is not folded: it stays its own row with its error, as every failure
  does. **The task list belongs to the session, not the turn** — the tool numbers
  ids sequentially for the whole session and a plan written in one turn is
  routinely moved by updates in the next, so only where a plan is *anchored* is
  per turn: a later burst of creates opens its own checklist, in the order the
  conversation happened, while an update reaches its task wherever that task was
  written. Settling the list on every user message instead was the first version
  of this, and it cost every `TaskUpdate` of a second turn: the id matched
  nothing, so the call fell out of the checklist and drew a row saying "Updated
  task #6 description, status" while the plan above it stayed all-pending.
- **The plan also sits on top of the composer.** `TaskDock` is a section of the
  `DockStack` in the composer's own `max-w-2xl` column, collapsed to the task in
  hand — its `activeForm` — with the count on the right, and it opens *upwards*
  into the whole list. The stack has no bottom radius and no gap under it, so it
  abuts the composer and reads as a drawer behind it; overlapping the composer to
  get that effect is what the first two versions did, and each of them ended up
  putting an edge or a shadow of ours across the input. The queue is the stack's
  other section — see *The next message waits its turn*. It lived in the transcript's
  left gutter first, measured against the pane with a `ResizeObserver` and three
  visibility rules; sharing the composer's column deletes all of that — a pane
  resize reflows both together and there is nothing left to measure. Expanded or
  collapsed is `taskDock` in `settings.json`, so a plan left open comes back open.
  The checklist **stays in the transcript too**: there it is a record of what
  happened, and it is the only copy a session reopened from history can anchor in
  the right place.
- **A subject wraps; it never truncates.** A plan whose every row ends in an
  ellipsis is a plan you cannot read, and the block is free to grow downwards
  where it is not free to grow sideways — so rows wrap, the running one carries a
  surface, and the whole list scrolls with no fade over it. That is also why
  `PANEL_MIN` is a *readability* floor rather than exactly half of `PANEL_MAX`:
  below it a wrapped 14px line stops being worth reading, and the button says
  more than four clipped words would.
- **Depth is a token, not a border.** `--elevation-floating` in `app/globals.css`
  is a translucent ring plus ambient layers, so it composites over whatever of
  the transcript is behind it instead of being tuned to one background; the dark
  palette collapses it to a white ring with one wide ambient shadow, because a
  stacked shadow cannot be seen on a dark surface but this one floats over
  scrolling content. The shell's `rounded-xl` over `p-1.5` puts the rows'
  `rounded-lg` exactly a padding's width inside it, so the corner gap stays even.
- **Hiding is the user's, and it is remembered.** The panel's × folds it into the
  button, whose popover carries a pin to bring it back, and the choice is
  `taskDock` in `settings.json`. Hiding by hand can only ever *narrow* what the
  room allows, never widen it: with no room for the button either, there is
  nothing to hide and nothing to restore.
- **The pane's running row reads the same plan.** `rowOf` in `lib/studio/groups.ts`
  derives the open plan from the turn's entries with the same `currentTasks`, so
  `Running · 2m` becomes `Registering the scene · 1/3 · 2m` — the running task's
  `activeForm`, how many of the plan are done, and the elapsed time it already
  showed. It is derived **only while the turn runs**: a settled row stays one
  quiet line, and walking a finished session's entries on every minute tick would
  cost the whole pane something nobody is reading. The row is still one line; the
  checklist itself belongs to the transcript.
- **The thinking marker reads the running task's `activeForm`** — the
  present-continuous phrase the tool carries — falling back to its subject, and to
  "Thinking…" when nothing is in progress.
- **Every tool call folds, and only a failure breaks a run.** An earlier rule
  folded a named set of read-only tools and kept every command on screen. Two
  turns' worth of screenshots killed it: a real turn is walls of `Bash`, and the
  walls are as much `mkdir` and generator scripts as `ls` — a rule that spares
  mutations spares the wall. A failed call still stands alone, because its error
  text renders under the row and a count must never be the only trace of the one
  thing that went wrong. Showing the newest entry rather than a count is what
  makes the same row a live ticker while the turn runs.
- **A row leads with an icon for the kind of work, not a state dot.**
  `components/studio/activity-icon.tsx` maps tool → lucide icon through a `Map`
  (a `Record` would resolve `constructor` off `Object.prototype`), with a wrench
  for anything unknown. State went into the icon's colour, so a settled turn has
  no column of green and `running`/`failed` stay findable.
- **`id` is not stored.** The row is `(session_id, ordinal, kind, payload)` and
  the id is rebuilt on load as `block-<ordinal>`, so a session loaded from disk
  and a turn folded live can never collide on a React key.
- **A crash costs the in-flight block and nothing else.** Every event upserts its
  row as it arrives (`ON CONFLICT (session_id, ordinal)`), in WAL with
  `synchronous = NORMAL` — a force-quit cannot lose a committed row, and the next
  turn resumes numbering from `MAX(ordinal) + 1`.
- **History never fails a turn.** `recording()` swallows and logs every store
  error and hands back an inert recorder, the same way the context-window reading
  does; a database that cannot be opened at all yields `broken()`, whose methods
  all fail with the reason, so Claude still works and the pane says why it is
  empty. The `history.*` methods report their errors normally.
- **Migrations are `PRAGMA user_version`** against `MIGRATIONS` in
  `sidecar/history/migrations.ts` — one array entry per version, applied in one
  transaction. The schema *will* change; adding an entry is the whole ceremony. A
  step is a SQL string or a function over the driver, because migration 2 has to
  resolve symlinks and take a basename to turn every `session.folder` into a
  `project` row, and SQL can do neither. That migration rebuilds `session` around
  `project_id`, which is why `migrate` turns **foreign keys off** around its
  transaction: with them on, `DROP TABLE session` runs an implicit delete and the
  cascade takes every `block` with it. `PRAGMA foreign_key_check` before `COMMIT`
  is what proves it did not.
- **A folder is a row.** `project (id, path UNIQUE, name, …)` and `path` is
  canonical — `realpathSync` plus `resolve`, so the same folder opened twice,
  symlink or not, is one project rather than two histories. Sessions cascade from
  it and blocks from them, so removing a project is one `DELETE` and never touches
  the folder on disk. A project whose folder is gone keeps its row: `missing` is
  computed at read time with `existsSync`, and the sidecar refuses to start a turn
  in it rather than handing the SDK a `cwd` that is not there.
- **The mode is a column on the session** (migration 3, defaulting to `auto`, so
  every session that predates it comes back behaving exactly as it did). Two things
  write it: the turn itself, through `open`'s upsert, so the stored mode and the
  mode a turn ran under cannot drift; and `history.mode`, for a mode picked between
  turns that would otherwise be lost on quit. A draft session has no row yet and
  keeps its mode in the turns map, exactly as it keeps its SDK session id.
- **The store is written against a three-method `SqlDriver`**, and
  `sidecar/history/sqlite.ts` binds it to `bun:sqlite`. The tests take
  `driverFor(":memory:")` from that same file, so they exercise the real SQL
  on the real driver — they bound it to `node:sqlite` while the suite ran under
  Vitest's Node workers, which had no `bun:` loader.

The pane on top of it: projects ordered by their most recent session — that
*base* ordering is `project.list`'s `ORDER BY` — sessions newest first inside
each, expansion persisted in `settings.json`. A session row is created by
the first turn and arrives in the webview as the `history` chunk at the head of
that turn's stream, which is why the list can show a brand-new session without a
round trip and without racing the turn that created it. The id in that row is one
the *webview* minted and sent, so a turn has a key from the moment it starts
rather than from the moment the sidecar answers.
