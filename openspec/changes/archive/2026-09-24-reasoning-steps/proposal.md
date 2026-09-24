## Why

While a turn runs, the chat shows one marker line — the task's phrase and a
timer — and every tool call is hidden under a "Work details" chevron. The person
cannot see what the agent is doing without opening it, and the reasoning the
providers stream (Claude's thinking deltas, Codex's reasoning items, ACP
thoughts) is dropped on arrival. The reference is the Reasoning Steps component
at kobra.systems: a stage title with a moving highlight, the latest few thoughts
scrolling beneath it, and a "Thought for 7s" summary once done.

## What Changes

- While a turn runs, under the marker, a window of the latest three lines shows
  what the agent is doing: its tool steps as sentences ("Reading
  OrbitScene.tsx", "Running bun run check") and its reasoning as it streams, in
  arrival order. Older lines rise and fade out; the task phrase shimmers.
- Reasoning is shown live only: it is kept in memory for the running turn, never
  folded into the transcript or written to history, and gone when the turn ends.
- When the turn ends, the "Work details" row becomes "Worked for 2m 14s ⌄" (the
  duration when this session saw the turn start, a step count otherwise), which
  expands into the turn's steps as before.
- Reduced motion shows the same lines without the movement or the shimmer.

## Capabilities

### Modified Capabilities

- `agent/turns`: a running turn shows its latest steps and reasoning; a finished
  one summarises its work.

## Non-goals

- Keeping reasoning in history or showing it for past turns: it is the model's
  scratch work, can be long, and is not the person's.
- Chips for the files a turn touched.
- Changing how the steps are listed once expanded.

## Impact

- Webview only: `hooks/use-turns.ts` keeps the live reasoning per turn;
  `lib/studio/reasoning.ts` (new, pure) builds the lines; a new
  `components/studio/reasoning-steps.tsx` renders them; `transcript.tsx` swaps the
  marker and "Work details" for it.
- No IPC, sidecar, fold or history change: `thinking` events already reach the
  webview.
