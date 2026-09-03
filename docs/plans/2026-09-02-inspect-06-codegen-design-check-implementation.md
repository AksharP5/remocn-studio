# Spec 06: codegen writes for this pane, and `design_check` enforces it

Part of `docs/plans/2026-09-02-inspect-00-overview.md`; read its ground rules
first. Design record: `docs/plans/2026-09-02-inspect-usability-design.md`,
plan item 6 and the "Markup" decision. Effort M. Depends on spec 01 (names
are shown) and spec 05 (the Text field exists).

## Goal

The agent writes markup the pane can open on: one text run is one named
`Interactive.*` text element, typography is literals on that element, a
component that splits text keeps a `text` prop, every exposed curve is
sampled where the scene uses it, instances have unique names. The rules are
enforced by `design_check` findings, not only by prose, because a sentence
that contradicts a loaded skill is a coin flip (the videos project's own
`remocn-test-easing/CurveLanes.tsx:3-8` is that coin landing wrong).

Complaints addressed: 2, 3, 4 for videos generated after this ships.

## Facts the implementer needs

- The prompt is built in `sidecar/claude/conventions.ts`: paragraph 9 of
  `STUDIO_CONVENTIONS` (`:114-139`, tunability) and the `INTERACTIVITY`
  constant (`:201-216`). `conventionsFor(hasSkills, video)` assembles it;
  `sidecar/claude/conventions.test.ts:113-141` pins phrases from both. One pin
  is a sentence the runtime proves false: "cannot be selected in the preview at
  all" (any DOM node is selectable; `withSchema` buys the component's own
  props).
- `sidecar/tools/tunability.ts` is one regex over `easing:` lines, appended as
  prose after `design_check`'s JSON in `sidecar/tools/execute.ts:176-181`. It
  cannot fail a check, false-positives on `Easing.bezier(e0, e1, e2, e3)` and
  on a spread that wraps to the next line, and sees none of the other shapes.
  Sources come from `sidecar/handlers.ts` `videoSources` (`:766-800`): the
  turn's own `src/videos/<slug>/**/*.{tsx,ts,jsx,js}`, never `src/shared/`.
- `sidecar/preview/design.ts` declares `DesignFindingCode` (`:3-21`), the
  severity literals, and excludes `timeline_static` from the browser-side
  finding type (`:159`, `:223`). The review stage's done-condition
  (`shared/pipeline.ts`) is "every mechanical finding fixed or explained".
- The studio's own skills are `motion-design` and `video-lessons`
  (`sidecar/agent/knowledge.ts:16-19`); the other three are vendored and
  `skills:check` reads any edit there as drift. `motion-design/SKILL.md` carries
  three `Interactive.Div` examples with constant easings (`:75-95`, `:127-142`,
  `:227-246`) and a recipe table of Penner names (`:212-223`);
  `rules/easing.md` gives literal beziers.
- `templates/remotion/video-template/index.tsx` is the one file every new
  project starts from; its `easing` array lacks `newItemDefault` (the file is
  outside `tsconfig.json`, which is how that survived), and `RisingText` uses
  `transform: translateY(...)` which both the interactivity skill and
  `video-lessons` §2 forbid.

## Changes

### 1. `sidecar/claude/conventions.ts`

Replace paragraph 9 (from "A component you write new must be tunable" through
"never fail the turn over it.") with:

