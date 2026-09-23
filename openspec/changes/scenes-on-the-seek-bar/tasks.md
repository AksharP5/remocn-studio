## 1. Runtime

- [ ] 1.1 Add `preview/scenes.ts`: derive scenes from registry entries (absolute frames, scene level, descend rule, names) and verify with `preview/scenes.test.ts` covering Series, TransitionSeries, a single wrapper, nested parents, audio clips and unnamed scenes.
- [ ] 1.2 Post `{ type: "scenes" }` from the runtime when the derived list changes, and apply `transport.rate` to the Player; verify with a runtime test that a registry change posts once and a playhead tick posts nothing.

## 2. Contract

- [ ] 2.1 Mirror the `scenes` message and `transport.rate` command in `lib/studio/preview.ts` and verify `lib/studio/preview.test.ts` keeps both sides in step.

## 3. Webview

- [ ] 3.1 Carry scenes and speed in `hooks/use-preview-transport.ts` (reset speed on video change, resend after a rebuild) and verify in `hooks/use-preview-transport.test.tsx`.
- [ ] 3.2 Add `hooks/use-seek-scenes.ts` (percentages, which labels fit) with tests.
- [ ] 3.3 Draw segments and labels on the seek bar and the speed menu in `components/studio/preview-controls.tsx`; the component only renders.

## 4. Agent

- [ ] 4.1 Describe scenes in `sidecar/claude/conventions.ts` (name in `index.tsx`, scene object with the same label bound to the scene root, `parentId` chains) and verify the conventions test asserts it.
- [ ] 4.2 Add `unnamed-scene`, `scene-without-object` and `object-outside-scene` to `sidecar/tools/tunability.ts` with finding codes, severities, expected and fix texts; verify in `sidecar/tools/tunability.test.ts` including a video without scene objects and `imaginator`'s shape.

## 5. Scene rows

- [ ] 5.1 Link scene rows to the runtime's scenes by name and seek on click in `hooks/use-canvas-layers.ts`; an off-screen object seeks to its nearest scene ancestor; verify in `hooks/use-canvas-layers.test.tsx`, including an unmatched label.

## 6. Verification

- [ ] 6.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [ ] 6.2 In the running app: a video with named scenes shows them on the bar; clicking a name jumps to its start; a rebuild that adds a scene shows it; 0.25× slows video and sound; another video opens at 1×; after asking the agent to regroup `imaginator`, the design check passes, the list groups by scene, and clicking a scene or a dimmed object moves the playhead.
