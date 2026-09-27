## 1. Preview runtime

- [x] 1.1 Export `SELECTION_LABEL` (`data-remocn-selection-label`) from `preview/geometry.ts`, set it on the geometry size label, and set it on the selection label in `preview/inspect.ts` `selectionPair()`; `preview/inspect.test.ts` checks the selection label and the size readout carry `SELECTION_LABEL_ATTR` from `lib/studio/preview-camera.ts`.

## 2. Webview

- [x] 2.1 Name the attribute in `lib/studio/preview-camera.ts` (`SELECTION_LABEL_ATTR`).
- [x] 2.2 Extract `ThinkingMark` from `components/studio/thinking.tsx` and render it from `Thinking`; `components/studio/transcript.test.tsx` still passes.
- [x] 2.3 Add `hooks/use-canvas-working.ts`: working while the open chat's turn runs with no permission card or source question; while working, observe the overlay root and keep the mark 4px after the shown label, hidden when none is shown. Test in `hooks/use-canvas-working.test.tsx`: shown beside the label, follows a moved label, hidden with no label, gone on turn end and while a card waits, the size readout counts.
- [x] 2.4 Add `components/studio/canvas-working.tsx` (renders the memoised mark from the hook) and mount it in `components/studio/canvas-preview.tsx` after the runtime's overlay layer.

## 3. Verification

- [x] 3.1 `bun run check`, `bun run typecheck`, the touched test files and the full suite once; add a changeset.
- [ ] 3.2 In the running app: select an element, send a message, and see the dot-matrix mark just after its label while the turn runs; pan, zoom and play and see it stay on the label; see it leave when the turn ends, when a permission card is raised, and when the selection is cleared; select a managed object with geometry and see it beside the size readout; turn on Reduce motion and see it still.
