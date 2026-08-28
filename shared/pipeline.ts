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
      "Check video/analysis.md. If it is missing, look at what the folder already holds: source material, a README, existing scenes — anything that says what this video is about.",
    doneWhen:
      "video/analysis.md names the topic, the goal, the target duration and every source it draws on.",
    goal: "Work out what is given: the material, the topic, the audience and the target duration.",
    id: "analysis",
    outputs: ["video/analysis.md"],
    title: "Analysis",
  },
  {
    activeForm: "Collecting the brand",
    ask: "Ask for the brand: its name, an authoritative site or brand book, two or three key colors, and the tone the video should carry.",
    discover:
      "Call mcp__remocn-library__get_moodboard first: an existing moodboard comes back as its spec and rendered PNG — work from its palette and typography, never regenerate it. When none exists, build one: search photography with mcp__remocn-library__search_stock, curate five to eight photos whose light and mood agree, extract the palette from those photos rather than inventing it, pick a Google Fonts pairing, then call mcp__remocn-library__save_moodboard and read the PNG it answers with. Then check video/brand.md, and inspect the project for logos, css tokens, a README, and every authoritative URL it mentions. Work source-first for each identity asset: recover the original file from a direct download, img/srcset or linked SVG and copy it unchanged into video/assets/. Record the source beside the local path in video/brand.md. If the source exposes no usable original after you check those locations, call mcp__remocn-pipeline__request_source_asset; a newly drawn, traced or restyled replacement cannot complete this stage.",
    doneWhen:
      "video/brand.md names concrete colors, fonts and tone, the project has a moodboard (mcp__remocn-library__get_moodboard answers with one), and every required identity asset has both an unchanged local file in video/assets/ and its provenance recorded beside it.",
    goal: "Collect the visual language: palette, fonts, logos and tone.",
    id: "brand",
    outputs: ["video/brand.md", "video/assets/"],
    title: "Brand",
  },
  {
    activeForm: "Writing the script",
    ask: "Ask what the video should say if analysis left it open: the story, the order, what each scene shows.",
    discover:
      "Check video/script.md. If it is missing, read video/analysis.md and any draft the person left in the folder, then write from those.",
    doneWhen:
      "Every scene in video/script.md has its text, its visual and its duration in seconds, and the durations add up to the target.",
    goal: "Write the script scene by scene: what is said, what is on screen, and for how long.",
    id: "script",
    outputs: ["video/script.md"],
    title: "Script",
  },
  {
    activeForm: "Defining the motion language",
    ask: "Propose a motion language yourself and ask the person to confirm it — pace, entrances, transitions — rather than asking them to design it.",
    discover:
      "Check video/motion.md. If it is missing, look at animations already in the project whose style this video should continue.",
    doneWhen:
      "video/motion.md names a device for every kind of element the script uses, and a transition between every pair of scenes.",
    goal: "Define the motion language: entrance and exit devices, easing, pace, and the transitions between scenes.",
    id: "motion",
    outputs: ["video/motion.md"],
    title: "Motion",
  },
  {
    activeForm: "Building the video",
    ask: "Ask only when the script or the motion language leaves a scene ambiguous — name the scene and the ambiguity.",
    discover:
      "Read video/script.md and video/motion.md, then check what of the video already exists in src/.",
    doneWhen:
      "The preview compiles, every scene the script names is present, and the total duration matches the script.",
    goal: "Build the video: every scene inside Main via Series or TransitionSeries, exactly as the script and the motion language say.",
    id: "build",
    outputs: ["src/"],
    title: "Build",
  },
  {
    activeForm: "Choreographing the whole video",
    ask: "Ask only when a scene's meaning is unclear enough that you cannot tell which beat should carry the accent — name the scene and the ambiguity.",
    checklist: [
      "Rhythm. Scene durations must not be uniform: across the video, longest/shortest >= 1.5x. Place one short accent scene (under 1s) per every 4-5 scenes, and hold at least 15 frames of rest after each key statement. If an audiomap is present, cut on hard stops and energy jumps - never on every beat.",
      'Continuity. In at least half of the scene changes, something must live across the boundary: an element exits WHILE the next one enters, a background field persists through the cut, or camera motion carries over. "Everything out, then everything in" is the definition of a slideshow - break it wherever you find it. A transition owns its own boundary; a bridge element lives outside the Series, above the scenes it spans.',
      "Life after entry. Every key element keeps secondary motion after landing (drift, breathe, parallax); decorations share one slow ambient motion. A frame where nothing moves for more than 1.5s is a defect unless it is a deliberate held beat.",
      "Order of arrival. Entrances follow meaning hierarchy: the thing the viewer must read first arrives first, alone; supporting elements follow 2-4 frames apart. Rework any scene where everything enters at once or in a mechanical top-to-bottom sweep.",
      "Camera. Scenes with more than one plane run inside a camera wrapper — one transform framing the whole scene; a locked-off frame is a deliberate choice you can name, not a default.",
    ],
    discover:
      "Read video/script.md for the scene list and its durations and video/motion.md for the devices it promised, then measure what was actually built: call mcp__remocn-design__design_check with the whole video's scene map in `video`, so the rhythm, the carried boundaries, the frozen runs and the camera are answered by measurement rather than by reading the code.",
    doneWhen:
      "video/choreography.md records the pass scene by scene, and design_check's whole-video findings are either fixed or answered in one line each.",
    goal: "Walk the finished video end to end once and fix what makes it read as slides: uneven rhythm, boundaries nothing lives across, elements that freeze after their entry, entrances that arrive all at once, and a camera that never moves.",
    id: "choreography",
    outputs: ["video/choreography.md", "src/"],
    title: "Choreography",
  },
  {
    activeForm: "Reviewing the result",
    ask: "Ask the person to watch the preview and tell you what reads wrong; record each note in video/review.md.",
    discover:
      "Check video/review.md for notes already taken, and compare the built video against video/script.md scene by scene.",
    doneWhen:
      "Every note in video/review.md is closed or explicitly deferred by the person, and design_check has run on two or three key frames with every mechanical finding fixed or explicitly explained.",
    goal: "Review the result against the script, collect notes, and close them.",
    id: "review",
    outputs: ["video/review.md"],
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
