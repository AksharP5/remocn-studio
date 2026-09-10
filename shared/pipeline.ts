import { Schema } from "effect";

export const PIPELINE_STAGE_IDS = [
  "analysis",
  "brand",
  "script",
  "motion",
  "build",
  "choreography",
  "review",
] as const;

export const PipelineStageId = Schema.Literals(PIPELINE_STAGE_IDS);

export type PipelineStageId = (typeof PipelineStageId)["Type"];

export const PIPELINE_STATUSES = ["pending", "active", "done"] as const;

export const PipelineStatus = Schema.Literals(PIPELINE_STATUSES);

export type PipelineStatus = (typeof PipelineStatus)["Type"];

export const PipelineStage = Schema.Struct({
  stage: PipelineStageId,
  status: PipelineStatus,
});

export type PipelineStage = (typeof PipelineStage)["Type"];

// Everything a video owns lives in the video's own folder, so deleting the
// folder takes the documents with it and two videos in one project cannot
// overwrite each other's script. The templates below carry the two folders as
// tokens rather than literals, because the slug is only known once a turn
// names its video — and the same two functions answer for the prompt and for
// the viewer that reads the files back.
export const VIDEO_TOKEN = "{video}";
export const DOCS_TOKEN = "{docs}";

export const DOCS_DIR = "docs";

const UNNAMED_VIDEO = "<this video>";

export function videoFolderOf(slug: string | null): string {
  return `src/videos/${slug ?? UNNAMED_VIDEO}`;
}

export function docsFolderOf(slug: string | null): string {
  return `${videoFolderOf(slug)}/${DOCS_DIR}`;
}

export function withVideoFolder(text: string, slug: string | null): string {
  return text
    .replaceAll(DOCS_TOKEN, docsFolderOf(slug))
    .replaceAll(VIDEO_TOKEN, videoFolderOf(slug));
}

export interface StageTemplate {
  readonly activeForm: string;
  readonly ask: string;
  readonly checklist?: readonly string[];
  readonly discover: string;
  readonly doneWhen: string;
  readonly goal: string;
  readonly id: PipelineStageId;
  readonly outputs: readonly string[];
  readonly title: string;
}

