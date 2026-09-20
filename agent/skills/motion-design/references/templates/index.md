# Template motion examples

Use the whole remocn template catalog as a library of authored motion. Select by
the viewer's task and the relationship between states. The brief, supplied
references and brand determine the film; a template supplies a worked example.
Catalog coverage means all templates are available, not all appear in each video.
Use the index to shortlist candidates and stop source inspection once each planned
shot has a suitable implementation. Inspect new candidates only for a remaining
capability gap; an exhaustive source survey is not part of building a film.

## Find the relevant study

| Viewer task / motion decision | Study | Passages to investigate |
| --- | --- | --- |
| Follow a product action into a changed state; travel from overview to detail | [Order Flow](order-flow.md) · `fomo-limit-orders` | Phone orbit and light trace; slider becoming a caret; price close-up; confirmation |
| Understand a request, execution and evidence; follow a moving reading target | [Workflow Console](workflow-console.md) · `workflow-console` | Commands and logs; environment carousel; recommendation camera; result chart |
| Discover a product or several works through images, screens and changing scale | [Product Showcase](product-showcase.md) · `launch-anything` | Material type; button becoming a portal; continuous showcase camera; editorial cuts |
| Understand an identity through color, type, images and a recurring mark | [Brand Guidelines](brand-guidelines.md) · `brand-guidelines` | Palette pushing into typography; typing and style cuts; layered collage; flipping closing tiles |
| Anticipate a release through short statements and a dimensional reveal | [Release Teaser](release-teaser.md) · `release-teaser` | Center-out type; close-up material and moving light; pullback into the release lockup |

These are starting routes, not genre restrictions. Center-out type can serve a
sponsor announcement; a palette push can connect two graphic states. A trading
interface or terminal is useful only when that content belongs in the brief.
Pick a primary example for the central gesture and give additional examples
specific jobs. Keep a coherent material, type and motion language across them.
If no passage fits, state the mismatch and author a suitable gesture.

## Resolve the actual source

The studies were checked against remocn revision
`7fa2db1cd29dfb36743e54e3d078dd9107c879a2` on 2026-09-14. Their ranges describe
that source, not mandatory durations or proof that a newer preview is identical.
Use the selected implementation's clock, exports and props as the current truth.

1. Read an existing installed template or a remocn repository made available to
   this task. In the repository, templates live under
   `registry/remocn-templates/<registry-id>/`; installed paths come from the
   registry's file targets. Read `index.tsx`, `motion.ts` and the scene files
   named in the selected study, plus the content/geometry they depend on.
2. Without suitable local source, use the study's published docs and registry
   JSON links. JSON `files[]` carries each file's `path`, `target` and `content`;
   `dependencies` and `registryDependencies` describe installation needs. Inspect
   file names, then extract relevant code. Embedded photographs in `assets.ts`
   should be viewed as images, not dumped into the context as base64 text.
3. Before a new direction, check the Templates entries in the
   [live documentation index](https://remocn.dev/llms.txt), or the available
   repository's `registry/remocn-templates/registry.json`, for additions and
   renames. Consider relevant new templates by reading their docs and source
   with the same process. The five studies are a starting index, not a ceiling.

The HTML docs page linked by each study contains the template preview. Inspect
its relevant passage, an available matching local render, or a render of the
inspected source. Verify which content/version it shows: old reference-brand
renders can have different assets from the current independent templates.
Sample through changes and the neighboring handoff. State when playback or a
matching preview is unavailable; code describes implementation, not observed
visual quality. If source access fails, use inspected available material and
state the limitation rather than inventing an API or blocking unrelated work.

## Adapt the choreography

Use an existing template's props when its complete story fits. For a custom
film, carry a relevant passage's relationships into named, editable components.
Read the actual dependency APIs before installation or reuse; the `remocn` skill
documents registry installation. Keep shared template source intact and make
video-specific adaptations in the project's permitted video/shared folders.

For the selected passage, record in the existing motion document:

- **Source and purpose:** template, source version/path, time range, and the
  viewer task it solves in this video.
- **Preserve:** the shared object or anchor, ordering of attention, property
  timing and velocity behavior that make the gesture legible.
- **Adapt:** copy, brand, assets, element counts, layout, crop and timing derived
  from the actual material. Sample content and colors are replaceable examples.
- **Verify:** what should be visible in the real-content proof, including the
  result and neighboring transition, and which evidence will show a mismatch.

Source frame numbers are measurements on a specific clock. Convert through
seconds when changing fps and keep internal events on one clock; then recalculate
reading windows, stagger completion and dependent handoffs for changed content.
A uniformly scaled landscape template does not establish a portrait layout.

When embedding a template passage, align its in-point and outer transition with
the inner main action. Inspect text/objects in screen space after all parent
transforms, masks and camera motion. Give the main action a visible interval;
captions and outer movement should support its focus. A transition can finish
before an inner reveal or move with it when their combined movement stays clear.

After the complete draft is assembled, use its proof and local correction loop.
Compare the adaptation with the selected
passage for hierarchy, intermediate poses, speed changes, attention handoff and
time to understand the result. Record expected → observed → correction or a
supported difference. A template name, copied curve or successful technical check
does not establish that its choreography survived adaptation.
