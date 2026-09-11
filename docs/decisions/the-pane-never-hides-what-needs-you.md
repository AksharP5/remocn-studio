# The pane never hides what needs you

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`history/chat-pane`](../../openspec/specs/history/chat-pane/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


`paneGroups` in `lib/studio/groups.ts` is one pure function over the projects, the
sessions and the turn map, and it decides everything the pane's honesty rests on:
grouping, ordering, the collapsed rollup, and which rows the cap may hide.
Components render its output and decide nothing, which is why the rules are pinned
by tests that render nothing.

- **Attention beats recency, but only where it exists.** Inside a group: waiting
  first, longest wait leading, then running, then everything else in the order the
  store gave. Across groups: the store's order is the base and a group holding a
  waiting session is promoted above the rest, keeping the base order within each
  half. That promotion is the one piece of ordering the *webview* owns, and it has
  to be — turn state exists nowhere else. With an empty turn map the output is
  byte-for-byte the store's order.
- **A folder that is gone leaves the list.** `paneSections` splits `paneGroups`'
  output into the projects still on disk and the ones that are not, and the pane
  renders the second half under a *Moved or deleted* heading. It partitions
  *after* the promotion above, so filtering preserves relative order and
  promotion becomes per-section for free — a missing project with a waiting
  session rises within its own half and can never outrank a live one. Splitting
  is all it does: a moved project keeps its sessions, its rollup and its
  transcripts, because the history is still worth reading and `Locate…` still
  reconnects it. The heading is a plain `<h3>`, not `SidebarGroupLabel` with a
  `render` prop: `useHeadingContent` cannot see children through `useRender`'s
  indirection and fails the check, and the primitive's own behaviour is all
  `collapsible=icon` handling that a `collapsible="none"` sidebar never uses.
- **The cap counts only quiet rows.** Waiting, running and unread rows render
  regardless and are excluded from the "Show N more" count, so the number always
  matches what expanding reveals and the cap can only ever hide what you have
  already seen and settled.
- **The rollup is worst-of**, waiting > running > failed > unread, on the project
  row while the group is collapsed, and waiting carries its count.
- **Timestamps are webview-only.** `TurnState` gains a `startedAt` when a turn
  begins and each pending ask an `askedAt` when its event arrives — no IPC, schema
  or sidecar change, because the webview already receives both moments. One
  minute-interval tick (`useNow`, a fiber, not a bare `setInterval`) drives every
  label in the pane, and the pure layer takes `now` as an argument so tests pass a
  fixed one instead of faking clocks.
  - **The thinking marker reads the same `startedAt`, a second at a time.**
    `runningTime` is the ticker's formatter — seconds, then `2m 5s`, then
    *`elapsedTime` itself* past an hour, so the long tail is written once and the
    two panes cannot drift. The chat pane owns that clock and passes `now` down;
    the marker formats and decides nothing. The redundancy with `Running · 2m` is
    deliberate — one origin instant, a resolution per pane, chosen by how many
    rows are on screen at once. `useNow` takes `null` for "do not tick", and the
    pane passes an interval only while its turn runs: without it an idle window
    repaints the conversation once a second for a desktop app's whole lifetime.
    `Effect.repeat` runs its effect once before the schedule, so resuming the tick
    refreshes `now` rather than measuring the turn against a timestamp frozen when
    the pane mounted. The number is muted, `tabular-nums` and outside the shimmer,
    and carries no live region or status role: a screen reader must never be
    handed something that changes every second.
- **The active row carries the emphasis; the inactive ones carry none** (REM-335). An
  inactive title was `text-sidebar-foreground/65`, and that token is *itself* a 64% mix
  toward the ground — so the fade compounded to about 42% of the way from the background
  to the ink: **2.5 : 1 in light, 3.8 : 1 in dark**, both under AA's 4.5 : 1 for 14px text,
  and both *behind* the timestamp sitting beside them. The row you scan the list for was
  the faintest thing in it, and the hierarchy was inverted as well as under-contrast. It is
  `text-muted-foreground` now, which the timestamp already uses; the row's own background
  is what separates the active one. Anywhere else a token that is already a mix is faded
  again will compound the same way — a sweep worth doing, not done here.
- **Rows are adaptive.** Settled is one line — title left, relative time right.
  Waiting, running and failed take a second line: `Waiting 4m · Bash`,
  `Running · 2m`, or the first line of the error. The waiting timer counts *up*
  and never toward the gate's ten-minute auto-deny: if that window changes the
  pane needs no change, because it displays elapsed and not remaining.
- **Hovering hides nothing.** The status marker leads the row and the delete
  button has its own slot, where the marker used to fade out to make room for it —
  aiming at a session used to cost you the thing you were checking.
- **Deleting forgives.** The row leaves the list at once, but `history.remove` is
  held behind an undo window — `Effect.sleep` in a forked fiber — and the toast's
  Undo is a fiber interrupt that puts the row back at its old index, selection
  included. The window is a parameter with a default so tests shrink it. Quitting
  inside the window drops the delete rather than rushing it: the session comes back
  next launch, which is the failure direction that keeps data. A busy session still
  refuses to be deleted at all.
