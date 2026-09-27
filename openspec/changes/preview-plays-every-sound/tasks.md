## 1. Preview runtime

- [x] 1.1 `preview/player-runtime.tsx`: the Player gets `numberOfSharedAudioTags={0}` and an `errorFallback` that draws nothing; `usePlayerFailure` listens for the Player's `error` event and posts `native.error`, which the canvas turns into its worded failure with Retry.
- [x] 1.2 Reproduce on evlibutton in WebKit with the studio's own native runtime: without the change, playback from frame 300 or 400 stops with `Tried to simultaneously mount … <Html5Audio />`; with it, the whole video plays with no error.

## 2. What the agent knows

- [x] 2.1 `agent/skills/video-lessons/references/rendering.md`: "Sound effects end when the sound does" — symptom, cause, correction (a sequence as long as the sample), counterexample.

## 3. Verification

- [x] 3.1 `bun run check`, `bun run typecheck`, the full `bun run test`; changeset.
- [ ] 3.2 In the running app, after restarting the preview: evlibutton plays through the sound cues; a video that throws shows the worded failure with Retry.
