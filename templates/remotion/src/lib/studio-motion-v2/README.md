# Studio motion foundations v2

Use these movements when they fit the brief. The agent owns ordinary timing,
framing, reading intervals and handoffs; the user supplies the message, materials
and preferences. Choose the art direction from those inputs. The full-frame
examples are optional compositions, not a house style for every video.

This directory is owned by Studio and copied into each project. Imports stay local;
there is no service call, remote registry or additional dependency. Opening an
existing project fills missing files without overwriting authored copies. Keep an
installed version stable for existing films; use a new version for incompatible
changes. Validated with Remotion 4.0.520, React 19.2.3 and Zod 4.4.3. On an older
project, check its interactivity support before importing TSX; keep its packages
aligned and do not silently upgrade the project.

## Pick a starting point

| Content need | Code | What it coordinates | Poor fit |
| --- | --- | --- | --- |
| Several short statements | `phrasePlan` + `PhraseSequence` | Reveal, settled reading, exit, transfer of one reading position | Dense paragraphs, subtitles or rapid word percussion |
| A title introduces a real image | `imagePlan` + `ImageSequence` | Title, image mask and scale, caption after picture resolves | A UI interaction or footage edit needing action cues |
| A nonnegative integer relative to a known maximum | `metricPlan` + `MetricSequence` | One progress for number and bar, then that same bar fills the next scene | Unbounded values, decimals, negative statistics, unrelated next shot |
| Heading with supporting items | `detailsPlan` + `DetailsSequence` | Group entry, reading after the last item and coordinated exit | More than eight items or dense explanatory prose |
| Work images become an overview | `cardsPlan` + `CardsSequence` | Caption reading and exit, persistent card owners, then grid handoff | More than six images or a case that requires interaction/footage |
| Custom composition or different layout | `MotionText`, `sequence`, `revealAt`, `mixRect`, `scaleBetween`, `valueAt` | Bounded movements; caller supplies geometry and styling | Physical simulation or complex 3D |

`MotionText` takes a single editable `text`, a `box` in composition pixels, a
`beat` and typography. `mask`, `rise`, `fade` and `blur` use the same time contract;
choose a gesture for the intended visual language. Word splitting preserves
whitespace and graphemes. Group stagger stays inside the entry budget, even when
the text gets longer. Loaded-font measurement fits the same DOM that is rendered.
If the minimum type size cannot fit, rendering fails with the affected copy;
shorten it or change the layout rather than hiding the overflow.

## Integrate in a registered video

For `src/videos/<slug>/index.tsx`:

```tsx
import { PhraseSequence } from "../../lib/studio-motion-v2/recipes";
import { phrasePlan } from "../../lib/studio-motion-v2/plans";
import { durationFrames } from "../../lib/studio-motion-v2/timing";

const plan = phrasePlan([
  "Start with your material.",
  "Give the idea room to move.",
]);
export const meta = {
  width: 1920, height: 1080, fps: 30,
  durationInFrames: durationFrames(plan.duration, 30),
};
export default function Video() {
  return <PhraseSequence plan={plan} fontFamily="Arial" color="#24201c" background="#f6f1e8" />;
}
```

Replace the example font and palette with the actual brand. Declare/load a local
font through the project's existing method before rendering. Use a font with the
required glyphs. Load images through Remotion `staticFile` or the project's asset
resolver; the library renders them through `Img` and waits for them. Inspect the
crop at the final aspect ratio and adjust `objectPosition` when needed.

`imagePlan(title, caption)` works with `<ImageSequence plan={plan} src={...} />`.
`metricPlan(82, "Tasks completed", "Ready for the next step")` works with
`<MetricSequence plan={plan} maximum={100} suffix="%" />`: 82 fills 82% of the
available bar. Use factual supplied data; never invent a statistic to fit a shot.

For a sequence embedded in a larger film, compute `frames = durationFrames(plan.duration, fps)`
and give the *same* value to the outer Remotion `Sequence.durationInFrames` and
recipe `availableFrames`. The outer `Sequence.from` places it; the recipe reads
local time. An intentional outgoing cut is valid. Inspect the adjacent shot;
these examples end on a settled result and do not choose the next edit for you.

## Timing contract

Author in seconds. `sequence([{ id, enter, hold, exit, overlap? }, ...])` returns
beats with `start`, `settled`, `exitStart`, `end` and a total `duration`.
`secondsAt(frame, fps)` samples local time; `durationFrames` rounds the enclosing
budget up. Never accelerate the whole timeline merely to force long copy into a
fixed duration: revise the copy, the staging or the allocation of time.

The default overlap consumes only the shared exit/entry interval. A reading hold
cannot be borrowed. Phrase replacement explicitly uses zero overlap because the
same screen position cannot carry both phrases legibly. Geometry handoffs can
use an overlapping interval when one layer owns the shared object.

`readingSeconds` estimates from words and graphemes with a small acquisition pause.
It is a starting estimate, not a comprehension measurement. `energy: "brisk"`
shortens gestures without shortening reading. For speech, derive the plan from
the actual voice track instead of treating this estimate as audio synchronization.

