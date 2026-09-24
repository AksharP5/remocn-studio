## Context

`thinking` events reach the webview in `hooks/use-turns.ts` with every other
agent event and are passed to `fold` (`shared/transcript.ts`), which ignores them.
That fold is the one both sides run; the sidecar's recorder writes its result to
history, so anything folded is persisted. Tool steps are `activity` entries with a
neutral verb, a name and an input; `lib/studio/activity.ts` already turns those
into a display name and target for `ActivityLine`.

## Goals / Non-Goals

**Goals:** reasoning visible live and never stored; one ordered stream of steps
and thoughts; no protocol or history change.

**Non-Goals:** reasoning for past turns; file chips.

## Decisions

### Live lines are turn state in the webview, beside the fold

`use-turns` keeps, per history id, a `live` list of `{ kind: "thought", text }`
and `{ kind: "step", entryId }` in arrival order: a `thinking` event appends to
the last thought (or opens one after a step), a `tool_use` pushes a step
reference. The list is reset when a turn starts and dropped when it settles; the
fold is untouched, so the recorder never sees reasoning. Folding reasoning into a
new transcript entry kind was rejected: it would persist it (the explicit
non-goal) and every provider's reasoning volume would land in SQLite.

### Lines are built by a pure function

`reasoningLines(live, entries, cwd, max)` (`lib/studio/reasoning.ts`) splits
thoughts into sentences (on `. ! ?` followed by space, and on newlines), keeps the
unfinished tail as the growing last line, turns a step into "<Verb-ing>
<target>" from its verb (read → Reading, edit → Editing, run → Running, …) and
`activityTarget`, falls back to the tool's display name, and returns the last
`max` lines with stable ids so the component can animate entries and exits.
TodoWrite-style `task` steps are left out: the checklist already shows them.

### Rendering

`ReasoningSteps` renders the existing `Thinking` marker with the `shimmer`
utility on its phrase, and a three-line window: `flex-col justify-end`, a top
mask gradient, lines entering from 6px below and leaving upward with Motion's
`AnimatePresence`, all turned off by `useReducedMotion`. The finished summary
reuses the current expand/collapse and step rows, labelled "Worked for
<duration>" from the turn's start and end when this session saw both, else
"Worked · N steps".

## Risks / Trade-offs

- [Claude's thinking can be long or arrive in large chunks] → only the last three
  sentences are ever on screen; the buffer is trimmed to its last few thousand
  characters.
- [A provider streams no reasoning] → the window shows steps only; nothing is
  missing that was there before.
- Failure direction: none new — reasoning never reaching the webview leaves the
  window with steps; nothing is reported.
