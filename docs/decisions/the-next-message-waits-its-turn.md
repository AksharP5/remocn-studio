# The next message waits its turn

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`composer/message-composition`](../../openspec/specs/composer/message-composition/spec.md), [`agent/turns`](../../openspec/specs/agent/turns/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Send during a running turn queues the message instead of dropping it, and the
queue is a field on `TurnState` like everything else about a turn — so it belongs
to the session, dispatches while you are looking somewhere else, and is gone on
relaunch. The sidecar and `shared/ipc.ts` are untouched: a queued message becomes
an ordinary `agent.prompt` when its turn comes.

- **This started as a silent data loss.** The textarea was never disabled on
  `isRunning`, so you could type — and Enter then cleared the field and every
  attachment list while `sendTurn` dropped the call on its `fibers.current.has`
  guard. `onSubmit` answers with a boolean now and `submit` clears only on a
  `true`, which also covers the other refusal (no project open) rather than only
  the one this feature added.
- **One fiber per session is the constraint, not a limitation to route around.**
  Two prompts on one `sdkSessionId` would fork two CLI processes against one SDK
  session and take `nextOrdinal` twice, so serialising is the design and the
  queue is what makes waiting visible. Streaming into the live turn through the
  SDK's already-open input generator is the v2 branch, and a different contract.
- **A queued message is captured whole, at the moment it was written** — text,
  attachments, elements, assets, media, *and* the model, effort, frame and
  project the composer was set to. Only the **mode** and the **provider** are re-read at
  dispatch, from the turn that just ended — the mode because approving a plan
  mid-turn changes the mode the session is in and the follow-up belongs in that
  one, the provider because it is a property of the session, not of the message. Capturing the frame at
  enqueue is the point of doing it this way round: "make this bit slower" means
  the frame you were looking at when you wrote it, not the one on screen three
  minutes later.
- **Dispatch is decided outside the state updater.** `nextQueued` is pure and is
  called on the pre-settle snapshot; the updater only drops the head it names.
  Reading the head *inside* the updater would send twice under StrictMode, which
  double-invokes updaters in dev.
- **Three things hold the queue where it is**, all of them "not what the person
  meant": a turn stopped by hand (a deliberate cancel, which reaches `onExit` as
  an interrupt), a turn that failed, and a permission still unanswered. The last
  one is `nextQueued`'s only reason to read `permissions`, since the settled state
  has none by then.
- **Recursion goes through a ref.** The `onExit` that dispatches lives inside the
  function it calls, so `launcher.current = launch` — the same shape `useComposer`
  uses to read the live text — keeps `sendTurn` a plain "start or enqueue" and the
  chaining out of it.
- **The queue is the second drawer, and it shares the plan's chrome.**
  `DockStack` in `components/studio/dock.tsx` is the geometry both use — the
  `max-w-2xl` column, the `px-3` inset that makes a strip narrower than the
  composer, `bg-card`, and the top radius; `DockSection` is one line of it, with
  the disclosure and the count. Rows under the composer were the first version and
  they grew the input downwards one line per message, which is the thing a queue
  must not do: collapsed, this is one line whatever is in it. The radius belongs to
  the *stack* rather than to each section, or two open drawers would leave a notch
  where their corners meet, and `empty:hidden` is what keeps the wrapper from
  painting a strip when neither has anything to say.
- **The plan is above the queue, and the queue is against the composer**, because
  the queue is the composer's own outbox: a message you just queued has to land
  where you were typing. The plan is context and moves up a line to make room.
- **A queued row wraps, exactly as a plan row does.** Collapsed, the strip
  truncates the message that goes out next; open, the rows wrap — a queue you
  cannot read is not a queue you can edit. `useQueue` is the only place the turn
  map and the composer meet: clicking a row drops it from the queue and restores it
  whole, which needs the composer's stores to take items back, so `restore` exists
  on each of them. Editing needs an empty composer and the row's title says so —
  overwriting a draft to recover an older one is a trade nobody asked for.
- **The queue's open state is not remembered, where the plan's is.** `taskDock`
  lives in `settings.json` because a plan outlives the turn that wrote it; a queue
  drains as its turns settle, so it is `useDisclosure` and starts collapsed.
- **A restored selection comes back without its rectangle.** The queue carries
  `PromptElement`, which is what the turn sends; the marker geometry is inspect's
  and is drawn only for selections made in the armed session, so a zero rect draws
  nothing rather than drawing a box over a frame that has since rebuilt.
- **Element references are not dropped on a project change here**, unlike in the
  composer: every queued message carries the project it was written in and is
  dispatched into that project's session, so its `[Element #N]` can never point
  somewhere the message is not going.
