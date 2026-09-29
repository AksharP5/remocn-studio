## 1. Webview: the room

- [x] 1.1 Add `CHAT_MIN_WIDTH`, `PREVIEW_MIN_WIDTH`, `INSPECTOR_WIDTH`, `PREVIEW_ROOM` and `previewRoom` to `lib/studio/panes.ts`; verify in `lib/studio/panes.test.ts` (widens to the room, capped by the chat's minimum, never narrows, ignores sub-pixel rounding, no width yet).
- [x] 1.2 Add `hooks/use-preview-room.ts`: make room after the preview is shown, at mount, when the sidebar settles and on every layout change that is not a user interaction; skip while hidden, collapsed or sliding; hand every change on to the stored layout; verify in `hooks/use-preview-room.test.tsx`.
- [x] 1.3 Wire it in `components/studio/app-shell.tsx` (the group's `elementRef` and `onLayoutChanged`, the minimums from `panes.ts`); the component only renders.

## 2. Webview: the canvas toolbar

- [x] 2.1 In `components/studio/canvas-preview.tsx`, read the inspector width from `INSPECTOR_WIDTH`, make the top row `@container/canvas-top`, and hide Zoom out, Zoom in and Full screen below 30rem, Zoom to selection and Rulers below 25rem.

## 3. Verification

- [x] 3.1 Biome on the changed files, `bun run typecheck`, the touched test files and the full suite once (3219 pass, 11 skip, 0 fail on bun 1.4.2); add a changeset. `bun run check` on the whole tree already fails on `videos/` and `artifacts/` from `34a02dd`, unrelated to this change.
- [ ] 3.2 In the running app, at the default window with the sidebar open: hide and show the preview — it slides open at about 761 px with the chat at 380 px, the canvas toolbar shows six buttons and Export is uncovered, and the playback panel's hint fits in two lines at most; hide the sidebar — the preview widens, the chat keeps its width; show it again — once it settles the chat is at 380 px and the preview is not squeezed; drag the divider to widen the chat — the preview stays where it is dropped; relaunch — the preview has its room again and the drag is still what `layout:shell` holds; narrow the window to its minimum — no pane is hidden.