export const STAGE_TEMPLATES: readonly StageTemplate[] = [
  {
    activeForm: "Analysing the material",
    ask: "Ask for the topic, the audience, the target duration, and any material to build from. Ask concrete questions, one message.",
    discover:
      "Check {docs}/analysis.md. If it is missing, look at what the folder already holds: source material, a README, existing scenes — anything that says what this video is about.",
    doneWhen:
      "{docs}/analysis.md names the audience, one promise or message, the target format/duration, actual source assets and any missing assets. Select one primary reference when supplied, record observed timestamps and decisions to inherit, and give secondary references specific roles. Without references, state a concrete direction from the brief and brand. Separate observations, user requirements and assumptions.",
    goal: "Work out what is given: the material, the topic, the audience and the target duration.",
    id: "analysis",
    outputs: ["{docs}/analysis.md"],
    title: "Analysis",
  },
  {
    activeForm: "Collecting the brand",
    ask: "Use the video brand snapshot first. Ask only for unknown fields needed by this video: name, authoritative sources, colors, or tone. Explicit user instructions take priority and remain local exceptions.",
    discover:
      "First use known snapshot colors, typography, tone and original public/brand assets with provenance. They do not need to be copied again. A complete snapshot can finish identity collection without stock photography or a new font pairing. Moodboard supplements the brand with imagery/composition and never overrides it. Without a snapshot, call mcp__remocn-library__get_moodboard first: an existing moodboard comes back as its spec and rendered PNG — work from its palette and typography, never regenerate it. When none exists, create one only if unresolved imagery or art direction needs it. Use mcp__remocn-library__search_stock only for assets the chosen direction uses, preserve known brand typography and colors, then call mcp__remocn-library__save_moodboard and inspect its PNG when creating a moodboard. A typography piece needs no stock-photo quota or new font pairing. Then check {docs}/brand.md, and inspect the project for logos, css tokens, a README, and every authoritative URL it mentions. Work source-first for each identity asset: recover the original file from a direct download, img/srcset or linked SVG and copy it unchanged into {video}/assets/. Record the source beside the local path in {docs}/brand.md. If the source exposes no usable original after you check those locations, call mcp__remocn-pipeline__request_source_asset; a newly drawn, traced or restyled replacement cannot complete this stage.",
    doneWhen:
      "{docs}/brand.md names concrete colors, fonts and tone, every required identity asset has an unchanged local file in public/brand or {video}/assets/ with provenance, and any unknown fields needed for this video are resolved. A complete video brand snapshot does not require a new moodboard. brand.md describes this video only; it must not overwrite Project settings.",
    goal: "Collect the visual language: palette, fonts, logos and tone.",
    id: "brand",
    outputs: ["{docs}/brand.md", "{video}/assets/"],
    title: "Brand",
  },
  {
    activeForm: "Writing the script",
    ask: "Ask only if the intended message or audience remains unresolved. Own the ordering, pacing, transitions and routine movement decisions using the supplied scenario and material.",
    discover:
      "Check {docs}/script.md. If it is missing, read {docs}/analysis.md and any draft the person left in the folder, then write from those. Select concrete source material that conveys the promise. For each beat record the viewer takeaway or intended feeling, the actual asset or copy that carries it, the focal subject, and why the following beat belongs. Turn website material into a film according to the brief; section order and navigation labels are source context, not an automatic screenplay.",
    doneWhen:
      "Every shot in {docs}/script.md has its message, visible starting state, action or transformation, result and reading window. Distinguish shots from beats inside a continuous shot. Name the actual assets, copy or UI states that support the message and distinguish essential reading from background detail. Check when the distinctive material first appears and whether preceding beats earn their time; there is no universal deadline or case-study quota. Durations add up to the target with transition overlap accounted for.",
    goal: "Write the script scene by scene: what is said, what is on screen, and for how long.",
    id: "script",
    outputs: ["{docs}/script.md"],
    title: "Script",
  },
  {
    activeForm: "Defining the motion language",
    ask: "Choose the motion language from the established brief and references. Ask only if a missing decision materially changes the film; internal visual checks need no separate approval.",
    discover:
      "Read {docs}/analysis.md, {docs}/brand.md and {docs}/script.md, then inspect the selected reference and any existing {docs}/motion.md. Reuse existing production assets where suitable; verify that footage, UI states and dimensional materials can support the intended shots.",
    doneWhen:
      "{docs}/motion.md records the chosen visual language and the inspected keyframes under {video}/assets/keyframes/: starting state, central action/transformation and result, or the distinct states of a shorter piece. Compare hierarchy, framing, type and material with the primary reference at delivery size; resolve weak framing and missing assets. Specify the hardest short proof to build next, including event order, camera targets, object handoffs and reading windows. Still holds and cuts are valid choices.",
    goal: "Prove the visual direction in keyframes and plan the central action before expanding the timeline.",
    id: "motion",
    outputs: ["{docs}/motion.md", "{video}/assets/keyframes/"],
    title: "Motion",
  },
  {
    activeForm: "Building the video",
    ask: "Ask only when the script or the motion language leaves a scene ambiguous — name the scene and the ambiguity.",
    checklist: [
      "Proof first. Build and render the hardest action with its neighboring transition and result, typically 6-8 seconds or the whole piece if shorter. Save it under {video}/assets/proof/ and inspect it in motion before expanding the timeline.",
      "Review the proof. Compare with the primary reference for hierarchy, causality, object continuity, framing and reading time. For UI, verify cursor arrival, activation, visible response and camera target on one event timeline. Record the source version, render settings, observed defects and fixes in {docs}/motion.md. Correct the staging before adding effects or building the remaining shots.",
      "Expand. Build the remaining film from the inspected direction, reusing geometry and event dependencies. Keep the result editable and check adjacent beats after changing shared timing or components.",
    ],
    discover:
      "Read {docs}/script.md and {docs}/motion.md, then check what of the video already exists in src/. For text, image reveals or graphic handoffs, inspect src/lib/studio-motion-v2/README.md and reuse suitable movements or combinations; preserve the chosen art direction. Derive the enclosing duration from the plan, run checkTiming, and publish its runtime contract through MotionReview; custom targets use useCue and the same beats as the animation. Keep the review wrapper mounted across child handoffs. The v2 README covers phrases, heading/details, image/caption, card-to-grid and custom groups. Recompute with actual copy and font; resolve an overfull duration through selection, grouping or layout before accelerating reading. The full checker discovers event boundaries from the rendered composition.",
    doneWhen:
      "The proof and its observed review are recorded in {docs}/motion.md with source identity. Runtime contracts bind the actual elements and include adjacent handoffs; the preview compiles, every scripted shot is present, and the total duration matches the script. The completed film carries the direction established by the inspected proof.",
    goal: "Verify the hardest short sequence, then build the full editable video in this video's registered composition.",
    id: "build",
    outputs: ["{video}/", "{video}/assets/proof/"],
    title: "Build",
  },
  {
    activeForm: "Choreographing the whole video",
    ask: "Ask only when a scene's meaning is unclear enough that you cannot tell which beat should carry the accent — name the scene and the ambiguity.",
    checklist: [
      "Rhythm. Match the selected direction and give actions and results enough time to read. Equal durations and still holds can be appropriate. If audio exists, compare meaningful visual accents with preparation, impact and release cues in the actual mix; do not derive cuts from every amplitude peak.",
      "Continuity. Inspect each handoff and cut for the intended relationship. Shared objects keep their geometry and identity; a bridge lives outside the Series it spans. A hard cut may introduce a new subject without any persistent layer. Distinguish shots from beats inside a continuous shot.",
      "Reading. Inspect the interval after each action: the result must be visible and understandable at realistic viewing size. A completed element may remain still. Fix a stalled promised action, obscured result or premature exit rather than adding automatic drift.",
      "Order of arrival. Verify the causal sequence and attention hierarchy. For UI, show the target, cursor activation, visible response and result. Group elements that form one object; use stagger only when separate arrivals help the viewer.",
      "Camera. Frame the intended subject and retain the context needed to identify it. A camera move should reveal, follow or reframe something; a locked camera is valid. Inspect the target and result for clipping, scale jumps and loss of detail.",
    ],
    discover:
      "Read {docs}/script.md and {docs}/motion.md, then inspect the rendered sequence and call mcp__remocn-design__design_check with the whole video's scene map in `video`. A map can contain one continuous shot. Use motion assertions only for explicitly intended behavior; rhythm, shared-layer and camera summaries are diagnostics, not creative requirements.",
    doneWhen:
      "{docs}/choreography.md records the pass scene by scene, and design_check's whole-video findings are either fixed or answered in one line each.",
    goal: "Review the film end to end for readable actions, meaningful transitions and coherent framing against the selected direction.",
    id: "choreography",
    outputs: ["{docs}/choreography.md", "src/"],
    title: "Choreography",
  },
  {
    activeForm: "Reviewing the result",
    ask: "Complete the internal review using the brief and existing notes. Ask only about an unresolved creative decision that needs the person's judgment; record feedback in {docs}/review.md.",
    discover:
      "Check {docs}/review.md for notes already taken, and compare the built video against {docs}/script.md scene by scene.",
    doneWhen:
      "Every note in {docs}/review.md is closed or explicitly deferred by the person, and design_check has run with mode=full over the whole scene map, including the actual audio mix. Review its coverage, failed/skipped checks and stale flag; fix measured viewer defects or record narrow intentional exceptions. Recheck after changes, including all scenes affected by shared components. Also compare the rendered film with the primary reference or declared direction for hierarchy, causality/progression, continuity, reading time and visual coherence. Record the reviewed export path, source version or content hash, render settings, report id and specific limitations in {docs}/review.md. Mark review done with reviewReportId from the full check: Studio reloads it against current sources and requires completed coverage, checked runtime event boundaries and no unresolved measured viewer errors. Fix incomplete coverage with an adequate frame/time budget. Copied report JSON and prose cannot substitute for revalidation. A passing check is not a creative verdict. Style recommendations never block human export.",
    goal: "Review the result against the script, collect notes, and close them.",
    id: "review",
    outputs: ["{docs}/review.md"],
    title: "Review",
  },
];

