## 1. Shared contract

- [x] 1.1 In `shared/studio-document.ts` add optional `StudioObject.removed`, the `{ kind: "remove" | "restore" }` operation beside the field operation, `isRemoved(document, id)` (self or ancestor), and extend `applyStudioOperation`, `inverseStudioOperation` and the retry comparison; verify with new cases in `shared/studio-document.test.ts`: remove, restore, scene refused, already-removed and removed-ancestor refused, field edit on a removed object refused, retry idempotent, reused ID with other contents refused
- [x] 1.2 In `shared/ipc.ts` add `studio.remove`, `preview.remove` and `preview.restore` with their params and results, bump `SIDECAR_PROTOCOL` to 38 and `PROTOCOL` in `src-tauri/src/ipc.rs` with it; verify `shared/protocol.test.ts` passes and `cargo check` in `src-tauri` succeeds

## 2. Runtime and template

- [x] 2.1 Add `templates/remotion/src/lib/studio-objects-v6/` — `index.tsx` re-exporting `useStudioObject` from v5 and a `StudioObjects` that renders v5's provider plus the `<style data-studio-runtime="6">` hiding every removed object and its descendants, `between.ts` re-exporting v5's, and a README covering removal; verify with a new `preview/managed-removal.test.tsx`: a removed object's root is `display:none`, its values still read, a removed group hides its children, and a component importing the hook from v5 works under the v6 provider
- [x] 2.2 Add `studio-objects-v6` to the list in `sidecar/scaffold/registry.ts` and point the video template's provider import at v6; verify in `sidecar/scaffold/registry.test.ts` that v6 is copied beside authored v1–v5 without overwriting them

## 3. Sidecar

- [x] 3.1 In `sidecar/projects/studio-document.ts` add `removeStudioObject`: under `withConfigLock`, find the single file under `src/videos/<video>/` importing `StudioObjects` from a v5 specifier, rewrite that specifier to v6, and apply the remove operation, leaving both files as they were if either write fails; a v6 video writes the document only; verify in `sidecar/projects/studio-document.test.ts`: v5 video migrated and removed, v6 video document-only, no provider or two providers refused with nothing written, failed import write leaves the document as it was
- [x] 3.2 In the preview host add the remove command: resolve the node path at `file:line:column` with the status finder, run the project's `deleteJsxNode`, answer with text and never write; verify in `sidecar/preview/codemod.test.ts` against the fixture codemods: plain child, `&&`, ternary, `.map` body, and a moved call site refused
- [x] 3.3 Wire `studio.remove`, `preview.remove` and `preview.restore` in `sidecar/handlers.ts`, with code removals held by `sidecar/preview/removals.ts`: containment on the way in and out, the host-read text still on disk before writing, pre-image and post-image hash held in memory by removal ID, restore only on a matching hash (the running-turn refusal is the webview's, beside the existing send-control rule, task 5.2); verify in `sidecar/preview/removals.test.ts` covering each refusal sentence
- [x] 3.4 Teach v6 and removed objects in `sidecar/claude/conventions.ts` (import the provider from v6, never render a removed object back, never reuse its ID, reap its JSX and record when next editing the scene) and add code removals to the *already written by the studio* section of the next message; verify in `sidecar/claude/conventions.test.ts`

## 4. Preview

- [x] 4.1 Add the `studio.hide` / `studio.unhide` bridge frames (`preview/hidden.ts`) that insert and remove a style rule in the video's shadow root, and let a right-click on the canvas pick exactly as a click does and then post `canvas.menu`; keep `lib/studio/preview.ts` in step with the duplicated message shapes; verify in `preview/hidden.test.ts` that a hidden object stays hidden across a remount and is shown again on unhide, and in `lib/studio/preview.test.ts` that the commands decode

## 5. Webview hooks

- [x] 5.1 In `hooks/use-managed-objects.ts` add `remove` (hide first, then `studio.remove`; drop the object's drafts; clear the selection and the preview's selection box; on failure unhide, reselect and say why), `undoOperation` for one specific operation (a restore reselects the object), the per-window write stamps behind `undoableAt`, and removed objects left out of `objects` and `selected`; verify in `hooks/use-managed-objects.test.tsx`: removal hides the object and its children before the write resolves, failure brings it back selected, undo restores and reselects, a stale undo refuses with the sentence, a scene is refused
- [x] 5.2 Add code removal to `hooks/use-inspect.ts`: `removalOf` (the label, the instance count for *Delete all N*, and the reasons: no call site, not TypeScript, no project, video not loaded) and `removeCard` (hide by the selection's anchor, close the card, ask the sidecar, bring the card back on failure); verify in `hooks/use-inspect.test.tsx`
- [x] 5.3 In `hooks/use-canvas-layers.ts` bind Delete/⌫ and ⌘Z on the canvas behind the Tab guard and add the row context menu handler; removed objects are already out of `managed.objects`; verify in `hooks/use-canvas-layers.test.tsx`: keys ignored in the inline editor, controls and with modifiers; the row menu opens for its object
- [x] 5.4 Add `hooks/use-deletion.ts`, composed in `useTools` with the open chat's running turn: what Delete means for the current selection (managed object or picked element) and why it cannot (scene, not on screen, saving, running turn), the ⌘Z order between this window's code removals and the video's last operation, the ten-second *Deleted "…" · Undo* notice with the upgrade note, the canvas menu on `canvas.menu`, and the Layers row menu; verify in `hooks/use-deletion.test.tsx`

## 6. Components

- [x] 6.1 Add Delete (or *Delete all N*, or inert with its reason) to the managed header in `components/studio/managed-props-pane.tsx` and the element header in `components/studio/props-pane.tsx` through one `components/studio/delete-action.tsx`, and the row context menu in `components/studio/canvas-preview.tsx`, reading everything from the hooks above; verify in the existing pane tests that the label renders and a refused action does nothing

## 7. Wrap-up

- [x] 7.1 Add a changeset (`bun run changeset`, minor): objects can be deleted from the canvas
- [x] 7.2 Run `bun run fix`, then `bun run check`, `bun run typecheck`, the touched test files, and the full `bun run test` once; all pass
- [x] 7.3 Ask the user to check in the running app: ⌫ on a heading in a v5 video (vanishes at once, upgrade notice, `index.tsx` import now v6, ⌘Z brings it back selected); delete a group; Delete disabled on a scene row and on a soundtrack; right-click an object on the canvas and choose Delete; the header's Delete button; *Delete all N* on a mapped card; ⌫ while typing in the inline editor deletes a character; an Export after a deletion omits the object
