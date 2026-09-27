## Context

`preview/frame-clips.ts` marks every element in the player whose box matches the
frame and whose overflow clips, and a stylesheet in the runtime's shadow root
sets `overflow: visible !important` on the marked elements. That is how the
canvas draws content outside the frame ("Content outside the frame is visible on
the canvas"). The stage — the frame-sized, camera-transformed `div` in
`CanvasStage` that holds the shadow host — does not clip. Around it,
`CanvasSurround` draws four rectangles: translucent in dim mode, opaque in hide
mode. Until REM-531 the opaque ones only covered the content; WebKit still
painted it underneath, and it could still be picked through them.

REM-531 makes the stage `overflow: clip` in hide mode. This change proposes the
same clip while the video plays in dim mode.

## Measurements

WebKit (Playwright's build 2336, the engine of the app's WKWebView), a harness
that bundles `preview/native-entry.tsx` — the studio's real native runtime,
development build as the preview host serves it — around
`remocn-studio-v2-videos/src/videos/remocn-walk` (1920×1080, 30 fps), mounted the
way `lib/studio/native-preview.ts` mounts it: a shadow host in a 1920×1080 stage
under a scale transform, in a 1100×700 page. "bare" is `@remotion/player` alone
on the same stage, as a reference. Every row set is one run with its variants
interleaved (variant 1, 2, 3, … then again), so load drift hits them equally.
Medians of displayed frames per second and of rAF gaps over 50 ms ("stalls").
Three other agents were building and testing on the same fanless MacBook, so
the load average is given for each run.

Variants: **lifted** — the runtime as it is; **no lift** — the lift stylesheet
removed; **stage clip** — the runtime as it is, the stage `overflow: clip` (the
REM-531 hide mode, and this proposal while playing); **lift paused** — the lift
stylesheet disabled on the Player's `play` event and enabled on `pause`.

September scene (full-bleed type wall), 2.7 s from frame 262, stage at 50%:

| run (load before → after) | bare | lifted | no lift | stage clip | lift paused |
|---|---|---|---|---|---|
| A, 6 reps (2.65 → 4.12) | 26.3 / 0 | 22.9 / 1 | 28.3 / 0 | 28.0 / 0 | — |
| C, 6 reps (2.74 → 4.39) | 26.2 / 0 | 22.6 / 4 | 27.9 / 0 | 28.1 / 0 | 28.2 / 0 |

September scene at 30% zoom (more surround visible, as when the person zooms
out), 6 reps (4.24 → 4.88):

| bare | lifted | stage clip | lift paused |
|---|---|---|---|
| 22.5 / 1 | 16.0 / 34 | 24.9 / 2 | 24.6 / 0 |

Type scene (blur and SVG filters), 4 s from frame 675, stage at 50%:

| run (load before → after) | bare | lifted | no lift | stage clip | lift paused |
|---|---|---|---|---|---|
| B, 5 reps (3.95 → 2.69) | 27.2 / 4 | 27.5 / 8 | 28.0 / 4 | 28.2 / 3 | — |
| D, 5 reps (4.12 → 4.65) | 26.8 / 5 | 26.9 / 6 | — | 27.4 / 3 | 28.0 / 4 |

Reading them:

- The lift is the cost in the September scene, and it grows with the surround the
  canvas shows: −3.5 fps at 50%, −8.9 fps and 34 stalls at 30%. Removing the
  lift, clipping the stage, or lifting only while paused each recover it, to
  within noise of one another and at or above the bare Player.
- The Type scene is inconclusive: every variant is within about one frame per
  second; stalls roughly halve without the lift, but five repetitions are too
  few to claim it.
- The scan that finds the clips is not the cost: narrowing it to added subtrees
  (committed on this branch) changed nothing measurable, and the stage-clip
  variant keeps the scan and the lift and still recovers full speed. What the
  clip removes is the paint.

The harness does not include the app's chrome, React tree or IPC, so absolute
numbers in the app differ; the comparisons between variants are what carry.

## Decisions

### The webview clips the stage while playing

`hooks/use-canvas-preview.ts` already holds the camera (with `outside`) and the
transport (with `playing`). It decides `clipped = outside === "hide" ||
transport.playing` and returns it; `CanvasStage` applies `overflow: clip` to the
stage when it is set. One mechanism serves both hide mode and playback, and the
runtime does not change.

Rejected: the runtime disables its lift stylesheet on the Player's `play` and
enables it on `pause` ("lift paused" above). It measured the same, and it reacts
to play without waiting for a playhead message. But it only removes the lift:
content that overflows the frame without a frame-sized clip (an absolutely
placed element outside a non-clipping root) is still painted while playing, and
the look of the canvas would be decided in two processes — hide mode in the
webview, playback in the runtime.

Rejected: keep lifting during playback and make it cheaper. Paint scales with
the lifted content's visible area, which the person controls by zooming out; no
containment hint was found that keeps content visible without painting it.

Rejected: hide by default. It loses content outside the frame when paused too,
which is where it is used.

### State and failure direction

No new state. `outside` is webview state in `usePreviewCamera`; `playing` is the
webview's copy of the runtime's playhead, carried by the existing `playhead`
message. Nothing crosses the wire that does not already; no protocol bump, no
migration, no `settings.json` key.

The clip is paint only. If the webview's `playing` is late — the runtime has
paused and the playhead message has not arrived — the canvas shows the frame
only for that moment, which is the hide look, never content from another frame.
A stale `playing: true` cannot hide the frame itself.

Picking beside the frame while the video plays finds nothing, as in hide mode.
A selection's outline is drawn from the element's box, which the clip does not
change, so it stays in place.
