# Tips, not a tour

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`shell/tips`](../../openspec/specs/shell/tips/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


The features nobody finds on their own — Inspect, Snapshot, `[Image #N]` on ⌘V, the
asset library, the plan drawer, turns that keep running while you look elsewhere — each
get one anchored card, the first time they are genuinely usable (REM-253).

- **A tip appears when its feature does, not on first launch.** A ten-step tour at
  startup is a wall that gets closed unread, and half its steps would point at controls
  that are not on screen yet: Inspect is off until the preview has compiled, the plan
  drawer does not exist until the agent writes a plan. `isAvailable` in
  `lib/studio/tours.ts` is the whole rule, and it is also what guarantees the anchor
  exists — a tip is offered only while the thing it points at is on screen.
- **The catalog is data.** One entry per tip — id, title, body, which side of its anchor
  it sits on — and a pure `nextTip` over the states the studio already keeps
  (`TourStage`). So "what can be shown, and when" is a table test rather than a walk
  through the running app, and the components decide nothing.
- **One at a time, by construction.** `nextTip` answers with a single entry, so there is
  no queue to drain and nothing that can put two cards on screen at once. Catalog order
  is the priority when several features become available together.
- **Nothing competes with something already asking.** A permission card, a wizard, the
  environment checklist, the Settings page: `isBlocked` withholds every tip while one
  of those is up. Availability alone is not enough either — a tip waits out a two-second
  dwell first, so a pane opened on the way somewhere else never flashes a card.
- **The anchor is named by the tip.** The element carries `data-tour="<id>"` and
  `tourAnchor(id)` is the selector, so the card and the thing it points at cannot drift
  apart; an anchor that is not on the page shows nothing rather than floating a card in
  the middle of the window. It is a Base UI popover positioned against that element —
  **no tour library**: driver.js and joyride bring their own overlay and their own
  styles, and an overlay over three resizable panes is exactly what this must not be.
- **"Got it" is remembered, clicking away is not.** `toursSeen` in `settings.json` holds
  the answered ids; an outside press or Escape drops the tip for this launch only and
  writes nothing, which is the forgiving direction. Settings → Behavior carries *Replay
  tips*, which is that list going empty.
- **"Show me" only reveals, never arms.** The library tip opens the Assets view, because
  that is one click the person could make themselves and undo the same way. Arming
  Inspect from a tip is deliberately not offered: a card that explains a mode must not
  put the app into it. The plan tip has no action at all — the strip it points at is the
  click it is teaching.
- **First-run prerequisites are not this.** Whether the app can work — a login, a
  runtime — is REM-10 and the environment checklist. The tips are about what the studio
  can do, and they start only once a project is open.
