## Why

Reported: in the Video dock the Review step never stops — its animation plays on
for good. The Review stage is closed only by the agent, with a design-check report
the studio revalidates, so after a turn ends it is often still the active stage:
the agent did not close it, or the report was refused. The dock drew the active
stage with the animated in-progress mark and read its present-continuous phrase
("Reviewing the result") whenever the pipeline was unfinished, whether a turn was
running or not. Between turns nothing is being reviewed, yet the dock said so and
animated it indefinitely. A plan task that a stopped turn left in progress did the
same, in the dock and in the transcript.

## What Changes

- The dock's in-progress marks animate only while the open chat's turn is running.
  Between turns the active stage keeps its mark, drawn still.
- Between turns the collapsed dock reads the active stage's title ("Review")
  rather than its present-continuous phrase, and a plan task left in progress by a
  stopped turn no longer names the dock.
- A plan checklist in the transcript animates only while a turn is running.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent/pipeline`: the Video dock's label and marks distinguish a running turn
  from the time between turns.

## Impact

`components/studio/task-dock.tsx`, `task-checklist.tsx`, `task-status-icon.tsx`,
`transcript.tsx`, `chat-pane.tsx` and `lib/studio/pipeline.ts`. No IPC, history or
sidecar change.
