## Why

REM-531: the canvas plays videos slower than the Remotion Player does on its own.
Measured in WebKit around the studio's real native runtime, a full-bleed scene
whose rows of type run thousands of pixels past both frame edges plays at about
23 fps on the canvas against about 26 for the bare Player, and at 30% zoom at
16 fps with 34 dropped-frame stalls in under three seconds.

The cost is paint. To show content outside the frame, the runtime lifts the
clipping of every element that covers exactly the frame, so WebKit paints all of
that content the canvas can show, every frame. Clipping the stage to the frame
brings playback back to the bare Player's speed or above (design.md has the
numbers). With content outside the frame hidden, REM-531 now does exactly that
under the existing requirement. With it shown, which is the default, the cost
stays — unless the canvas stops drawing it while the video plays.

Drawing content outside the frame is for placing and picking things, which
happens with the video paused. During playback the person watches the frame.

## What Changes

- While the video plays, the canvas draws only what is inside the frame, even
  with content outside the frame shown. The surround stays dimmed and empty.
- When playback stops, content outside the frame is drawn again, dimmed, at the
  paused frame, and can be picked.
- Scrubbing and stepping frame by frame count as paused.
- The toolbar toggle keeps its meaning: off hides content outside the frame at
  all times, and hidden content can be neither seen nor picked.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: "Content outside the frame is visible on the canvas"
  applies to a paused video; a playing video shows the frame only.

## Non-goals

- Making the lifted paint cheaper (`contain`, `content-visibility`, compositing
  hints). Not measured here; the scan that finds the clips was narrowed on this
  branch and did not help, which points at paint, and paint scales with how much
  of the lifted content the canvas can show.
- Remembering the dim/hide choice between launches.
- Changing Snapshot, rendering or Export, which already show the frame only.
- A setting to keep content outside the frame during playback. Add one only if
  someone misses it.

## Impact

- Webview only: `hooks/use-canvas-preview.ts` decides when the stage clips, from
  the camera's dim/hide choice and the transport's playing state;
  `components/studio/canvas-preview.tsx` applies it to the stage.
- The preview runtime (`preview/frame-clips.ts`) is unchanged: it keeps lifting,
  and the stage's clip is what keeps the lifted content from being painted.
- No shared contract, sidecar, Rust, history or `settings.json` change; no
  protocol bump.
