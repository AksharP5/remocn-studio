## 1. Runtime

- [x] 1.1 `geometryBetween` in `studio-objects-v5/between.ts` with tests for the bound side, the rendered interpolation, overshoot and composed motion.

## 2. Canvas

- [x] 2.1 Parse `data-studio-geometry-between` into the geometry target.
- [x] 2.2 Draw the other pose and the path; prefix the label with the pose name; observe the attribute.

- [x] 2.3 Clicking the other pose's outline seeks to that pose when the move declares its frames; `Stage.seek`; handles on a transparent selected object.

- [x] 2.4 Drag the selection from inside its frame when the pointer cannot hit it; no panning over a selection; show a transparent selected object at 45% in the editor.

## 3. Authoring

- [x] 3.1 Agent conventions and v5 README: entry and exit poses through the helper.

## 4. Verification

- [ ] 4.1 `bun run check`, `bun run typecheck`, touched tests and the full suite.
- [ ] 4.2 In the app, on a video written with the helper: drag early in an entry moves the start (outside the frame), late moves the resting pose; an exit mirrors it; the outline and the path follow the drag; one Undo.
