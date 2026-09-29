## Context

See proposal.md for why. Three facts about the code shape everything below.

- **A managed object's values are read far from its root.** Measured on the videos agents actually wrote (`~/projects/opensource/studio-launch-final`, `remocn-studio-v2-videos`): `orbit/index.tsx` builds its timeline from `document.objects.filter(…)`, calls `useStudioObject` once per record in a `.map`, and looks up `"task-launch"` and `"progress"` by ID with a non-null assertion; `launch-final/scenes/EndScene.tsx` reads `useStudioObject("end-shot")` in three components, and that object's fields time the whole end scene. `useStudioObject` throws `Expected exactly one editable object named …` for an ID missing from the catalogue. Removing a record, or the JSX of its root, compiles and then crashes the film.
- **Many managed objects have nothing on screen.** The same videos declare `soundtrack`, `voiceover`, `sfx`, `music`, `timing`, `edit`, `ui-theme`, `ui-layout` objects: data read by code, with no bound root, or with a root that wraps a whole shot (`<UiCamera id="end-shot">`).
- **Remotion can delete JSX.** The ticket assumed `@remotion/studio-codemods` could not; 4.0.520, the version the template pins, exports `deleteJsxNode({ input, nodePath })`. It finds the element at a node path, replaces it with `null` when it sits in `&&`, a ternary, a `return`, an arrow body, an argument or an array, splices it out of JSX children otherwise, and applies the result as source edits rather than reprinting the file. Remotion's own Studio uses it for the timeline's Delete.

Undo today is the document's own log: `lastUndoable` walks `operations` from the end, skipping undone ones, and `inverseStudioOperation` swaps before/after. No key is bound to it; the only Undo is the properties header's button.

## Goals / Non-Goals

**Goals:** Delete is local, instant and exactly reversible; no gesture here ever depends on a turn; nothing that reads a removed object's values can break.

**Non-Goals:** cleaning dead code (the agent does, when told); multi-selection; scene deletion (proposal, Non-goals).

## Decisions

### 1. Managed removal is a tombstone in the document

`StudioObject` gains an optional `removed: true`. A new operation shape, `{ kind: "remove" | "restore", objectId, id, undoOf? }`, sits beside the existing field operation in `StudioOperation` as a union discriminated by `kind` (absent means a field edit, so every stored document stays valid). `applyStudioOperation` checks: object exists; for remove, neither it nor an ancestor is removed and its definition is not `scene`; for restore, its own flag is set. The inverse of remove is restore. `lastUndoable` and the retry comparison learn the new shape. A field operation on a removed object — or one under a removed ancestor — is refused with the existing *This object was removed* sentence.

*Alternatives.* Deleting the record, with the whole record, index and children in the operation so Undo can rebuild it: rejected by the first fact above — every reader of its values breaks. A `visible` field per definition: needs every definition migrated and every consumer to read it; the agent would forget one.

### 2. v6 wraps v5 and hides by style

`templates/remotion/src/lib/studio-objects-v6/index.tsx` re-exports `useStudioObject` from `../studio-objects-v5` and exports a `StudioObjects` that renders v5's provider with the same document plus one `<style data-studio-runtime="6">` holding `[data-studio-object="<id>"]{display:none!important}` for every removed ID and every descendant of one. `between.ts` is re-exported the same way.

Why this and not a v5 copy with a hook change:
- **Mixed imports keep working.** Scenes that import `useStudioObject` from v5 read the same React context, because the context *is* v5's. A copy would have its own context, and any component still importing v5 would throw *An editable object must be inside StudioObjects*.
- **Only one import changes.** Migrating a video is rewriting the specifier of the one import declaration that brings in `StudioObjects` from the v5 index — normally the video's `index.tsx`.
- **The transport is untouched.** `preview/managed-loader.cjs` and `sidecar/preview/native.ts` match v5's index by path and rewrite its `postMessage`; v5's file is still the one that runs, so neither changes.
- **Hiding cannot be forgotten.** `v5`'s `bind` already stamps `data-studio-object` on every root; `display:none !important` beats any inline style the component sets. It covers HTML and SVG roots, holds in the Player, stills and the renderer — one bundle serves all three — and it is plain CSS in the project, so a `remotion render` outside the studio produces the same film.
- **The preview sees v6 without a protocol.** The `<style data-studio-runtime="6">` element in the mounted tree is the capability marker; the native surface looks for it in the shadow root.