```
A component you write new must be tunable by someone who does not read code,
and the preview's properties pane edits only what the markup hands it. Every
run of text a person might change — a headline, a caption, a label, one line of
a stack — is one `Interactive.H1`, `Interactive.P` or `Interactive.Span` whose
direct child is the string, with its font size, weight, colour, letter spacing
(a number, in px) and line height written as literals in its own `style`, and
a `name` that is unique in the frame and equals its `data-design-id`; inside a
`.map()` the name carries the index or the content. A component that splits a
run into words for staggering keeps the split inside and takes the whole string
as one `text` prop; on Remotion 4.0.513 or newer declare it in the schema as
`type: "text-content"` so the pane edits it live. Everything else a person
might want to change — colors, durations, amplitudes — is a typed prop with its
default written inline where the prop is declared, never a constant buried in
the body. Keep top-level composition input props in a Zod schema (colors as
`zColor()` from `@remotion/zod-types`). Every nested scene, element and
transition wrapper you write declares an `InteractivitySchema` from `remotion`,
exports through `Interactive.withSchema()`, accepts its generated `controls`
prop, and passes it to its owning `<Sequence controls={controls}
outlineRef={outlineRef}>`; a file exports only the wrapped component. A custom
effect describes its parameters with the same `InteractivitySchema`, giving
every parameter a type, range, default and description. Every animated
component you create exposes its easing the same way — always, not only when
asked: a prop named `easing` (or ending in `Easing`), with an inline default,
routed into the component's own `interpolate()` calls. It is **always a
four-number cubic-bezier array**, declared as `type: "array"` with `minLength`
and `maxLength` of 4, `newItemDefault: 0` and a `number` item bounded
`min: -0.5, max: 1.5, step: 0.01`, defaulting inline to something like
`[0.33, 1, 0.68, 1]`, and spread into `Easing.bezier(...easing)`. Never an
enum of easing names: the studio draws that array as a timing curve whose
handles are **dragged** to shape the motion, and an enum can hold one of its
own names and nothing else. A curve exists only where it is sampled: name its
window beside it (`entryFrames` next to `entryEasing`, `exitAt` next to
`exitEasing`), and a movement that is off by default keeps its curve under an
enum variant (`exit: { none: {}, fade: { exitAt, exitFrames, exitEasing } }`)
so the pane offers it only when it runs. A `spring()` is not an easing: expose
its `damping` and `stiffness` as number props instead.
`mcp__remocn-design__design_check` reads your video's source and reports each
of these as a finding you fix like any other. This is for components you
create: do not rewrite an existing component around a schema unless the person
asks for that. When the project's Remotion is too old to express what this
needs, keep the same props-with-inline-defaults discipline and skip the part
its version cannot express — never fail the turn over it.
```

Replace the `INTERACTIVITY` constant's text with:

```
When you write or restructure Remotion markup, invoke the bundled
`remotion-interactivity` skill for what it gets right here — `scale`, `rotate`
and `translate` instead of `transform`, styles written inline on the element, a
descriptive `name` — and know that it is written for Remotion Studio, which
edits the call site in your source; this studio edits props at runtime. Two of
its rules are therefore reversed above: the easing comes from the component's
`easing` prop, never a hardcoded value, and a run of text that a component
splits into words is a `text` prop rather than inline children. Its "no
spreads, constants or math" rule does not apply here: the studio reads the
rendered props, so a style built from a prop is edited the same as a literal.
Where the bundled `motion-design` or `video-lessons` skill shows a constant
curve or a bare `spring()`, keep their motion and give it this paragraph's
shape.
```

Keep every other paragraph. Measure the size before and after with
`conventionsFor(true, "x").length` in a test and record it in the PR; the net
change should be near zero or negative.

`sidecar/claude/conventions.test.ts`: replace the pin
`cannot be selected in the preview at all` with `whose direct child is the
string` and `unique in the frame`; add pins for `newItemDefault: 0`,
`text-content`, `is not an easing`, `only where it is sampled`; the existing
pins (`Zod schema`, `zColor()`, `InteractivitySchema`, `unless the person asks`,
`Every nested scene, element and transition`, `exposes its easing`, `always,
not only when asked`, `ending in \`Easing\``, `always a four-number cubic-bezier
array`, `Never an enum of easing names`, `Easing.bezier(...easing)`) all
survive in the text above; keep them.

### 2. `sidecar/tools/tunability.ts`: from one regex to a rule set

Export `tunabilityFindings(files): TunabilityFinding[]` where
`TunabilityFinding = { file: string; line: number; rule: TunabilityRule; snippet: string }`
and `TunabilityRule` is one of:

