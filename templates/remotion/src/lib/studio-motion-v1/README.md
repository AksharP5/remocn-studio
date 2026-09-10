# Studio motion foundations v1

Use these movements when they fit the brief. The agent owns ordinary timing,
framing, reading intervals and handoffs; the user supplies the message, materials
and preferences. Choose the art direction from those inputs. The three full-frame
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
import { PhraseSequence } from "../../lib/studio-motion-v1/recipes";
import { phrasePlan } from "../../lib/studio-motion-v1/plans";
import { durationFrames } from "../../lib/studio-motion-v1/timing";

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

1. Build the hardest short combination with the intended assets and final size.
2. `checkTiming(plan, enclosingFrames, fps)` must report no accidental truncation
   or unallocated tail. Recipes execute this check while rendering.
3. Render the proof. `reviewFrames(plan, fps)` lists event neighbours and reading
   intervals to inspect alongside real-time playback. Check long lines, crop,
   ownership of a shared object, the adjacent transition and the final hold.
4. Correct the identified defect, then recheck the affected neighbours. Preserve
   Studio's `design_check`, source provenance and final video review.

Source tests cover time math, reading budgets, group completion and seeking. The
Studio repository also has `bun run motion:proof`: it stages this exact source in
an isolated project, typechecks it, renders a matrix of text/image/metric cases,
saves event PNGs and compares 30/60 FPS renders at equal wall-clock times. Results
include source hashes. A mechanical pass does not judge art direction or audio;
review the video before treating a combination as suitable for a real brief.