IDs match `^[a-zA-Z0-9][a-zA-Z0-9_-]*$`, so they need no escaping inside the attribute selector.

### 3. Delete applies only to what is painted now

The action is enabled for an object whose root is mounted and painted at the current frame (the existing `present` set Layers dims by). That single rule excludes soundtracks, timing records and anything else with no root, and makes a wrapping root (a camera around a shot) delete what its outline shows — what you see selected is what goes.

### 4. Non-managed removal runs Remotion's codemod, immediately

New method `preview.remove { projectId, file, line, column }` → `{ removal, file, line }`. The sidecar forwards it to the preview host, which resolves the node path at that call site with the same finder the status request uses, runs the project's `deleteJsxNode`, and answers with the new text — it never writes (`preview/write-to-code`, *The host produces text and the sidecar writes*). The sidecar checks containment, checks the file still holds the text the host read, writes it, and keeps `{ before, afterHash }` in an in-memory map under a fresh `removal` ID. `preview.restore { projectId, removal }` writes `before` back only if the file's hash is still `afterHash`, then forgets the entry. The pre-image never crosses the wire.

*Delete all N* passes the same call site; the codemod removes the one line that draws every instance, which is the only honest reading of "delete" for a shared call site.

The write is refused while a turn runs on the video, matching *A message carrying code edits waits while the video's turn runs*: the agent's own edit tools compare against the text they read, and a studio write underneath them turns into a failed tool call mid-turn.

### 5. Managed migration is a sidecar write in the same gesture

`studio.remove { projectId, video, operation }` replaces `studio.patch` for this one gesture on a v5 video: under the same `withConfigLock`, the sidecar finds the file under `src/videos/<video>/` whose import declaration brings in `StudioObjects` from a `studio-objects-v5` specifier (exactly one, or it refuses), rewrites that specifier's last segment to `studio-objects-v6`, then applies the remove operation to `studio.json`. If either write fails, the other is not made (the import is written last, after the document is validated; a failed import write restores the document). A video already on v6 goes through plain `studio.patch`.

### 6. It disappears first, and the rebuild does not bring it back

The webview tells the preview to hide the target before any IPC: a new bridge frame `studio.hide { selectors, token }` inserts a style rule into the video's shadow root — `[data-studio-object="id"]` for a managed object, the selection's anchor selector(s) for a code element. The rule is removed when (a) the managed runtime acknowledges the operation (`studio.ready` carries it as `lastOperationId`, the existing receipt) — from then on v6's own rule hides it; (b) the rebuild that follows a code write lands, where the element no longer exists; or (c) the write fails, in which case the object reappears and stays selected.

### 7. ⌘Z undoes this window's changes in order, then the document's

The webview keeps a per-video journal of changes made in this window: `{ kind: "document", operationId }` or `{ kind: "code", removal, label }`. ⌘Z on the canvas and the notice's Undo take the journal's last entry: a document entry is undone through the existing inverse path (its precondition still guards a concurrent edit), a code entry through `preview.restore`. With the journal empty, ⌘Z falls back to the document's `lastUndoable` — what the header's Undo does today. After a restore, the object is selected again. The ⌘Z guard is the Tab guard (`data-preview-editing`, `fromControl`, no other modifier than ⌘).

### 8. The agent learns from the file, and from the next message

`sidecar/claude/conventions.ts` (and the v6 README) say: import the provider from v6; an object marked `removed` is gone from the film — never render it back, never reuse its ID, and when you next edit its scene delete its JSX and, once nothing reads its values, its record. A code removal is added to the next message's *already written by the studio* section with its file and line.

