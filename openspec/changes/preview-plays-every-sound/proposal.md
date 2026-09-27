## Why

Reported on evlibutton: after a soundtrack was added, the canvas showed a black
frame with a small ⚠️ and nothing else, while the export rendered fine. The video
lays a score and about twenty one-shot sound effects, each in a `<Sequence>` with
no length, so every cue stays mounted to the end and the number of mounted audio
elements keeps growing. Remotion's Player pools audio in a fixed number of shared
tags (`numberOfSharedAudioTags`, 5 by default, which the preview did not set) and
throws `Tried to simultaneously mount 6 <Html5Audio /> tags` past it; the renderer
has no pool. The Player then drew its default error fallback, the bare ⚠️, and the
canvas never learned the video had failed, so it offered neither words nor Retry.

## What Changes

- The preview's Player mounts audio on demand (`numberOfSharedAudioTags={0}`), so a
  video plays however many sounds it holds at once. Shared tags exist to get past
  browser autoplay rules; the app's webview allows media to start without a gesture
  (wry's default `autoplay`), so the pool buys nothing here.
- An error thrown while the video renders in the preview is reported as the canvas's
  worded failure with Retry, instead of the Player's bare ⚠️.
- The agent's `video-lessons` skill records the lesson: a one-shot sound gets a
  sequence as long as the sound, so it unmounts when it has played.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: runtime failures are shown in words; many sounds play.

## Impact

`preview/player-runtime.tsx` and `agent/skills/video-lessons/references/rendering.md`.
No IPC or sidecar change. Needs a preview restart to take effect.
