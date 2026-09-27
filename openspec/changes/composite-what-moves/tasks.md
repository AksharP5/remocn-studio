## 1. Preview runtime

- [x] 1.1 In `preview/frame-clips.ts`, watch `style` attribute changes under the video's root; mark an `HTMLElement` strictly inside the player whose inline transform changed and is not `none`, unless it is laid out inline; unmark it when its transform goes away; give the marker `will-change: transform` in the lift's stylesheet; stop watching on release. Verify in the new `preview/frame-clips.test.ts`: a changing transform is marked, a static one or a non-transform style change is not, a removed transform unmarks and a new one re-marks, the player's own scaled container and an inline element are never marked, and release stops the watch and drops the stylesheet.

## 2. Verification

- [x] 2.1 `bun run check`, `bun run typecheck`, `preview/frame-clips.test.ts` and the full suite once; add a changeset.
- [x] 2.2 Re-run the WebKit harness in design.md against the change: the September scene at 50% and 30% zoom with content outside shown plays at the bare Player's speed or above, and no other scene of remocn-walk gets slower; screenshots at thirteen paused frames are pixel-identical to the lift alone.
- [ ] 2.3 In the running app, with content outside the frame shown: play remocn-walk — the September scene is smooth at the default zoom and zoomed out, and its rows keep moving, dimmed, above and below the frame; pause — the rows can be picked; zoom in to 400% while paused and while playing — moving type stays sharp, not blurred; the other scenes look and play as before; hide mode, full screen, Snapshot and Export are unchanged.