1. `constant-easing` (error). The existing scan, fixed: read the value to the
   matching close paren when `easing:` is followed by `Easing.bezier(` or
   `Easing.out(` and the line ends inside the call; treat `Easing.bezier(` whose
   arguments are all identifiers or a spread as prop-fed, not constant.
2. `constant-spring` (info). `spring({ … config: { damping: <number>` in a
   file that declares a schema with no `damping` or `stiffness` key.
3. `plain-text-element` (warning). A text run whose nearest element ancestor
   is a plain `h1`–`h6`, `p`, `span` or `div` **and** has no `Interactive.`
   ancestor within the same JSX expression. A text run is a string literal
   child or a `{identifier}` child whose identifier is `text`, `children`,
   `label`, `title`, `line`, `word` or ends in `Text`. Implement with a small
   tag-stack scanner: brace-aware `openTagEnd` (a `>` inside `style={{ … }}`
   is not the tag's end; `SceneStage.tsx` has ``filter: `blur(${interpolate(…``
   inside an open tag) and a per-file stack of open tags.
4. `mapped-primitive-name` (error). An `<Interactive.` open tag with a
   string-literal `name="…"` inside the paren-balanced body of a `.map(`
   call. Balance parens so `.map(…).join(", ")` ahead of an unrelated primitive
   (`LineChart.tsx`, `LabBackdrop.tsx` in the corpus) does not match.
5. `inert-easing` (info). A schema key ending in `Easing` whose sibling key
   named `<prefix>At`, `<prefix>Frames`, `<prefix>In` or `<prefix>Out` (same
   prefix) has `default: 0`, or whose only use in the file sits behind a
   ternary on such a prop (`hasX ? interpolate(… easing …) : 0`). Worded as a
   question: "is this curve ever sampled with the values you pass? Scope it
   under an enum variant."
6. `controls-not-forwarded` (error). A file that calls `Interactive.withSchema`
   and contains no `controls={controls}`.
7. `raw-export` (error). `export const|function <Name>` where `<Name>` is the
   `Component:` argument of `Interactive.withSchema` in the same file.

`tunabilityDesignFindings(findings): DesignFinding[]` maps each to the
`DesignFinding` shape with `code: "tunability_<rule>"`, the rule's severity,
`frames: []`, `bbox: null`, `selector: null`, `text: null`, `observed:
"<file>:<line> — <snippet>"`, and a `fix` sentence quoting the relevant rule
from paragraph 9. Extend `DesignFindingCode` in `sidecar/preview/design.ts`
with the seven `tunability_*` literals and exclude them from the browser-side
finding type the way `timeline_static` is.

`sidecar/tools/execute.ts` `designCheck`: replace the trailing prose with a
merge: `findings: [...result.findings, ...found]` and `summary` counters
incremented per severity (read the result's summary shape in
`sidecar/preview/design.ts` and match it). `easingReport` and `easingFindings`
go away; keep `hardcodedEasings` as the implementation of rule 1.

