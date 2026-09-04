import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { DocumentText, ProjectFile, VideoDocuments } from "@/shared/ipc";
import { type PipelineStageId, stageDocuments } from "@/shared/pipeline";

export interface DocumentTab {
  readonly file: ProjectFile;
  readonly stage: PipelineStageId | null;
  readonly title: string | null;
}

export function listDocuments(
  videoId: string
): Effect.Effect<VideoDocuments, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "video.documents",
      params: { videoId },
    });
  });
}

export function readDocument(
  projectId: string,
  path: string
): Effect.Effect<DocumentText, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.read",
      params: { path, projectId },
    });
  });
}

/**
 * The tabs, in the order the pipeline writes them: every stage output the
 * folder actually holds, in stage order, then whatever else is in there by
 * name. A stage's document that has not been written yet is not a tab — the
 * strip shows what exists, not what is promised.
 */
export function documentTabs(
  files: readonly ProjectFile[]
): readonly DocumentTab[] {
  const byName = new Map(files.map((file) => [file.name, file]));
  const staged: DocumentTab[] = [];

  for (const document of stageDocuments()) {
    const file = byName.get(document.name);
    if (file !== undefined) {
      byName.delete(document.name);
      staged.push({ file, stage: document.stage, title: document.title });
    }
  }

  const rest = [...byName.values()]
    .sort((one, other) =>
      one.name.localeCompare(other.name, undefined, { sensitivity: "base" })
    )
    .map((file) => ({ file, stage: null, title: null }));

  return [...staged, ...rest];
}

/**
 * Whether a tool call the agent just made touched the file on screen. The
 * activity carries the tool's own input, so the check is a search for the
 * path anywhere in it rather than a guess at which field a given provider
 * spells it in.
 */
export function touches(input: unknown, path: string): boolean {
  if (typeof input === "string") {
    return input.includes(path);
  }

  if (Array.isArray(input)) {
    return input.some((value) => touches(value, path));
  }

  if (typeof input === "object" && input !== null) {
    return Object.values(input).some((value) => touches(value, path));
  }

  return false;
}

/**
 * The path of each stage's document, for the stages whose document is on
 * disk. The Video dock already knows its stages; this is what turns a stage
 * row into something to click.
 */
export function documentsByStage(
  tabs: readonly DocumentTab[]
): ReadonlyMap<PipelineStageId, string> {
  const byStage = new Map<PipelineStageId, string>();

  for (const tab of tabs) {
    if (tab.stage !== null && !byStage.has(tab.stage)) {
      byStage.set(tab.stage, tab.file.path);
    }
  }

  return byStage;
}
