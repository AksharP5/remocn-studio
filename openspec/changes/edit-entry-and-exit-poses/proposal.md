## Why

Objects that fly in from outside the frame, or out of it, are written as a CSS
`translate` scaled by a `travel` distance. The canvas edits only the resting x/y,
so dragging an object mid-entry moves where it lands and the whole entry shifts.
The person expects the pose they drag on an early frame to be where it starts.

## What Changes

- `studio-objects-v5/between.ts`: `geometryBetween(object, {from, to}, progress, {kind})`
  renders the interpolation between two field-backed poses through the existing
  v5 `geometry()` mapping, binds the pose whose weight is at least 0.5 and marks the
  element with the edited pose and the other one. No document or index change;
  the file reaches existing projects because installation adds missing files.
- The canvas labels the edited pose (Entry start, Resting position, Exit end),
  draws the other pose as a dashed outline and the path between the two centres.
- With the move's frames declared, clicking the outline moves the playhead to that pose.
- The agent conventions and the v5 README describe entry and exit poses through
  the helper; CSS translate stays for small unpositioned offsets.

## Capabilities

### Modified Capabilities

- `preview/inspect`: entry and exit poses are edited by dragging on the canvas.

## Non-goals

Converting existing videos automatically, an explicit Start/End switch,
keyframes, curved paths, snapping to the other pose.

## Impact

`templates/remotion/src/lib/studio-objects-v5/{between.ts,README.md}`,
`preview/geometry-target.ts`, `preview/geometry.ts`, `sidecar/claude/conventions.ts`.
No IPC, history or document format change.
