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
      "{docs}/analysis.md names the audience, one promise or message, target format/duration, actual assets and missing material. With references, select a primary and trace a defining passage through its action and neighboring transition: starting state, trigger, shared subject or direction, attention shift and result. Sample densely enough to resolve changes between observations; record timestamps, the relationship to inherit and how this material supports it. Separate observed motion from inferred parameters and state inspection limits. Give secondary references specific roles. Without references, state a concrete direction from the brief and brand. Keep observations, user requirements and assumptions distinct.",
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
      "Check {docs}/script.md. If it is missing, read {docs}/analysis.md and the person's draft. Select actual material that conveys the promise. For each beat identify the viewer takeaway or feeling, its asset or copy and focal subject. For consequential handoffs, choose the relationship before the effect: cause/result, part/whole, comparison, rhythmic development or a deliberate break. Record what the preceding state prepares for the next. Website section order is source context, not an automatic screenplay.",
    doneWhen:
      "Each shot in {docs}/script.md names its message, starting state, action, visible result and what makes that result ready for the viewer's task. Key handoffs have a stated relationship, including what persists or deliberately changes. Name the actual assets, copy or UI states and distinguish essential reading from background detail. Allocate action and inspection time before assigning shot lengths; check whether preparation earns its time. Distinguish shots from beats within them. Durations add up to the target with transition overlap accounted for.",
    goal: "Plan how the material develops through actions, results and related beats within the target duration.",
    id: "script",
    outputs: ["{docs}/script.md"],
    title: "Script",
  },
  {
    activeForm: "Defining the motion language",
    ask: "Choose the motion language from the established brief and references. Ask only if a missing decision materially changes the film; internal visual checks need no separate approval.",
    discover:
      "Read {docs}/analysis.md, {docs}/brand.md and {docs}/script.md, then reuse any settled decisions in {docs}/motion.md. Inventory installed components and mcp__remocn-library__list_assets before authoring new movements. Use motion-design's template index to shortlist relevant passages; inspect only candidate APIs and source under the established direction. Stop searching when each shot has a suitable implementation. Prefer an existing template, component or studio-motion-v2 primitive; record a concrete capability gap for custom code. Resolve missing dependencies together before Build. Verify that actual assets support the chosen shots.",
    doneWhen:
      "{docs}/motion.md contains a compact shot-to-component map: source/import, actual copy/assets, adaptations, dependent timing and any justified custom capability. Record the visual language and choose a representative passage for inspection after the complete draft exists: central action, result and neighboring handoff, with the direction decisions it must verify. Plan starting/action/result keyframes at delivery size; render them from the draft during Build. A separate polished proof is not a prerequisite for Build. Resolve essential missing assets; still holds and cuts remain valid choices.",
    goal: "Map the script to reusable components and plan the direction and its verification.",
    id: "motion",
    outputs: ["{docs}/motion.md"],
    title: "Motion",
  },
  {
    activeForm: "Building the video",
    ask: "Ask only when the script or the motion language leaves a scene ambiguous — name the scene and the ambiguity.",
    checklist: [
      "Complete draft. Assemble every scripted shot in the registered composition using the component map, actual copy/assets and derived timing. Reuse installed components; keep scenes editable in named files. First make the full timeline compile and match the target duration, with audio when required. Record the scene map and remaining visual issues in {docs}/motion.md. This is a working draft, not a finished video; defer decorative polish until every shot exists.",
      "Inspect the draft. Capture starting/action/result keyframes under {video}/assets/keyframes/ and the chosen representative passage under {video}/assets/proof/. Inspect at delivery size, through its action, result and neighboring handoff; use normal-speed playback when available or consecutive frames with stated limits. Compare hierarchy, reading, continuity and rhythm with the direction; for template adaptations include intermediate poses, speed changes and combined inner/outer movement. Use design_check with mode=sampled on relevant event frames, batching independent samples within the tool's limits. Record concrete findings with scene/file, frame range, expected versus observed behavior, source identity and render settings.",
      "Local corrections. Make one focused polish pass through the recorded findings. Edit the owning scenes and shared dependencies; recheck changed passages and dependent neighbors with sampled checks. Preserve unaffected scenes and settled direction. Further passes address unresolved findings or user feedback, not new speculative redesigns. For changed shared timing, verify that member completion, following events and the review plan still derive together. Build is done when every shot exists, the preview compiles, duration matches the script and draft findings are resolved with evidence; the final full check belongs to Review.",
    ],
    discover:
      "Read {docs}/script.md and {docs}/motion.md, then inspect the existing source. For text, image reveals or graphic handoffs, read src/lib/studio-motion-v2/README.md and reuse suitable movements or combinations while preserving the art direction. Separate authored inputs from derived member schedules, group completion and following events. Compute the animation and review from that same plan, including the last child and every element required for result readiness. Derive the enclosing duration, run checkTiming and publish MotionReview; custom visible targets use useCue. Keep the wrapper mounted across handoffs. Recompute with actual copy and font; resolve an overfull budget through selection, grouping, layout or time allocation. The checker discovers the declared event boundaries from the rendered composition.",
    doneWhen:
      "The complete editable draft was assembled before passage polish. {docs}/motion.md records the scene map, inspected proof and findings closed with observed evidence, source identity and inspection limits. Runtime contracts bind actual visible elements and derive group completion and adjacent handoffs from the animation schedule. The preview compiles, every scripted shot is present, duration matches the script and the film follows the chosen direction.",
    goal: "Build the complete editable draft from reusable components, inspect it, then correct specific scenes.",
    id: "build",
    outputs: ["{video}/", "{video}/assets/keyframes/", "{video}/assets/proof/"],
    title: "Build",
  },
  {
    activeForm: "Choreographing the whole video",
    ask: "Ask only when a scene's meaning is unclear enough that you cannot tell which beat should carry the accent — name the scene and the ambiguity.",
    checklist: [
      "Rhythm. Inspect repeated staging as a sequence: identify the evidence, comparison, accumulation or expectation that develops. Check whether each item needs the same exposure before retaining repeated entry/hold/cut timing. Equal durations and still holds can serve that purpose; no variation or motion quota applies. If audio exists, compare meaningful visual accents with preparation, impact and release in the actual mix.",
      "Continuity. Inspect each handoff and cut for the intended relationship. Shared objects keep their geometry and identity; a bridge lives outside the Series it spans. A hard cut may introduce a new subject without any persistent layer. Distinguish shots from beats inside a continuous shot.",
      "Reading. Name the text, detail, comparison or anticipation each hold serves. Inspect its range at realistic viewing size, from actual readiness of the required content until it leaves. Verify that a stopped camera or mounted wrapper has not hidden an unfinished reveal. For an empty interval, compare a shorter hold or different staging. A completed element may remain still.",
      "Order of arrival. Verify the planned relationships against the actual sequence. Inspect the last child of a group and the next arrival together; dependent timing must include full group completion. For UI, follow the target, activation, response and result. Group elements by meaning and use stagger when separate arrivals help the viewer.",
      "Camera. Frame the intended subject and retain the context needed to identify it. A camera move should reveal, follow or reframe something; a locked camera is valid. Inspect the target and result for clipping, scale jumps and loss of detail.",
    ],
    discover:
      "Read {docs}/script.md and {docs}/motion.md, then inspect the rendered sequence and call mcp__remocn-design__design_check with mode=sampled and the whole video's scene map in `video`. Pass the map once for whole-film diagnostics; further local calls use frames and motion only. Select event and handoff frames in batches within the tool's limits; reuse current Build evidence and inspect remaining relationships. A map can contain one continuous shot. Correct named findings locally and recheck affected passages and dependent neighbors. Use motion assertions only for explicitly intended behavior; rhythm, shared-layer and camera summaries are diagnostics, not creative requirements.",
    doneWhen:
      "{docs}/choreography.md records the whole-film pass with inspected ranges and any changes to event relationships, repeated staging or holds. Each finding has an expected behavior, observed frames/time range and a verified correction or bounded reason to retain it. Exceptions identify the purpose and visible evidence that the important information survives; 'intentional' alone cannot close a mismatch. Contradictions between the plan and output are resolved and dependent neighbors are rechecked. State inspection limits.",
    goal: "Review the film end to end for readable actions, meaningful transitions and coherent framing against the selected direction.",
    id: "choreography",
    outputs: ["{docs}/choreography.md", "src/"],
    title: "Choreography",
  },
  {
    activeForm: "Reviewing the result",
    ask: "Complete the internal review using the brief and existing notes. Ask only about an unresolved creative decision that needs the person's judgment; record feedback in {docs}/review.md.",
    discover:
      "Check {docs}/review.md and reuse current Build/Choreography evidence, then compare the built video against {docs}/script.md scene by scene. Close known local findings before running the final full check. Reuse an existing full report only if it revalidates against current sources and settings with complete coverage and no unresolved errors; changed sources or settings require a new full check after local fixes. Compare selected template passages using the source and observations already recorded in {docs}/motion.md; reopen source inspection only for an unresolved difference. State any source or playback limits.",
    doneWhen:
      "Every note in {docs}/review.md is closed with observed evidence or explicitly deferred by the person. Run design_check with mode=full over the whole scene map, including the actual audio mix; review coverage, failed/skipped checks and stale status. Fix measured viewer defects and recheck affected scenes. Record any narrow exception with its range, purpose grounded in the brief/direction and visible evidence; merely calling a defect intentional does not close it. Separately assess the film against the primary reference or declared direction for hierarchy, progression, continuity, reading and coherence, citing rendered passages. Record reviewed export path, source identity, render settings, report id and inspection limits. Mark review done with reviewReportId: Studio reloads the full check against current sources and requires completed coverage, checked event boundaries and no unresolved measured viewer errors. Use an adequate frame/time budget for incomplete coverage. Copied JSON and prose cannot replace revalidation; a passing check cannot establish creative success. Style recommendations never block human export.",
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
