## 1. Runtime

- [x] 1.1 Post `studio.present` when the set of mounted managed objects changes (coalesced per frame, keyed by generation) and verify with a runtime test that mounting and unmounting post once each.
- [x] 1.2 Draw the hover outline on `studio.hover` and hand hover back on `null`; verify in `preview/inspect.test.ts`.

## 2. Contract

- [x] 2.1 Mirror `studio.present` and `studio.hover` in `lib/studio/preview.ts` and verify `lib/studio/preview.test.ts`.

## 3. Webview

- [x] 3.1 Add `lib/studio/layers.ts` (`layersOf`: tree from the document) with `lib/studio/layers.test.ts`.
- [x] 3.2 Add `hooks/use-canvas-layers.ts`: rows, presence, hover, select and Tab/Shift+Tab; verify in `hooks/use-canvas-layers.test.tsx` including text editing and no mounted objects.
- [x] 3.3 Render the list, the empty state and the one-line details in the inspector (`components/studio/canvas-preview.tsx`); the component only renders.

- [x] 3.4 Layers / Properties views in the inspector header: derived from the selection in `hooks/use-canvas-layers.ts`, the selected row marked; verify in `hooks/use-canvas-layers.test.tsx` that a new selection shows Properties, Layers keeps the selection, and a row click shows Properties.

- [x] 3.5 Vertical icon bar (views, Snapshot, collapse) with a collapsible content area; clicking the active view collapses; Export moves to the pane header with its dialog; logic in `hooks/use-canvas-layers.ts`, verified in `hooks/use-canvas-layers.test.tsx`.

- [x] 3.6 Collapsible groups and scene groups: `SCENE_DEFINITION` in `shared/studio-document.ts`; rows carry parent, depth, children and scene in `lib/studio/layers.ts`; expansion (presence, selection, overrides) in `hooks/use-canvas-layers.ts`; chevrons and scene styling in the inspector; verify in `lib/studio/layers.test.ts` and `hooks/use-canvas-layers.test.tsx`.

## 4. Verification

- [x] 4.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [x] 4.2 In the running app: the list matches the video's objects; hovering outlines; a transparent object is selectable from the list; an off-screen object opens its properties; Tab cycles objects on screen; a video without objects shows the sentence; with an object selected, Layers shows the list with its row marked and the handles still on the canvas, a row click or a canvas click shows Properties; the icon bar switches views, clicking the active icon collapses to the bar and any icon expands it; Export sits in the pane header in Preview and Docs; in a video grouped by scenes, the scene on screen is expanded, groups collapse and stay collapsed, and selecting inside a collapsed group expands it.
