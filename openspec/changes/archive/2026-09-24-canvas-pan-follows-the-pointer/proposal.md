## Why

Panning the canvas lags: with Space held the video trails the pointer and moves
in jerks, and a middle-button drag changes the cursor but does not move the
view at all. Every pointer move synchronously re-rendered the whole canvas pane,
the inspector and its properties included, and re-laid out the geometry and
Inspect overlays, so WebKit held back the next move until that work was done.

## What Changes

- Camera changes from pointer and wheel input are queued and applied once per
  animation frame, so a pan costs one render per frame however many moves arrive.
- The inspector no longer re-renders when only the camera changes.
- A middle-button drag pans the canvas like Space-drag.

## Capabilities

### Modified Capabilities

- `preview/shadow-canvas`: panning follows the pointer; middle-button drag pans.

## Non-goals

Inertia after a pan, pan bounds, changing the zoom model.
