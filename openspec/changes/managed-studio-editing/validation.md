# Verification — 2026-09-21

Implemented on `feature/rem-499`. Scope is the managed scalar format v1 described
in design.md and the shipped SDK README, not every future field type discussed in
REM-499.

## Passed

- `bun run fix` and `bun run check`.
- `bun run typecheck` for the application and sidecar.
- `bun run test`: 2883 passed, 11 skipped, zero failures across 260 files.
  The skips are the existing opt-in renderer suite and two DOM-environment cases.
- `bun run build`: production Next build and static export.
- `bun run sidecar:build`.
- `git diff --check`.
- `bunx openspec validate managed-studio-editing --strict`.
- A real scaffolded project was separately typechecked with Remotion 4.0.520,
  the generated registry, the managed SDK and the new video. Dependencies came
  from the installed renderer fixture; React declarations came from this repo.
- The same scaffold was bundled with `@remotion/bundler`, selected as composition
  `intro`, and rendered at frame 60 to PNG with `@remotion/renderer` in Chromium.
  The image was visually inspected: both independent text objects and backdrop
  render correctly without the editor. Chromium required execution outside the
  filesystem sandbox because macOS denied Mach port registration inside it.

## Regression coverage

- Semantic roots for split text and nested objects; hidden ancestors.
- Independent repeated instances, reorder and catalogue access without mounting.
- Definition changes, removed objects, invalid values, IDs and parent graphs.
- Conflicting same-field writes and Undo; independent writes preserve both values.
- Atomic receipt persistence and idempotent retries, including a lost response.
- Sequential overlapping saves, selection changes, old project reads and stale
  preview generations; discarded drafts restore current disk values.
- Incomplete numeric values stay invalid instead of silently becoming zero.
- Export waits for successful saving and runtime receipt acknowledgement.
- New-project scaffolding, SDK installation, legacy project preservation,
  external-folder rejection and packaged preview resource completeness.

## Existing independent preview typecheck failures

The normal TypeScript project excludes `preview/`. An additional strict check of
`preview/entry.tsx` against the installed Remotion 4.0.520 fixture reports five
pre-existing errors: the internal audio-context prop, calculateMetadata variance,
command narrowing before seek, readonly node paths, and enum-array indexing.
The same check against a temporary copy of every `preview/` file from Git HEAD
produced the same five errors. These were not introduced by this change; the
managed scaffold itself passes its separate check. Preview behavior is covered by
its existing tests and the added runtime/picker tests, but the whole independent
preview typecheck is not green.

## Native desktop follow-up

Not run in this session: the full Tauri application and an interactive manual pass.
Before release, create a managed video, pick a nested heading, edit one of several
repeated cards, scrub it out of frame and use the catalogue, rebuild, Undo, reopen
the project, and export. Check an external file conflict, Retry and Discard, and
verify that a pre-existing legacy Studio video still uses its legacy pane.

The standalone Chromium check rendered one PNG; it is not a claim that every
codec, asset snapshot, WebGL object or native picking interaction was exercised.

## DialKit follow-up

The full suite passed with 2888 tests and 11 existing skips. Lint, application
typecheck, production build and OpenSpec validation passed. After refining the
unbounded numeric keyboard gesture, all seven focused pane/gesture tests and
typecheck passed again. Tests cover text blur, held slider keys, pointer release
and cancellation, popup-event completion, group folding, alpha-preserving color
normalization and disabled conflict fields. Native desktop appearance and dragging
have not been manually exercised in this follow-up.

## Playback and timing follow-up

The rebuild regression initially failed: after seeking to frame 390, the host
reported frame 0 on `rebuilt`. It now retains 390. Playback position tests cover
full-reload persistence, composition/project isolation, playing state, corrupt
storage and clamping to shorter durations. Runtime restoration uses Player's
initialFrame before its first rendered frame, with session storage written at the
rebuild boundary rather than on every playback tick.

Managed pane tests cover seconds at 24/30/60 fps, conversion back to integer frames,
missing metadata and selection of a named easing preset. Time input formatting
limits display precision to milliseconds while retaining the underlying frame
step. The starter animation consumes both seconds and easing values.

The full suite passed: 2897 tests, 11 skips, no failures. An earlier parallel run
had one timeout in the app sidebar test; the next full run and the final focused
61-test run passed. Lint, main application typecheck and independent template
TypeScript checks passed. Independent preview checking still reports the five
previously documented baseline errors, with no new errors from this change.

Native Tauri replay/rebuild behavior has not been manually exercised. Easing
controls apply to declared, wired enum fields; this change does not automatically
rewrite animation code in existing generated videos or add custom Bezier tuples
to the scalar v1 document.

Production `bun run build` completed successfully. OpenSpec strict validation and
`git diff --check` passed.

## Managed pane layout follow-up

Status, loading and recovery actions now live in an auto-height header, with the
DialKit object selector. The body only contains the scrolling properties. All
numeric controls use DialKit sliders; missing numeric bounds receive a stable
working range based on the initial value. Existing frame fields adapt their
seconds display to a six-decimal slider grid and retain frame snapping on save.

The full suite passed with 2902 tests and 11 skips. The final focused pane/gesture
run passed all 17 tests after extracting the timing adapter. Typecheck and lint
passed. Tests cover object selection by stable ID, header action placement,
Discard, all four timing fields and 24/30/60 FPS conversion. No native desktop
visual pass was performed for this layout change.

## Custom easing follow-up

The easing contract validates exactly four finite coordinates, X in [0,1] and Y
with overshoot. Regression tests cover coordinate equality across serialization,
idempotent disk retries, stale curve conflicts, whole-curve Undo and no-op drafts.
The v2 runtime test exercises live curve drafts, rejection of invalid X and reset
to persisted values on rebuild. Pane tests edit coordinates, commit once on gesture
completion and switch back to a named preset. Registry tests verify v2 installation
alongside an untouched authored v1 runtime.

The focused run passed all 51 tests. Main and independently scaffolded template
TypeScript checks, lint and production Next build passed. The independent preview
check still reports the same five previously recorded baseline errors. The first
full run had the known sidebar expansion timeout; that suite passed all 26 tests
on its own. Native dragging in Tauri has not been manually exercised. Existing
enum animations need explicit document/consumer migration to gain custom curves.

The final full run passed: 2908 tests, 11 skips, zero failures. OpenSpec strict
validation and git diff whitespace checks also passed.

## Inspector hierarchy follow-up

The full suite passed 2913 tests with 11 skips. Production build passed. Final
focused tests passed 21 tests after the visual refinement and section ordering;
main typecheck and lint passed again. Tests cover tab routing and active state,
unknown fields, contextual labels, authored captions, spring disclosure, coordinate
disclosure, frame conversion and saving pending edits when switching tabs.

An isolated browser fixture mounted the real ManagedPropsPane with representative
heading fields. Chromium screenshots of Appearance and Animation were inspected.
This exposed DialKit's inline text-row height clipping the new stacked textarea;
the managed-only height override fixes it. The temporary fixture source was removed.
Screenshots are /tmp/panel-ui-preview/appearance.png and animation.png (the latter
precedes the final move of spring settings above the easing curve). This is not a
full native Tauri interaction test. Fold preferences retain their raw group keys,
and existing project data is not rewritten to improve labels.

## Inspector polish

Native details/summary controls were replaced by a shared Base UI collapsible
with an accessible button, consistent chevron, neutral focus ring and a 40px
trigger height. The tabs use the existing segmented variant with no underline or
header divider. All 18 pane tests and the application typecheck passed. This
follow-up does not reuse the earlier screenshots as evidence of its final styling.
