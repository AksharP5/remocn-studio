# Turns run in the provider, not in the pane

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`agent/turns`](../../openspec/specs/agent/turns/spec.md), [`composer/message-composition`](../../openspec/specs/composer/message-composition/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`hooks/use-turns.ts` holds a map keyed by that id: entries, the running `Fiber`,
the pending permission queue. Switching sessions is a read from another key, so
nothing is interrupted — where the chat pane used to be keyed on a token and a
remount *was* the cancel, cancellation is now `stopTurn`, said out loud.

- **The open session is a ref, not a prop.** `markOpen` tells the store which key
  is on screen; a turn that ends anywhere else sets `unread`, which the row shows
  as a dot until you open it. Status per row — running, waiting on a permission,
  failed — is derived from the same map by `statusOf`, and none of it is stored.
- **The pane's folder is the open session's project, not the selected one.**
  `openedProject` resolves it from the session's `projectId` and only falls back
  to the selection, because the selection is `null` until `project.list` answers
  and every path in the transcript then renders absolute. One project drives the
  title, the transcript's `cwd`, the permission card and the missing-folder
  banner, so they cannot disagree about which folder a turn ran in.
- **A permission belongs to its turn, not to the screen.** A background session
  that asks marks its row and keeps its own composer locked; the card is answered
  when you open that session. The gate denies anything unanswered for ten minutes,
  because with background turns "nobody is looking at this card" is the normal
  case and a held card holds a `claude` process open.
- **A single-select chip menu has to be told to close** (REM-326). Base UI's `Menu.Item` dismisses on
  click; its `RadioItem` and `CheckboxItem` default to `closeOnClick: false`, which is right for a
  checklist and wrong for every menu in the composer's toolbar. All of them are anchored *above* the
  composer and open upward over the textarea, so a menu that survived its own selection put a row
  under the next click — and the next click is almost always the text field. Measured: aiming at the
  textarea with the Effort menu open on Low chose *Extra high* instead, silently, with the chip
  collapsed to an icon at that pane width so nothing on screen said what the effort now was. Every
  `DropdownMenuRadioItem` in `components/studio/` carries `closeOnClick`; the default is not changed
  in `components/ui/dropdown-menu.tsx`, because a `shadcn add` re-add overwrites that file.
- **The composer's text is taken verbatim, and macOS does not do that by default** (REM-329). Text
  substitution turned `git status --short` into `git status —short` on the way to the agent, and the
  raw prompt is what `shared/transcript.ts` stores, so a reopened session shows the mangled text too
  — the damage outlives the turn. The same substitution ruins `"`, `'` and `...`, none of which then
  parse. `VERBATIM_INPUT` in `lib/studio/text-input.ts` is `autoCorrect`/`autoCapitalize` off, spread
  onto the composer, both *What should change?* fields, the props pane's Text area and the tuning
  text control — every field whose content the agent reads or that is written back into TSX.
  Spellcheck is deliberately left alone: it is a separate switch and nobody asked for it.
- **The mode chip reads the open turn, not a setting.** Model and Effort are
  app-wide and live in `settings.json`; the mode is per session and lives in the
  same map as everything else about a turn, which is why the composer takes it as a
  prop where the other two come from `useStudio()`. Persisting it needs both the
  turn map and the session list, so `useWorkspace` owns that seam — it is the only
  place that has both.
- **Quitting asks first.** The Rust core prevents both `CloseRequested` and
  `ExitRequested` and emits `app://quit-requested`; the webview answers by
  invoking `quit_studio` immediately when nothing is in flight, or after the
  confirmation when something is. The flag that lets the second attempt through
  lives in Rust, so `app.exit(0)` cannot deadlock against its own guard.
