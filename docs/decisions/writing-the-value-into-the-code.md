# Writing the value into the code

> Design record — the reasoning and the measurements behind the decisions, written as they were
> taken and moved out of CLAUDE.md on 2026-09-11. **It is not the source of truth.** The behaviour
> is specified in [`preview/write-to-code`](../../openspec/specs/preview/write-to-code/spec.md); where this text and the spec disagree, the spec is right and
> this text is history. Drift known at the time of the move is listed in [`drift-2026-09-11.md`](drift-2026-09-11.md).


Add no longer always means *ask Claude*. A value the studio can find at its call site is
written into the project's TSX by the studio itself, through the **project's own**
`@remotion/studio-codemods` — and the agent is told it was, so it does not do it twice.
There is no Apply button: Add leaves the chips, and the write happens at **Send** (REM-357).

- **Everything the studio knows about the code comes from one round trip.**
  `computeSequencePropsSubscriptionFromContent` answers, per schema key, `static` /
  `keyframed` / `computed` plus the `nodePath` an edit is addressed to. That one answer
  replaced two guesses: the synthetic `static` statuses `overridePlan` used to publish, and
  the 250 ms `tuning.read` sampler that inferred "animated" by watching a reading move. Both
  are gone. It is asked for once per pick and is not a poll — the file only changes when the
  agent writes to it, and that already arrives as `rebuilt`.
- **A keyframed value keeps animating through the edit.** With the real status the runtime
  takes a `DragOverrideValue` of type `keyframed`: dragging moves the keyframe at the frame
  on screen rather than replacing the `interpolate()` with a constant. The frame rides with
  the draft (`PendingComment.frames`), because a replay has to rebuild the override at the
  frame the value was judged at and not at wherever the playhead has since gone. The
  `animated` badge survives, with nothing left to apologise for: it now means *this is a
  landing value*.
- **Statuses are read in the preview host and applied in the page.** `preview/stack.ts`
  turns `Internals.getStackForControls(controls)` into `{file, line, column}` — the JSX call
  site Remotion records off `jsxDEV`'s source argument, in `development`. That is the one
  coordinate the codemod can use, and it is **not** what React Grab resolves: grab answers
  with the component a node was rendered by, which for a `withSchema` wrapper is the function
  inside it. `where` stays grab's answer, for the pane's subtitle; `origin` is the call site.
- **A `computed` key is still previewable, and that is a deliberate exception.**
  `computeEffectiveSchemaValuesDotNotation` takes the incoming prop for a computed key and
  drops the override on the floor, so publishing the real status would leave a value the
  person is composing a request about invisible on the frame. `publishPlan` stands exactly
  those keys, and only while they are drafted, on a synthetic `static` status.
- **No statuses at all is a working pane with no writing.** A Remotion older than 4.0.513 has
  no `@remotion/studio-codemods` to ask, a file the resolver cannot read answers nothing, and
  a page built before this shipped sends no call site. In every one of those the plan falls
  back to the synthetic status for each drafted key — exactly what the pane did before — and
  every change routes to the agent. Losing the pane on those projects was not worth the
  purity.
- **`shared/codemod.ts` is the routing, and both ends read it.** `static` and `keyframed` go
  to the code; `computed`, a file that is not TypeScript, an element with no call site and a
  key with no status go to the agent. `font-family` is the one value-dependent rule: a family
  the preview has not loaded would be written and then render as the fallback, silently, so
  it goes to the agent — the studio ships no Google Fonts directory and adding an import is
  the agent's job. **A `static` key with no attribute at the call site is still writable**:
  the codemod reads JSX attributes and never a schema `default`, so `codeValue` is
  `undefined` there and the attribute is *added*; writing the declared default back takes it
  off again. Verified against a real `<Backdrop />`.
- **Add leaves two chips, and they are one gesture.** One says *the studio writes these*, one
  is the ordinary request; the sentence rides with the second, so a code-only Add leaves no
  words in the message. Both carry the whole chain, so clicking either reopens the pane where
  the values were set. A chip with no changes at all is still one chip, exactly as before.
- **The write is whole-or-nothing, and then it is a question.** At Send `preview.write` runs
  with `partial: false`: a codemod that cannot do one of a file's edits throws for the whole
  file, so nothing lands until everything can. On a refusal the card is raised over a disk
  nothing has touched — *Send anyway* re-runs with `partial: true` and flips the refused chips
  to requests, *Cancel* leaves the composer and the disk exactly as they were. Which edit is
  at fault is found by probing: each is tried alone against the original text, and the ones
  that survive are applied together.
- **The host produces text; the sidecar writes it.** `sidecar/preview/codemod.ts` runs inside
  the preview host, where the project's packages resolve, and answers with the new contents of
  each file. `sidecar/handlers.ts` runs `escapee` — the permission gate's own containment —
  over the files going in *and* the paths coming back, and only then writes. The host never
  touches a file it did not create. A status target outside the project is dropped with a
  reason rather than failing the batch; a write naming one fails outright.
- **Only Pro writes.** `write-to-code` is its own row in `PRO_FEATURES`, gated in
  `sidecar/agent/plan.ts` and refused by `preview.write` — the disk is the sidecar's, so the
  gate is the sidecar's. On Free the pane never opens anyway, because Inspect is locked.
- **A message that asks for nothing starts no turn.** Every change written, no words typed:
  `history.record` opens the session and writes the user entry, and that is all. The
  transcript keeps the message with both references and the `written` mark on the element.
- **The agent is told, in the same block shape.** A written element's changes are headed
  *Already written by the studio on Title ‹Headline› (src/videos/intro/Title.tsx:24): These
  are in the file already — leave them exactly as they are.* A keyframed change that could
  **not** be written keeps `sampled: true`, so the agent still hears "move the landing value,
  not the frame".
- **While a turn runs on this video, a message carrying code edits cannot go out.** There is
  no queue for it — the agent is rewriting the same files — so the Send button carries the
  reason on its tooltip and the message waits where it was typed. That is also what keeps a
  code chip out of the message queue, which stores `PromptElement`s and would drop the edits.
- **Deliberately not done**, and each of these was decided rather than missed: the read-back
  check that would catch a codemod writing to the wrong element on a line holding several (3
  of 2294 in the corpus, and silent), an undo (git is the undo), a queue for edits made during
  a turn, restoring the selection after the rebuild the write causes, suppressing that rebuild
  with `WatchIgnoreNextChangePlugin`, a Google Fonts directory, and `assetKeys` — the pane has
  no asset control to write from, so `src={staticFile(…)}` reads as `computed` and stays the
  agent's.
- **Measured against the real 4.0.516 package**, end to end through `statusesOf` and
  `assemble`: a literal `fontSize` and `color` rewritten, an `interpolate()`'s landing value
  moved by a keyframe operation, static children replaced, and an attribute added to a
  `<Backdrop />` that had none — all in one file, one pass, with a line number per edit.
