## 1. Contract and persistence

- [x] 1.1 Add managed document schemas and pure validation/patch operations; verify identity, schema, independent edits, retries and inverse operations in shared/studio-document.test.ts.
- [x] 1.2 Add contained, serialized, durable document read/write handlers and IPC codecs; verify persistence, conflicts and containment in sidecar/projects/studio-document.test.ts and bump the Rust protocol.

## 2. Runtime and generation

- [x] 2.1 Add the versioned React object provider and semantic picker bindings; verify repeated instances and semantic roots in preview/managed-objects.test.tsx and preview/picker.test.ts.
- [x] 2.2 Scaffold managed example videos, install the versioned runtime into Studio projects, and update generation conventions; verify sidecar/scaffold/template.test.ts and sidecar/claude/conventions.test.ts.
- [x] 2.3 Restrict new folder imports while preserving creation and registered Studio projects; verify sidecar/history/projects.test.ts.

## 3. Inspector

- [x] 3.1 Add useManagedObjects for catalogue, scoped selection, drafts, direct writes and Undo; verify hooks/use-managed-objects.test.tsx including conflicts and late responses.
- [x] 3.2 Render managed properties and object catalogue with accessible controls, preserve legacy Studio inspection, and block export on unresolved edits; verify components/studio/managed-props-pane.test.tsx and existing use-tools/use-export tests.

## 4. Verification

- [x] 4.1 Add a user-facing changeset and contract authoring documentation, including supported v1 corner cases and explicit extension boundaries; verify docs and OpenSpec validation.
- [x] 4.2 Run bun run fix, bun run check, bun run typecheck, targeted tests and the full bun run test suite. Verify the template runtime separately because preview/templates are excluded from the main TypeScript project. Record the remaining native-app checks: select repeated cards, edit, rebuild, Undo, reload and export.

## 5. DialKit pane follow-up

- [x] Reuse DialKit controls, the numeric scrubber, group headings and persisted fold settings. Add group metadata to the starter video and generation instructions.
- [x] Preserve live drafts and commit pointer/held-key gestures once; normalize color notation with alpha and keep uncertain fields disabled.
- [x] Verify pane controls and gesture boundaries, run the full suite, typecheck, lint and production build; native desktop visual verification remains manual.

## 6. Playback and timing follow-up

- [x] Preserve the current frame and playback state across preview rebuilds, including full iframe reload; clamp restored frames when the video becomes shorter.
- [x] Display existing frame-unit fields in seconds using composition FPS and save to the original frame grid. Scaffold durations in seconds.
- [x] Visualize and select named easing enums in the managed pane; wire easing into the starter animation and agent conventions.
- [x] Verify focused regressions, full tests, main/template typechecks and lint; document desktop verification limits.

## 7. Managed pane layout follow-up

- [x] Move status, loading and save recovery actions into an automatically sized header with the DialKit object selector.
- [x] Render seconds and other numeric fields with DialKit sliders, preserving gesture commits and frame conversion.
- [x] Verify header placement, selection, timing controls, full tests, typecheck and lint.

## 8. Custom easing follow-up

- [x] Add a validated atomic Bezier field with structural equality for retries, conflicts, no-op drafts and Undo.
- [x] Add DialKit curve handles, coordinate sliders and preset selection with gesture commits.
- [x] Ship the v2 runtime alongside authored v1 copies; scaffold and document wired editable easing for new videos.
- [x] Verify persistence, drafts, runtime, panel, full tests, typechecks and build.

## 9. Inspector hierarchy follow-up

- [x] Consolidate the header selector and actions, shorten status text, and separate Appearance from Animation with accessible tabs.
- [x] Add English presentation labels without changing IDs or authored captions, paired dimensions, spacious text editing and progressive disclosure for text spacing, spring settings and curve coordinates.
- [x] Update generation conventions, verify unknown fields and pending tab edits, run tests/typecheck/lint/build and inspect isolated browser fixtures.

## 10. Inspector polish

- [x] Replace native details markers with shared Base UI disclosure buttons and consistent chevrons, neutral keyboard focus and desktop hit areas.
- [x] Use segmented Appearance/Animation tabs and remove the extra header divider.
- [x] Update disclosure assertions and verify pane tests, typecheck and lint.
