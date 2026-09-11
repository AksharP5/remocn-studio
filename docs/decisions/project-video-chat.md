# Project → video → chat

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`projects/project-lifecycle`](../../openspec/specs/projects/project-lifecycle/spec.md), [`projects/videos`](../../openspec/specs/projects/videos/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


A project holds several **videos**, and a video holds several **chats**. On screen the
project is a switcher in the pane's header and the pane's body is videos with their chats
under them; the words are "Project", "Video" and "Chat", and "composition" never appears
in the UI. The invariant that makes all of it hold: **the open chat determines
everything** — the composition the preview plays, the folder in the conventions, the
target of an export, the project for inspect and snapshot. Clicking a video opens its most
recent chat; a chevron **with its own hit area** expands the list. There is no such thing
as a selected video with no chat open, which is what kills the old divergence between
"the preview follows the selected project" and "the chat follows the open session's
project" — and with it the `openedProjectId !== previewProjectId` checks that used to
guard inspect and the environment checklist.

That was documented and not built (REM-323): the row's whole button was wired to expansion
and nothing anywhere opened a chat, so row and chevron were the same click and a video
could sit expanded and highlighted while an unrelated chat drove the preview, the
conventions and Export — exactly the divergence the invariant exists to prevent. `newestChat`
reads the **store's** order, newest first, not the pane's: attention promotion in
`paneGroups` is a reading order and must not decide what a click opens. A video with no
chats yet only expands, because there is nothing to open.

- **Switching projects opens that project's most recent chat** (REM-337). File → ‹project›
  was the one way to change project without opening a chat, and it moved the video list and
  the preview while the chat pane stayed on the project that was open before — two projects
  on screen at once, with Export bound to the preview: Inspect and Snapshot refused with
  *the preview is showing a different project than this session* and Export stayed enabled,
  ready to render the other project's video into its `out/`. `selectProject` in
  `useWorkspace` now goes through `newestChatIn` and `openSession`, the same path a video
  row takes; a project with no chats yet opens with an empty composer. Export carries the
  same refusal as the other two, so the three buttons on one preview can no longer disagree.
- **Two sources of truth, with different jobs: SQLite draws, the bundle corrects.** The
  pane renders `video` rows the instant a project is opened; ~7 s later the compiled
  bundle names its compositions and `video.reconcile` settles the difference — a
  composition with no row becomes one (which is what makes a foreign project with forty
  compositions usable the moment it opens, and #218's "open any folder" survive), a row
  the bundle does not name is marked `missing` and keeps its chats under *Not in the
  code*, and a video the person deleted is **never** resurrected. Nothing is ever deleted
  by a reconcile. Neither source works alone: SQLite cannot know what the agent wrote, and
  the bundle cannot answer for seven seconds.
- **Deleting is soft, and writes nothing into the project.** `deleted_at` on the row —
  no folder is removed, no marker file lands in the person's tree. That is also what
  stops the reconcile above bringing it straight back, and it makes Undo a matter of
  clearing a mark rather than racing a timer: the toast is a convenience, and restoring
  works a week later. The costs are named on the confirm dialog and accepted: the folder
  stays on disk, keeps costing build time, and a new video of the same name gets
  `<slug>-2` beside the orphan. Actually deleting the files is a sentence in a chat, which
  the agent carries out through the ordinary permission card.
- **The slug is minted once and never moves; the name is a row and renames freely.**
  `shared/slug.ts` transliterates (so «Интро» is `intro`, not the fallback), lifts
  accents rather than dropping the letter (so «Éclair» is `eclair`, not `clair`, and
  «Été» is `ete` rather than `t` — REM-316; the letters that do not decompose, ß ø ł
  đ æ œ, have rows of their own), kebabs, and
  suffixes past anything taken — both the rows *and* the folders on disk, because a
  project opened from someone else's tree can hold a `src/videos` nobody recorded. Slug is
  the composition id, the folder name and the `?composition=` value; renaming touches none
  of them, which is the whole reason they are two fields.
- **Creating a project and creating its first video are one gesture.** The wizard keeps
  its three fields — name, location, aspect ratio — and the ratio belongs to the *first
  video*, which takes the project's name. "New Video" is the same wizard minus the folder
  field, and it exists only from the second video on. "New chat" is one click on a video's
  row. The ratio is written into that video's `meta` at creation and never rewritten by
  us: the agent owns that file from the next turn on, so a later change is words in a
  chat, not a regex over a live file. That is what `sized()` in `sidecar/scaffold/template.ts`
  now targets — the video module, not `Root.tsx`.
- **One turn at a time is per video, not per chat.** Two chats under one video would be
  two agents rewriting one folder, so the composer's existing queue keys on the video: a
  send while a sibling chat is running enqueues, and the turn that ends hands the baton on
  — its own queue first, then the longest-waiting sibling (`waitingSibling` in
  `lib/studio/turns.ts`). Different videos stay fully parallel, which is the point of all
  of this.
- **`paneGroups` moved down a level and changed nothing else.** Group is a video, row is a
  chat; attention promotion, the worst-of rollup and the cap on eight quiet rows are
  untouched, and `paneSections` now splits on `video.missing` instead of
  `project.missing`. The base order is the same `ORDER BY COALESCE(...)` the projects had
  — newest chat first, videos with no chats by creation — with `rowid DESC` as the
  tiebreak so a video created seconds ago still leads.
- **There is no migration.** There are no users, so migration 6 drops the chats and their
  blocks rather than inventing a video for each of them: `video_id` is `NOT NULL`, a chat
  without a video cannot exist, and SQLite will not `ADD COLUMN … NOT NULL` anyway. The
  projects survive, and their videos come back on the first reconcile.
## Registering a video without touching `Root.tsx`

A video is a folder under `src/videos/`, and something has to turn that folder into a
`<Composition>`. The scan that does it lives in **`src/videos/registry.tsx`**, a file the
studio writes and owns, and it is spliced into the project at the **entry point** rather
than in `Root.tsx`:

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";
import { withVideos } from "./videos/registry";   // ← added

registerRoot(withVideos(Root));                    // ← rewritten
```

- **The entry point is the seam, because `Root.tsx` is the person's file.** #218 opens any
  folder, so most projects arrive with a `Root.tsx` full of their own compositions and no
  scan; rewriting *that* means an AST edit on arbitrary code whose shape is unknown, and a
  half-understood edit there breaks every composition in the project, not only ours. The
  entry is three lines of a shape every Remotion project shares. `ensureRegistry` in
  `sidecar/scaffold/registry.ts` matches `registerRoot(<identifier>)` and inserts one
  import; **anything else is refused by name**, never rewritten on a guess.
- **One mechanism for both worlds.** The template ships an entry already written that way,
  so `ensureRegistry` is idempotent there — it finds its own import and does nothing. New
  project, opened folder: same code path, and `Root.tsx` is never written to in either.
- **`registry.tsx` is not in the copied tree.** It sits at the *template root*, skipped by
  `expandTemplate` along with `video-template/`, and is placed into `src/videos/` by
  `ensureRegistry` — which is what lets it also reach a project the studio never
  scaffolded. It is never overwritten.
- **The cast around `require.context` earns its place.** webpack has to see that call
  literally, and the file is written into projects whose types we do not control, so it
  reads `require` through an inline cast rather than shipping an ambient `declare const
  require` that would clash with `@types/node`.
- **Who runs it, and when.** `project.scaffold` and `video.create` run it — both are
  moments the person asked for a video, so the write is authorized. Nothing else does:
  a reconcile never writes into the project, even when it can see a folder nothing
  renders. For a video created before its project could register one, the repair is a
  button — *Register in this project* on that video's menu, offered only while it is
  `missing` — and `video.register` is the only path that writes into a project the studio
  did not scaffold without a new video being made.

- **Not done, and deliberately:** a window per project. It buys the same pane the switcher
  buys and costs a second `useTurns`, a second permission gate, a channel that belongs to
  one window, and a rewritten quit guard and updater. If "two videos side by side on one
  screen" ever becomes a requirement it is its own piece of work, not a detail of this one.
