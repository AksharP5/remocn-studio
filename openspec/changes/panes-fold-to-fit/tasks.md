## 1. Widths and fit

- [x] 1.1 `lib/studio/panes.ts`: `CANVAS_MIN_WIDTH`, `RULER_WIDTH`, `INSPECTOR_BAR_WIDTH`, `SIDEBAR_WIDTH`, `PREVIEW_MIN_WIDTH` derived from the floor, `fitPanes`, `inspectorHasRoom`; `use-canvas-rulers` reads its size from there; verify in `lib/studio/panes.test.ts`.
- [x] 1.2 `hooks/use-window-width.ts` over `resize`; `hooks/use-panes.ts` derives docking from intent and fit, holds the sidebar and chat peeks, and makes `toggleProjects` peek without room; verify in `hooks/use-panes.test.tsx`.

## 2. Shell

- [x] 2.1 `hooks/use-sidebar-collapse.ts`: an instant phase when the room changed; verify in `hooks/use-sidebar-collapse.test.tsx`.
- [x] 2.2 `hooks/use-sidebar-peek.ts`: edge hover intent, leave-to-close, Escape, press outside; verify in `hooks/use-sidebar-peek.test.tsx`.
- [x] 2.3 `components/studio/app-shell.tsx`: slide transitions only while sliding, the sidebar overlay and the edge, the chat folded by constraint and shown as an overlay, the divider hidden while folded, drag regions on the grid and the sidebar column.
- [x] 2.4 `chat-pane.tsx`: *Hide the chat* while it is an overlay; `studio-provider.tsx`: the commands read a peeking sidebar as shown.

## 3. Preview

- [x] 3.1 `preview-pane.tsx` / `canvas-preview.tsx`: the header row owns the leading *Show the chat*, the toolbar in flow with its own container and tiers, and the actions; leading inset when the preview is leftmost.
- [x] 3.2 `use-canvas-layers.ts` / `use-canvas-preview.ts`: fold the inspector from the viewport width, a floating peek while folded; the canvas reserves the bar only; verify in `hooks/use-canvas-layers.test.tsx`.
- [x] 3.3 The sidebar overlay is a card inset 8 px like the content card; the docked sidebar's content slides with its column instead of being cropped; exits run 180 ms against 250 ms entries; reduced motion fades the overlays instead of cutting them.
- [x] 3.4 `preview-pane.tsx`: the canvas hint is one line, shown only when it fits; the preview's hint and Inspect's reason truncate with the full text on hover.
- [x] 3.5 `preview-controls.tsx` / `use-preview-transport.ts`: below 28rem a compact speed button shows the rate and cycles through the speeds; verify in `hooks/use-preview-transport.test.tsx`.

## 4. Core

- [x] 4.1 `src-tauri/capabilities/default.json` grants `core:window:allow-start-dragging`; `tauri.conf.json` `minWidth` 640.
- [x] 4.2 `test/register-dom.ts` registers the default 1440 × 900 window.

## 5. Verification

- [x] 5.1 Biome on the changed files, `bun run typecheck`, the touched tests, the full suite once, `cargo check`.
- [ ] 5.2 In the running app (needs a restart of `bun tauri dev` for the capability and the minimum width): drag the window by each header and by the gap above the sidebar; narrow it from the default — the sidebar folds, then the inspector to its bar, then the chat, and the preview remains at 640 px with Export and the toolbar whole; rest the pointer at the left edge — the sidebar slides over and leaves when the pointer moves right; press ⌘B while folded — it opens over, ⌘B closes; press *Show the chat* — the chat slides over the preview and stays while picking on the canvas; expand the folded inspector — it opens over the canvas without moving the playback panel; widen the window — everything docks back as it was; start an export at the narrowest canvas — the progress and the toolbar do not overlap.
