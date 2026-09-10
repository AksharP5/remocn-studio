# Generation changes from the Wandry review

Implemented in Studio on 2026-09-10. The Wandry source project was used as evidence;
the implementation changes the generation workflow and supplied motion code.

## What now happens during generation

- The script selects a progression from the supplied material: viewer takeaway,
  actual source, focal subject and reason for the next beat. Website section order
  is context. The agent owns ordinary movement, reading and editing decisions.
- New projects and reopened projects receive `src/lib/studio-motion-v2`. Existing
  authored files are preserved. The primitives support custom layouts; full-frame
  recipes are optional examples, not a required visual style.
- Phrases, heading/details, image/caption, metric/graphic and cards-to-grid use
  executable plans. Group completion includes the last staggered exit; caption
  exits finish before grid movement, and grid labels reveal after movement settles.
- `MotionReview` publishes that same plan from the rendered composition. `useCue`
  connects its cues to actual targets. Full review discovers event neighbours and
  compares target presence/visibility, ownership, exclusive slots, parent lifetimes
  and available duration. It records missing coverage explicitly.
- Completing the agent's review requires a current full report, checked event
  boundaries and no unresolved measured viewer errors. Writing review notes does
  not invalidate the render identity; editing video code or assets does. Human
  export remains available.
- Real-generation evaluation records the exact brief, material and generation
  source hashes, model, human first-pass judgment and correction count. Preparing
  an experiment does not invoke a model or claim that a video was generated.

## Render evidence

The one-shot proof copies the runtime into an isolated project, typechecks against
the template's pinned Remotion dependencies, runs the actual full browser checker
and exports the positive cases to H.264. Every declared event frame was visited;
all ten reports have complete planned coverage and no render failures.

| Case | Frames checked | Result |
| --- | ---: | --- |
| Phrase overlap | 49 | Declared exclusive-slot collision detected |
| Premature caption removal | 39 | Missing target during promised exit detected |
| Text still clipped during hold | 90 | Persistent text clipping detected |
| Phrase replacement | 98 | No measured viewer errors |
| Heading + four details | 79 | No measured viewer errors |
| Portrait heading + six details | 92 | No measured viewer errors |
| Three cards → grid | 267 | No measured viewer errors |
| Portrait cards → grid | 267 | No measured viewer errors |
| Image + caption | 98 | No measured viewer errors |
| Metric + graphic | 112 | No measured viewer errors |

Full run: [results](../../out/motion-contract-proof/2026-09-10T13-19-06-263Z/results.json),
[completion check](../../out/motion-contract-proof/2026-09-10T13-19-06-263Z/completion-validation.json),
[source identity](../../out/motion-contract-proof/2026-09-10T13-19-06-263Z/source.json).
The seven positive saved reports allow agent completion; the three negative
reports keep it open. Inspected phrase and portrait-detail frames, plus the
card transition neighbours, to check wrapping, caption exit and label arrival.

During validation, actual renders exposed two further defects that were fixed:
wrapped trailing spaces falsely exceeded a text mask, and portrait grid labels
appeared while cards still moved across them. Text measurement now uses visible
word ranges; intentional mask clipping during entry/exit stays informational,
while clipping during hold remains a measured defect. Grid geometry and label
arrival now have separate times.

The full run preceded a final cue-naming fix: card ids such as `grid` and
`one-caption` now cannot collide with generated cue names. The
[card rerun](../../out/motion-contract-proof/2026-09-10T13-24-59-239Z/results.json)
validated that final runtime in both formats: 267 frames each, no measured viewer
errors and agent completion allowed.

A [final text rerun](../../out/motion-contract-proof/2026-09-10T13-27-48-043Z/results.json)
checked intentional reveal followed by persistent clipping (90 frames, defect
detected and completion refused) and the valid phrase sequence (98 frames, no
measured viewer errors, completion allowed). This also verifies that merging
adjacent findings cannot carry an entry-phase exception into a clipped hold.

## Other checks

- Final full suite: 2605 passed, 11 skipped, no failures. The skipped cases are the
  existing browser-specific and opt-in exporter smoke cases; the real motion
  render proof above ran separately. This includes the cue-name regression and
  the transition from intentional mask reveal to unintended held clipping.
- Typecheck, full lint (829 files), sidecar build and skill frontmatter validation
  passed. The supplied runtime also typechecked in the isolated render project.
- Evaluation CLI: preparation works; matching brief/assets compare; different
  assets are rejected; null results remain unmeasured. CLI test records are
  explicitly synthetic and are not video-generation results.
- `skills:check` reaches upstream but reports drift in the vendored Remotion
  skills and lock file. Those external skill copies were not refreshed by this
  change. Details: `out/generation-contracts-skills.log`.

## Trying a video

Restart the development Studio from this working copy and reopen the project so
it receives v2. Create a new video with a normal brief and the intended material;
the person should not need to specify stagger, curves or transition timing.
Existing films retain their authored code when reopened.

An optional fresh evaluation project is prepared at
`out/generation-eval/2026-09-10T13-28-45-946Z-review-ready-v2-type/project`; submit the
adjacent `prompt.txt`. Its result record is deliberately empty. Use the
[evaluation instructions](../../evals/generation/README.md) for comparing actual
generations and recording subsequent user corrections.

## Limits

Passing these checks establishes bounded mechanics on sampled rendered frames.
It does not establish good art direction, reference similarity or fewer user
corrections. Reading budgets are estimates. DOM target presence cannot prove
useful pixels inside an empty container; footage/canvas text still needs visual
review. Scope-local exclusive slots only check the relations actually declared
in the shared plan. Generated custom code must use that plan for its motion.

The user will evaluate the next generated film. Record that result separately
from this implementation's mechanical proof.