Tests (`sidecar/tools/tunability.test.ts`): keep the existing eight cases for
rule 1; add one positive and one negative per rule with fixtures copied in
shape from the corpus: `WordPush.tsx` (Interactive.Div around `words.map`
spans: no plain-text finding, since the nearest Interactive ancestor exists),
`RevealText.tsx` (`{children}` inside `Interactive.Div`: none),
`ClaimScene.tsx` (`roles.map` → `<Interactive.Div name="Role slot">`:
mapped-primitive-name), `SceneStage.tsx` (`exitAt` default 0 beside
`exitEasing`: inert-easing; the ``blur(${interpolate(`` open tag must not break
the scanner), `LineChart.tsx` (`.map().join` before a primitive: no match),
`test-props/Title.tsx` (enum easing: no constant finding, but no array either;
out of scope for the scan), a component with `<h1>{text}</h1>` and no
Interactive ancestor (plain-text-element), a raw export, a missing
`controls={controls}`. `sidecar/tools/execute.test.ts`: `design_check` merges
findings and counts. Run the scan over every video in the videos project once
and record the per-video counts in the PR as the baseline (the prototype
measured 14 on vidrush).

### 3. The studio's own skills

- `agent/skills/motion-design/rules/tunable-text.md` (new): one worked,
  typechecked component pair: a `Headline` exported through
  `Interactive.withSchema` whose schema has `entryEasing` (bounded array,
  `newItemDefault: 0`), `entryFrames`, `slideFrom`, and an `exit` enum variant
  `{ none: {}, fade: { exitAt, exitFrames, exitEasing } }`; its body renders
  `<Interactive.H1 name={name} data-design-id={name} style={{ fontSize: 96, fontWeight: 700, color: "#…", letterSpacing: -1.5, lineHeight: 0.95, translate: … }}>{text}</Interactive.H1>`
  with X-only travel through `Easing.bezier(...entryEasing)`; a `Stack` that
  renders three `Headline`s with distinct names rather than `lines.map`; a
  `Words` component that splits `text` into plain spans and declares
  `text: { type: "text-content" }` behind a comment naming 4.0.513 as the
  floor; and a section "what this cannot give you below 4.0.513". Typecheck
  the file against the videos project's `node_modules` (`tsc --noEmit` with a
  scratch `tsconfig` whose `paths` point there) and against the packed 4.0.520
  if available; it must pass rule set 2 with zero findings and be added as a
  fixture to `tunability.test.ts`.
- `agent/skills/motion-design/SKILL.md`: the three examples become bodies of
  schema components with `easing: Easing.bezier(...entryEasing)` and unique
  names; the recipe table keeps its intents and gives each as the array
  default of an `easing` prop (`[0.25, 0.46, 0.45, 0.94]` quad-out,
  `[0.33, 1, 0.68, 1]` cubic-out, `[0.16, 1, 0.3, 1]` expo-out,
  `[0.37, 0, 0.63, 1]` sine-in-out) beside the Penner name; §12's rules index
  lists the new page. `rules/easing.md`: the literal beziers stay, each
  sentence saying "as the inline default of the component's `easing` prop".
- Do not touch the vendored skills; `bun run skills:check` must stay green.
  `sidecar/agent/knowledge.test.ts` pins the shipped list; nothing changes
  there.

### 4. The template

- `templates/remotion/video-template/index.tsx`: `titleSchema` gains
  `"style.fontWeight"` (number, 100–900, step 100, default 600),
  `"style.lineHeight"` (number, default 1.1) and `"style.letterSpacing"`
  (number, px, default 0); `easing` gains `newItemDefault: 0`; `RisingText`
  drops `transform: translateY(...)` for `translate: \`${…}px 0px\`` on X, and
  its literals equal the schema defaults with `...style` spread last;
  `TitleProps.children` stays `ReactNode` (the template's h1 is inside a schema
  component and is the good case the corpus found). If the project's Remotion
  is 4.0.513 or newer after spec 05, the `<h1>` becomes `Interactive.H1` with
  `name` and `data-design-id`; gate that on spec 05 having landed.
- `sidecar/scaffold/template.test.ts`: pin `newItemDefault`, the three new
  keys, and the absence of a `transform:` string in the video template.

## Acceptance

1. `conventionsFor(true, "x")` is no longer than before, and every pinned
   phrase is present (`bun run test -- sidecar/claude/conventions.test.ts`).
2. `design_check` on `remocn-vidrush-sponsor` reports the baseline counts; on
   the worked `Headline` fixture it reports zero.
3. In the running app, ask the agent for a new one-line title in a fresh
   video: the generated component has a named `Interactive.H1` with literal
   typography, an `easing` array with `newItemDefault`, and the pane opens on
   it with the Typography group (on a 4.0.513+ project) and the name as its
   title.

## Out of scope

Regenerating the person's existing videos. AST parsing (the regex scanner is
enough for these shapes; an AST would add megabytes to the sidecar bundle).
`src/shared/` in the source walk (another chat's code, by design).

## Verification

`bun run check`, `bun run typecheck`, `bun run test`, `bun run skills:check`,
`bun run changeset`. Update CLAUDE.md "What the agent knows" and "Tuning what
you pointed at" where they describe the old scan and the two-wrapper rule.
