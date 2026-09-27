## 1. Preview runtime

- [x] 1.1 `preview/scenes.ts`: `scenesOf` treats a whole-video sequence as a frame and looks inside it, trying Series frames first and then the one with the most children. It falls back to the level's own sequences, drops whole-video ones, and drops any candidate whose frames the others cover, weakest first. `RegisteredSequence` gains the optional `isInsideSeries`. Verify with `bun run test preview/scenes.test.ts preview/scenes-report.test.ts`, including a `remocn-walk` fixture (a Series of eight beside a score, sound effects, an overlay and a nested sequence), Series preferred over another frame, a background frame that holds no scenes, sound effects inside and across a cut, duplicates, and a transition overlap.

## 2. Webview

- [x] 2.1 `lib/studio/seek-scenes.ts`: `segmentsOf` sorts the scenes and ends each segment where the next one starts. The hook is `useSeekScenes`. Verify with `bun run test lib/studio/seek-scenes.test.ts hooks/use-seek-scenes.test.tsx`.
- [x] 2.2 `components/studio/preview-controls.tsx`: boundary ticks at `h-2` and `bg-foreground/50`.

## 3. Verification

- [x] 3.1 `bun run check`, `bun run typecheck`, the touched test files, and the full `bun run test` once.
- [x] 3.2 Changeset `.changeset/seek-bar-finds-the-real-scenes.md`.
- [ ] 3.3 In the running app, open `remocn-walk`. The scene track reads Name, Paste, September, Bauhaus, Grid, Accents, Type, Signature, with no overlap and seven ticks. Narrow the dock until Accents hides its name, and check that hovering it says "Accents". Check the ticks in both the light and the dark theme.