All motion is sampled from frame time, including backward seeks. There are no
CSS transitions, accumulated state or random timing. Typography, colors, image,
effects and actual cubic-bezier props remain editable through `Interactive.withSchema`.
Rebuild the plan after changing copy or content; a properties-panel text override
alone cannot allocate a longer composition. Duration and beat structure remain
code-authored in this first version.

## Verify the actual sequence

1. Build the passage selected to demonstrate the film's motion idea, event
   relationships and rhythm, with the intended assets and final size. Include a
   difficult combination when that direction depends on it.
2. `checkTiming(plan, enclosingFrames, fps)` must report no accidental truncation
   or unallocated tail. Recipes execute this check while rendering.
3. Render the proof. `reviewFrames(plan, fps)` lists event neighbours and reading
   intervals to inspect alongside real-time playback. Check long lines, crop,
   ownership of a shared object, the adjacent transition and the final hold.
4. Correct the identified defect, then recheck the affected neighbours. Preserve
   Studio's `design_check`, source provenance and final video review.

Source tests cover time math, reading budgets, group completion and seeking.
The Studio repository also has `bun run motion:contract-proof`: it stages this
runtime in an isolated project, typechecks it, renders the combinations, and runs
the actual browser checker against valid and deliberately broken transitions.
Reports include source identity and unvisited boundaries. A mechanical pass does
not judge art direction or establish fewer user corrections.

## Runtime review contract

The supplied combinations emit `MotionReview` automatically. The full checker
reads its manifest from the rendered tree and prioritizes neighboring frames of
entry completion, reading and exit. It compares the targets to those promises.
`readFor` is an estimated reading budget; `slot` declares an exclusive reading
position; `parent` references the cue whose lifetime contains this cue.

For custom code, use one plan to drive both animation and review:

```tsx
import { MotionReview, MotionText, useCue, staggeredGroup, after,
  readingSeconds, durationFrames } from "../../lib/studio-motion-v2";

const words = "We find ways of business growth".split(" ");
const { group, members } = staggeredGroup({
  id: "statement", count: words.length, enter: 0.32, enterStagger: 0.06,
  hold: readingSeconds(words.join(" ")), exit: 0.24, exitStagger: 0.06,
  slot: "headline",
});
const nextStart = after(group); // includes the LAST word's exit
// Use members[i].start/settled/exitStart/end for each word's own animation.
// Include group + members + the following beats in the full sequence plan.
```

`MotionText` binds itself with `useCue`. A custom target calls `const cue =
useCue(beat)` and spreads `<div {...cue} ...>` onto its real visible element.
A group uses a real containing element; a child gets its own cue. Each cue needs
exactly one rendered owner within its review scope. Cues that intentionally share
a position simultaneously should not declare that position as exclusive.

Wrap the **whole** sequence with `<MotionReview plan={plan}>` using the actual
`plan`, adding `availableFrames={frames}` when nested. Keep this wrapper mounted outside child
conditions and handoffs. The outer Remotion `Sequence` sets the local clock;
review discovers its composition offset from the rendered frame. Give the same
`frames` to that Sequence and `availableFrames`. A composition-level custom wrapper
can cover multiple beats. Do not emit a second hand-maintained timing document as
the runtime contract.

When copy changes, rebuild the plan from those props. If the fixed composition
window is now too short, simplify/regroup the content or change its allocation.
The render's metadata must use that same resolved plan; inspect the project's
`calculateMetadata` support when duration depends on editable input props.

The check reports malformed/changing contracts, exclusive-slot collisions,
parent/window truncation, estimated reading deficits, duplicate targets and
removed/hidden targets during promised intervals. It cannot establish whether
an image explains the message, whether an empty container contains useful pixels,
or whether text burned into footage is readable. Pixel and text checks supplement
it; inspect actual playback and the important frames at realistic player size.

Inspect `readiness.coverage.motion`: `contracts`, `cues`, `boundaries`, `unvisited`,
`uncovered` and `invalid`. A missing contract or unvisited boundary is not a successful check.
Increase frame/time budgets when needed. Complete the pipeline review with the
full check's `reviewReportId`; Studio reloads the report against current sources.
Keep report ids in the video's production notes instead of copying stale verdicts.

## Heading/details and cards

```tsx
const services = detailsPlan("Branding", [
  "Brand identity", "Guidelines", "Packaging", "Illustrations",
]);
// <DetailsSequence plan={services} fontFamily={brandFont} ... />
const works = cardsPlan([
  { id: "one", src: staticFile("case-one.jpg"), title: "A clear view of the work", label: "Project one" },
  { id: "two", src: staticFile("case-two.jpg"), title: "A different application", label: "Project two" },
]);
// <CardsSequence plan={works} fontFamily={brandFont} ... />
```

Use these as starting combinations, not a required scene order. For a different
layout, keep `services.heading`, `services.details`, `works.cards` and `works.grid`
as the clocks while drawing your own composition. The final caption's `end`
equals `grid.start`; each card owner survives through the grid's end.
The card geometry settles at `gridMoveEnd`, then labels reveal; their reading
budget starts at `grid.settled`. Use short labels and inspect the final grid with
the actual copy, crops and aspect ratio.