### State and wire

| State | Owner | Crosses as |
|---|---|---|
| `removed` flag, remove/restore history | `studio.json`, written by the sidecar | `studio.patch`, new `studio.remove` |
| Code removal pre-image | sidecar memory, per removal ID | `preview.remove` / `preview.restore` (IDs only) |
| Hidden-before-saved rule | preview (shadow root) | bridge frame `studio.hide` / `studio.unhide` |
| Undo journal | webview, per video, per window | — |
| v6 present | the mounted tree | `<style data-studio-runtime="6">` |

New IPC methods: `studio.remove`, `preview.remove`, `preview.restore`. `SIDECAR_PROTOCOL` 37 → 38 and Rust `PROTOCOL` with it. No history migration, no settings key.

## What implementation changed

Recorded after `/opsx:apply`; where these differ from the decisions above, these are what shipped.

- **v6 binds rather than re-exports.** `index.tsx` imports `StudioObjects` and `useStudioObject` from v5 and exports `useStudioObject` as a local binding; `between.ts` does the same. `export … from` trips Biome's `noBarrelFile` on `templates/**`, and the behaviour is identical.
- **The import is written before the document, not after.** With the document first, a rebuild between the two writes would compile `removed: true` under a v5 provider, and v5 paints it — the object would flash back. Writing the import first means the intermediate build changes nothing on screen; if the document write then fails, the import is put back, so neither file changes (`removeLocked` in `sidecar/projects/studio-document.ts`).
- **The first Delete adds the v6 folder itself.** `ensureRegistry` runs when a video is created or registered, not when a project opens, so an existing project may not have `src/lib/studio-objects-v6` yet. `installRuntime` copies that one folder the way the registry does, never over an authored copy.
- **Remotion's finder is line-based, and a line can start two elements.** `lineColumnToNodePath` returns the *last* JSX element opening on the line: against the real 4.0.520 codemods, `{show ? <Badge /> : <Card />}` at Badge's line deleted `<Card />`. The identity check refuses a mismatch only when the target carries an identity. So `preview.remove` also carries the component name, and `removalOf` refuses unless the line opens exactly one `<Component` and the text the codemod removed starts there (`AMBIGUOUS_LINE`). The write-to-code path has the same line ambiguity for values; it is out of scope here.
- **The running-turn refusal lives in the webview.** It sits beside the existing rule that holds a message with code edits during a turn; the sidecar does not track which video a turn belongs to at the point of a removal.
- **⌘Z orders by write stamps, not one journal.** The managed hook stamps every operation this window writes (`undoableAt`); code removals are stamped in `useDeletion`. ⌘Z takes the newer of the two; an operation from before this window counts as oldest. The notice's Undo undoes *its* deletion (`undoOperation` / that removal ID), not whatever is newest.
- **The agent learns of a code removal from a trailer, not the "already written" section.** The sidecar holds the removal, so it appends a *Deleted by the studio since your last turn* note to the next turn in that project, through the brief every adapter already appends. No prompt parameter or webview plumbing changed.
- **The webview does not read the v6 marker.** The sidecar decides whether a video needs the upgrade or cannot delete at all, so the preview reporting the runtime would add a round trip that changes no decision. The `<style data-studio-runtime="6">` marker stays for the design check and for people reading the DOM.
- **The removal clients live in `lib/studio/code-removal.ts`.** Added to `lib/studio/preview.ts`, they made Biome 2.5.5 infer `inspect.card?.rect` in `hooks/use-canvas-preview.ts` as non-nullish and fail `noUnnecessaryConditions` on a line this change never touched — found by restoring files from `HEAD` one at a time.
- **Right-click picks in the preview.** `preview/inspect.ts` treats button 2 like button 0, then posts `canvas.menu` once the pick is reported; `useDeletion` opens the native menu on the next render, when the selection it names is current. The inline editor's textarea lives in the document overlay, so the system text menu keeps working there without a change.

