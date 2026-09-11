# Settings is a page, not a dialog

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`shell/settings-page`](../../openspec/specs/shell/settings-page/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Settings takes the whole window: a rail on the left, one readable column on the right,
nothing floating and no dim behind it. It was a `Dialog` at `sm:max-w-2xl` × 480px until
Account grew a trial bar, two pricing cards and a device list, and a scrolling dialog was
hiding half of every section.

- **The shell stays mounted underneath, `inert`.** `SettingsPage` is a `fixed inset-0`
  layer over `ShellLayout`, which keeps its state — the preview's iframe, a running turn,
  the sidecar's channel — and takes no key and no focus while the page is up. A second
  Tauri window was the alternative and is the one this repo has already ruled out: a second
  `useTurns`, a second permission gate, a channel that belongs to one window.
- **`useSettingsView` is the old dialog hook under an honest name**, same API plus `close`,
  and every way in is unchanged — the gear, ⌘,, the sidebar's account row, the trial card's
  Upgrade, the model menu's *Sign in* into AI Accounts. Escape is the way back, and it
  yields to a menu or a popover that answered first (`defaultPrevented`).
- **No entrance animation on purpose.** It should feel like switching a tab, not opening a
  window. The rail keeps the pane's rules: no weight change between states, the open
  section on a muted background, and the drag region under the traffic lights is the
  rail's own top inset.
- **Every section is a column of groups, and every group is one shape.** `Group` in
  `settings-page.tsx` is a heading, one sentence under it, and the body, with the group's
  own action — Recheck, Check now — on its heading line; `Row` is a setting's name and
  sentence on the leading side and its control on the trailing side, top-aligned so a
  description that wraps never moves the switch. Groups are set apart by space alone
  (`gap-8`, twice the `gap-5` the rows inside keep) and no rules. Behavior is
  *Suggestions* and *Privacy*; Updates is *This build* (facts) and *Releases* (notes in a
  scrolling card, the install button); Feedback is *Email* and *What the email carries*,
  the same facts the email is filled with; AI Accounts is one *Providers* group whose rows
  are inset by their own padding so their text keeps the heading's edge. The sidebar's
  update popover keeps `UpdatesBody`, sized for a popover; the page draws its own.
- **In tests it is a region named Settings**, not a `dialog` role — `findByRole("region",
  { name: "Settings" })` is what `settings-page.test.tsx` and `trial-card.test.tsx` open.
