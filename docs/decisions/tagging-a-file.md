# Tagging a file

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`composer/file-mentions`](../../openspec/specs/composer/file-mentions/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`@` in the composer opens a list of the project's files; picking one writes its path in backticks
into the sentence being typed (REM-249). A query beginning `/` or `~` browses the whole filesystem
instead.

- **A tagged file is plain text, and that is the design.** A fourth reference kind beside
  `[Image #N]`, `[Element #N]` and `[Asset #N]` would need a field on the stored `TranscriptEntry`
  and a change in the recorder — the argument that already sank `[Media #N]` — and it would buy
  nothing, because a file needs neither a splice nor a trailer: **the path is the whole payload**.
  So `shared/references.ts`, `shared/transcript.ts`, the history store and `content.ts` are all
  untouched, and a reopened session renders what was sent because nothing about sending changed.
- **Reading the file costs nothing to arrange.** The agent's `cwd` *is* the project, and every path
  inside it is auto-allowed by the gate, so a relative path raises no card and nothing has to be
  resolved or attached on our side. A path outside the folder goes through the ordinary Allow/Deny
  card — that is the #223 invariant working, not a gap.
- **Two methods, because they are cached by different keys.** `project.files` walks the project once
  per project and the webview filters the result on every keystroke; `files.list` reads one folder
  and is cached per folder. Folding both into one "suggest" method would put an IPC round trip on
  every keystroke and make the list's responsiveness the sidecar's problem. `~` is expanded in the
  sidecar, because the webview has no home directory to expand it against.
- **The walk skips what a person would never tag** — `node_modules`, `out`, `dist`, `build`,
  `coverage`, `target`, `tmp`, and every dot entry — and stops at 4000 files, reporting `truncated`
  rather than trimming in silence. Reaching what it skipped is what typing an absolute path is for.
- **The composer owns the text, so it owns the mention**, exactly as it owns the references:
  `useMentions` holds the candidates, the query and the highlighted row and decides nothing about
  the text, while `useComposer` runs `insertMention` / `openFolder` against the live field. Its
  `onKeyDown` is consulted **first** and answers whether it took the key, so Escape closes the list
  instead of clearing the composer and Enter picks a file instead of sending the message — and when
  nothing matched, Enter falls straight through and sends, because a list with no rows must not
  swallow a keystroke.
- **Drilling into a folder does not wait for a round trip.** `choose` knows exactly what the text
  will become — `@` plus the folder plus a slash — so it sets its own query at the same moment it
  asks the composer to write it, rather than waiting for a `sync` that a programmatic `setValue`
  never fires.
- **A space ends a mention, unless the path is absolute.** `~/My Movies/` is a folder people really
  have, and the drill-down produces exactly that text; a relative query keeps the Claude Code rule
  that a space is the end of the token.
- **Escape is remembered per token.** The dismissed `@`'s offset is kept, so typing on into the same
  word does not bring the list back — while a different `@`, or moving away and starting another,
  opens it as usual.
- **A row leads with the mark of what the file *is*.** `lib/studio/file-icons.ts` maps a name to a
  kind and `components/studio/file-icon.tsx` maps that kind to a glyph — the same two-step
  `activity-icon.tsx` uses, and for the same reason it uses a `Map` rather than a `Record`: the key
  comes from a filename, so `constructor.js` would otherwise resolve off `Object.prototype`.
  Brand marks come from **Simple Icons** (`@icons-pack/react-simple-icons`) — React on a `.tsx`,
  TypeScript, JSON, Markdown, CSS — and everything with no brand to speak of falls to lucide's
  `File*` family by category: image, video, audio, font, archive, text.
  - **Imported one file at a time**, `@icons-pack/react-simple-icons/icons/SiReact`, never from the
    package root: that barrel re-exports 10,359 icons and there is no reason to hand it to the
    bundler and hope. Measured on a *clean* `out/`, sixteen brand marks cost **26 KB**.
    Measure it that way or not at all — chunk filenames carry a content hash, so a stale `out/`
    keeps every previous build's chunks and reads as a megabyte of growth that never happened.
  - **They are monochrome by construction.** Each component defaults to `color="currentColor"` and
    only paints its brand colour when asked with `color="default"`, so the column inherits
    `text-muted-foreground` like every other icon in the app. The marks are *filled* where lucide's
    are 1.5px outlines, which reads heavier at the same box — `scale-90` on the branded ones is
    what evens the two out.
  - Each Simple Icon renders a `<title>`, so the glyph is `aria-hidden`: the row's own text is what
    a screen reader should read, not "React Intro.tsx src/scenes".
- **The list scrolls to the row the keyboard is on**, which it has to: twelve rows do not fit in
  `max-h-64` and the arrows used to walk the highlight straight out of the visible part.
  `useKeptInView` is a layout effect on the row itself with `block: "nearest"`, so a row already in
  view costs nothing. Its trigger is `${keyed}:${index}` rather than the active index alone, and
  both halves earn their place: `keyed` counts *arrow presses*, so a row that is merely re-rendered
  is not dragged back into view, and `index` catches the case `keyed` cannot — a filter that keeps
  the highlighted row but moves it, where the row is the same component instance and nothing else
  would change. Hovering can only ever re-scroll a row the cursor is already on, which `nearest`
  makes a no-op.
- **The path is coloured, and colouring it costs nothing extra.** `MessageText` already draws both
  the composer's overlay and the user's bubble, so splitting its *text* segments once more — into
  plain runs and backticked paths — lights the mention in both places and in history, where the
  stored prompt is the same string. It is deliberately **not** a segment kind in
  `shared/references.ts`: `dropReference` walks those segments and treats anything that is not
  `text` as a reference to renumber, so a fourth kind there would make a typed path behave like an
  attachment. Splitting inside the renderer keeps that fold untouched.
- **A chip, and one that costs no layout.** `.file-mention` in `app/globals.css` is a background, a
  radius and a shadow — nothing that takes width. The overlay's own metrics are what position the
  caret in the textarea beneath it, so padding, a border, tracking or a weight would drift the two
  apart a character at a time; that is the accumulating error `font-medium` on a reference already
  cost once. The side air is therefore an **offset** shadow rather than a spread one: a spread would
  grow the chip vertically too, and a path that wraps — the normal case for an absolute one — would
  stack its lines' alpha where they met. `box-decoration-break: clone` is what gives each wrapped
  fragment its own rounded chip instead of one box torn across three lines.
- **The chip is `currentColor`, so one rule serves both surfaces.** It is drawn over the composer,
  where the text is `foreground`, and inside the sent bubble, which is `bg-primary` with
  `text-primary-foreground`. A fixed tint had to read on both: `--reference` teal was the first
  version and it was legible on neither. A mix of the *inherited* colour is right on each by
  construction, which is also why a file mention no longer speaks the reference colour that
  `[Image #N]` does — the two now differ in kind, a chip against a coloured word.
- **Only a path lights up, not every code span.** A backticked run counts when it holds a `/` or is
  a bare name with a real extension, so `` `src/Root.tsx` ``, `` `~/My Movies/clip.mp4` `` and
  `` `package.json` `` colour while `` `Main` `` and `` `TransitionSeries` `` — the words the
  conventions themselves put in backticks — stay plain.
- **Both pure halves are tested without rendering anything**: `lib/studio/mentions.ts` (what counts
  as a mention, where a folder query splits, the ranking, what is a path) and `sidecar/files.ts`
  (what the walk skips, the limit, `~` expansion) — and the wiring is tested through `useComposer`
  against a fake IPC, which is the only place the two meet.