export function stageTemplate(id: PipelineStageId): StageTemplate {
  const found = STAGE_TEMPLATES.find((template) => template.id === id);
  if (found === undefined) {
    throw new Error(`there is no pipeline stage called ${id}`);
  }
  return found;
}

export function startedStages(): readonly PipelineStage[] {
  return PIPELINE_STAGE_IDS.map((stage, index) => ({
    stage,
    status: index === 0 ? "active" : "pending",
  }));
}

export function orderedStages(
  rows: readonly PipelineStage[]
): readonly PipelineStage[] {
  const byId = new Map(rows.map((row) => [row.stage, row]));
  return PIPELINE_STAGE_IDS.flatMap((stage) => byId.get(stage) ?? []);
}

export function activeStage(
  stages: readonly PipelineStage[]
): PipelineStage | null {
  return stages.find((row) => row.status === "active") ?? null;
}

export function pipelineDone(stages: readonly PipelineStage[]): boolean {
  return stages.length > 0 && stages.every((row) => row.status === "done");
}

export interface StageDocument {
  readonly name: string;
  readonly stage: PipelineStageId;
  readonly title: string;
}

const MARKDOWN = /\.md$/;

// The order the tabs stand in, and the only place that knows which stage a
// document belongs to. It is derived from `outputs` rather than listed beside
// it, so a stage that gains or renames a document cannot leave the viewer
// naming a file nothing writes.
export function stageDocuments(): readonly StageDocument[] {
  return STAGE_TEMPLATES.flatMap((template) =>
    template.outputs.flatMap((output) =>
      output.startsWith(`${DOCS_TOKEN}/`) && MARKDOWN.test(output)
        ? [
            {
              name: output.slice(DOCS_TOKEN.length + 1),
              stage: template.id,
              title: template.title,
            },
          ]
        : []
    )
  );
}

export function resolveStage(
  template: StageTemplate,
  slug: string | null
): StageTemplate {
  const said = (text: string) => withVideoFolder(text, slug);

  return {
    ...template,
    ask: said(template.ask),
    checklist: template.checklist?.map(said),
    discover: said(template.discover),
    doneWhen: said(template.doneWhen),
    goal: said(template.goal),
    outputs: template.outputs.map(said),
  };
}
