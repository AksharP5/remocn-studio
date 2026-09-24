## 1. Live state

- [x] 1.1 Keep the live stream (thoughts and step references, arrival order) per turn in `hooks/use-turns.ts`, reset on start and dropped on settle, and the last turn's duration; verify in the use-turns tests that `thinking` never reaches `entries`.

## 2. Lines

- [x] 2.1 Add `lib/studio/reasoning.ts` (`reasoningLines`, `workedLabel`) with `lib/studio/reasoning.test.ts`: sentence splitting, the growing last line, step phrases, task steps left out, the window of three, stable ids.

## 3. View

- [x] 3.1 Add `components/studio/reasoning-steps.tsx` (shimmering marker, three-line window with Motion, reduced motion) and replace the marker and "Work details" in `components/studio/transcript.tsx` with it and the "Worked for" summary; update the transcript tests.

## 4. Verification

- [x] 4.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [ ] 4.2 In the running app: a turn shows its steps and reasoning scrolling under a shimmering phrase; the finished turn reads "Worked for …" and expands into its steps; a relaunch shows no reasoning; reduced motion stills the movement.
