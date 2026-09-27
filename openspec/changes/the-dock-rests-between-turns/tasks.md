## 1. Webview

- [x] 1.1 `TaskStatusIcon` takes `still`, which draws the in-progress mark without animation. `TaskChecklist` takes `working` and draws its in-progress rows still when it is false.
- [x] 1.2 `TaskDock` takes `working` (`turn.isRunning` from `chat-pane.tsx`): the header mark, the active stage row and the nested plan animate only while it is true, and `pipelineLabel(stages, tasks, working)` reads the stage title between turns and ignores a task left in progress. The plan-only dock ignores a leftover in-progress task too.
- [x] 1.3 The transcript's plan checklist animates only while a turn is running.

## 2. Verification

- [x] 2.1 `components/studio/task-dock.test.tsx`: the dock rests on the active stage between turns (title, still mark), animates while a turn works, and stops animating a task a stopped turn left in progress. `bun run check`, `bun run typecheck`, the touched tests and the full `bun run test`.
- [x] 2.2 Changeset `.changeset/the-dock-rests-between-turns.md`.
- [ ] 2.3 In the running app: let a turn end with Review still active — the dock reads "Review" and its mark is still; send a message — the mark animates and the label reads "Reviewing the result" again.