### After the review

An independent review of the finished diff found these, and they are fixed:

- **Sibling elements were refused.** `removedFrom` matched the longest common prefix, which runs past the deleted `<` whenever the next line also starts with `<` at the same indent — every ordinary list of children. It now accepts any alignment between the left-most (suffix first) and right-most (prefix first) placement of the removed text; a real-codemod test deletes each of `<Badge />`, `<Footer />` and two `<Card />` siblings.
- **A refused Undo said nothing.** `undoOperation` and `undo` now resolve to a sentence or `null`, and `useDeletion` shows the sentence: already undone, an edit in progress, changed since it was deleted.
- **The notice's Undo acted on whatever video was open.** A removal carries the project and video it was made in, and `undoOperation` refuses from any other.
- **The ⌘Z journal was per project.** It is keyed by project and video.
- **Delete with a text draft saved the draft first.** The button prevents the pointer-down that would blur the field, so the draft is dropped, as the spec says.
- **Deleting another object from its row cleared the selection.** Only a selection inside the removed subtree is cleared, and only it is restored on failure.
- **v6's `<style>` shifted `:nth-child` anchors.** It renders after the video's children.
- **Presence reset on every rebuild enabled Delete for everything until the next report.** The last reported set is kept.
- **v1–v4 videos.** The webview does not know a video's runtime, so the spec now says what happens: Delete is offered, the sidecar refuses, and the object reappears with the sentence.

## Risks / Trade-offs

- **[Dead code accumulates in the video]** → the conventions ask the agent to reap it when it next edits that scene; the film is correct meanwhile.
- **[A component overrides `display` with `!important`]** → the object would still paint. Nothing in the surveyed videos does; the canvas would show it still painted after the receipt, and the preview's rule stays until the rebuild so the gap is visible, not silent.
- **[`deleteJsxNode` leaves an unused import or variable]** → it compiles; Biome would flag it in the project. Accepted: the studio does not lint the person's project.
- **[The pre-image dies with the sidecar]** → Undo of a code removal after a sidecar restart says it is no longer possible. The file is unchanged, so nothing is lost but the shortcut.
- **[A removal in a v5 video touches code]** → one specifier, once, on the person's own gesture, announced in a notice. The alternative, silently honouring `removed` in v5 through the preview's loader, would make the studio's export differ from the project's own `remotion render`.
- **[A code removal is hidden by a positional anchor]** → until the rebuild lands, the rule hides whatever sits at that `:nth-child` path; scrubbing across a sequence boundary in that moment can hide a neighbour. The window is one rebuild long.
- **[The deletion note is taken when the turn is assembled]** → if the turn fails before the adapter starts, the note is lost; the file still shows the truth.
- **[The v6 folder stays when the document write then fails]** → it is the runtime folder, unused until imported; the video's own files are put back.
- **[Only the open chat's turn locks code Delete]** → a turn in another chat of the same video can still be writing the file; the sidecar's before-write check refuses if the text changed.
- **[Delete all N hides only the picked instance at once]** → the anchor names one instance; the others disappear with the rebuild after the write, a moment later.
- **[⌘Z may never reach the page]** → the Edit menu's predefined Undo owns ⌘Z natively; WKWebView is expected to offer the key to the page first, where `preventDefault` keeps the menu action from running. This has to be seen in the running app; the notice's Undo does not depend on it.
- **[Removing a wrapping root hides objects parented elsewhere in the catalogue]** → they stay in Layers, dimmed as not painted; restoring the wrapper brings them back. WYSIWYG, since the outline the person deleted enclosed them.

## Migration Plan

`registry.ts` copies `studio-objects-v6` into every project on open, beside the authored v1–v5 copies, which it never overwrites. New videos import v6 from the template. Existing v5 videos move on their first Delete (Decision 5). Rollback: an older studio build reading a document with `removed` or a remove operation refuses it as invalid — acceptable with no users yet; the runtime file keeps rendering, since v6 only needs v5 beside it.
