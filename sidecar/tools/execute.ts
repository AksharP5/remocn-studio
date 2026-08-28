import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { errorMessage } from "@/lib/error-message";
import type { Asset, AssetDraft, StockPage } from "@/shared/library";
import { assetTypeFor } from "@/shared/library";
import type { MotionRole } from "@/shared/motion";
import type {
  PipelineStage,
  PipelineStageId,
  PipelineStatus,
} from "@/shared/pipeline";
import { pipelineBrief } from "../claude/conventions";
import type { MoodboardDraft, MoodboardRecord } from "../library/moodboard";
import { moodboardBrief } from "../library/moodboard";
import type { VideoCheck } from "../preview/choreography";
import type { DesignResult, MotionAssertion } from "../preview/design";
import {
  DESIGN_CHECK,
  DESIGN_SERVER,
  GET_MOODBOARD,
  LIBRARY_SERVER,
  LIST_ASSETS,
  PIPELINE_SERVER,
  REQUEST_SOURCE_ASSET,
  SAVE_ASSET,
  SAVE_MOODBOARD,
  SEARCH_STOCK,
  START_PIPELINE,
  TOOL_SPECS,
  type ToolServer,
} from "./specs";

export interface LibraryCalls {
  readonly list: () => Promise<readonly Asset[]>;
  readonly save: (draft: AssetDraft) => Promise<Asset>;
}

export interface StockCalls {
  readonly search: (query: {
    readonly kind: "photo" | "video";
    readonly page: number;
    readonly query: string;
  }) => Promise<StockPage>;
}

export interface MoodboardCalls {
  readonly find: () => Promise<MoodboardRecord | null>;
  readonly save: (
    draft: Omit<MoodboardDraft, "project">
  ) => Promise<MoodboardRecord>;
}

export interface PipelineCalls {
  readonly requestSource: (input: {
    readonly attempt: string;
    readonly name: string;
    readonly source: string;
  }) => Promise<import("@/shared/ipc").SourceAssetResolution>;
  readonly setStage: (
    stage: PipelineStageId,
    status: PipelineStatus
  ) => Promise<readonly PipelineStage[]>;
  readonly start: () => Promise<readonly PipelineStage[]>;
}

export interface DesignCalls {
  readonly check: (input: {
    readonly frames: readonly number[];
    readonly motion: readonly MotionAssertion[];
    readonly video: VideoCheck | null;
  }) => Promise<DesignResult>;
}

export interface TurnTools {
  readonly cwd: string;
  readonly design: DesignCalls;
  readonly library: LibraryCalls;
  readonly moodboard: MoodboardCalls;
  readonly pipeline: PipelineCalls;
  readonly stock: StockCalls;
}

export interface ToolAnswer {
  readonly isError: boolean;
  readonly text: string;
}

export function executeTool(
  server: ToolServer,
  tool: string,
  params: unknown,
  tools: TurnTools
): Promise<ToolAnswer> {
  return answer(() => {
    const spec = TOOL_SPECS[server].find((row) => row.name === tool);
    if (spec === undefined) {
      throw new Error(`${server} has no tool called ${tool}`);
    }

    const args = z.object(spec.shape).parse(params ?? {});
    return run(server, tool, args, tools);
  });
}

function run(
  server: ToolServer,
  tool: string,
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  if (server === LIBRARY_SERVER && tool === LIST_ASSETS) {
    return listAssets(tools.library);
  }
  if (server === LIBRARY_SERVER && tool === SAVE_ASSET) {
    return saveAsset(args, tools);
  }
  if (server === LIBRARY_SERVER && tool === SEARCH_STOCK) {
    return searchStock(args, tools.stock);
  }
  if (server === LIBRARY_SERVER && tool === GET_MOODBOARD) {
    return getMoodboard(tools.moodboard);
  }
  if (server === LIBRARY_SERVER && tool === SAVE_MOODBOARD) {
    return saveMoodboard(args, tools);
  }
  if (server === PIPELINE_SERVER && tool === START_PIPELINE) {
    return staged(tools.pipeline.start());
  }
  if (server === PIPELINE_SERVER && tool === REQUEST_SOURCE_ASSET) {
    return requestSource(args, tools.pipeline);
  }
  if (server === DESIGN_SERVER && tool === DESIGN_CHECK) {
    return designCheck(args, tools.design);
  }
  return staged(
    tools.pipeline.setStage(
      args.stage as PipelineStageId,
      args.status as PipelineStatus
    )
  );
}

async function requestSource(
  args: Record<string, unknown>,
  pipeline: PipelineCalls
): Promise<string> {
  const result = await pipeline.requestSource(
    args as { attempt: string; name: string; source: string }
  );
  return JSON.stringify(result, null, 2);
}

async function designCheck(
  args: Record<string, unknown>,
  design: DesignCalls
): Promise<string> {
  const declared = args.video as
    | { camera?: string | null; scenes: VideoCheck["scenes"] }
    | undefined;
  const result = await design.check({
    frames: args.frames as number[],
    motion: (args.motion as MotionAssertion[] | undefined) ?? [],
    video:
      declared === undefined
        ? null
        : { camera: declared.camera ?? null, scenes: declared.scenes },
  });
  return JSON.stringify(result, null, 2);
}

async function listAssets(library: LibraryCalls): Promise<string> {
  const assets = await library.list();

  if (assets.length === 0) {
    return "The library is empty.";
  }

  return assets.map(inventory).join("\n\n");
}

async function saveAsset(
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  const named = args as {
    dependencies?: string[];
    description?: string;
    files: string[];
    name: string;
    role?: MotionRole;
    type?: AssetDraft["type"];
  };

  const files = named.files.map((file) =>
    isAbsolute(file) ? file : resolve(tools.cwd, file)
  );

  const saved = await tools.library.save({
    dependencies: named.dependencies ?? [],
    description: named.description ?? "",
    duration: null,
    files,
    name: named.name,
    preview: null,
    role: named.role ?? null,
    source: null,
    type: named.type ?? assetTypeFor(files),
  });

  return `Saved ${saved.name} to the library as ${saved.slug} (${saved.type}), holding ${saved.files.length} file${saved.files.length === 1 ? "" : "s"}. It is now available in every project.`;
}

async function searchStock(
  args: Record<string, unknown>,
  stock: StockCalls
): Promise<string> {
  const named = args as {
    kind?: "photo" | "video";
    page?: number;
    query: string;
  };

  const page = await stock.search({
    kind: named.kind ?? "photo",
    page: named.page ?? 1,
    query: named.query,
  });

  if (page.items.length === 0) {
    return `Pexels found nothing for "${named.query}" — try different words.`;
  }

  const items = page.items.map((item) => ({
    author: item.author,
    authorUrl: item.authorUrl,
    download: item.download,
    duration: item.duration,
    height: item.height,
    id: item.id,
    name: item.name,
    pageUrl: item.url,
    width: item.width,
  }));

  const tail =
    page.nextPage === null
      ? ""
      : `\n\nMore results exist — pass page: ${page.nextPage} for the next ones.`;

  return `${JSON.stringify(items, null, 2)}${tail}`;
}

async function getMoodboard(moodboard: MoodboardCalls): Promise<string> {
  const record = await moodboard.find();

  if (record === null) {
    return "There is no moodboard for this project yet.";
  }

  return moodboardBrief(record);
}

function resolvedFile(cwd: string, file: string | undefined): string | null {
  if (file === undefined) {
    return null;
  }
  return isAbsolute(file) ? file : resolve(cwd, file);
}

async function saveMoodboard(
  args: Record<string, unknown>,
  tools: TurnTools
): Promise<string> {
  const named = args as {
    images: {
      author?: string;
      authorUrl?: string;
      columns?: number;
      file?: string;
      id?: string;
      note?: string;
      pageUrl?: string;
      role?: "photo" | "texture";
      rows?: number;
      url?: string;
    }[];
    keywords?: string[];
    palette?: { hex: string; name?: string }[];
    title: string;
    typography?: { body: string; heading: string; sample?: string }[];
  };

  const record = await tools.moodboard.save({
    images: named.images.map((image) => ({
      columns: image.columns ?? null,
      file: resolvedFile(tools.cwd, image.file),
      note: image.note ?? "",
      role: image.role ?? "photo",
      rows: image.rows ?? null,
      source:
        image.url !== undefined && image.id !== undefined
          ? {
              author: image.author ?? "",
              authorUrl: image.authorUrl ?? "",
              id: image.id,
              provider: "pexels" as const,
              url: image.pageUrl ?? "",
            }
          : null,
      url: image.url ?? null,
    })),
    keywords: named.keywords ?? [],
    palette: (named.palette ?? []).map((swatch) => ({
      hex: swatch.hex,
      name: swatch.name ?? "",
    })),
    title: named.title,
    typography: (named.typography ?? []).map((pair) => ({
      body: pair.body,
      heading: pair.heading,
      sample: pair.sample ?? "",
    })),
  });

  const looked =
    record.asset.preview === null
      ? "The board rendered no preview."
      : `The rendered board is at ${record.asset.preview} — read that file, judge it like a designer, and iterate by calling save_moodboard again with only the block that reads wrong replaced.`;

  return `Saved the moodboard ${record.asset.name} as ${record.asset.slug}, holding ${record.spec.images.length} image${record.spec.images.length === 1 ? "" : "s"}. ${looked}`;
}

async function staged(
  moving: Promise<readonly PipelineStage[]>
): Promise<string> {
  const stages = await moving;
  const brief = pipelineBrief(stages);

  return `${JSON.stringify(stages)}${brief === null ? "" : `\n\n${brief}`}`;
}

function inventory(asset: Asset): string {
  const lines = [
    asset.role === null
      ? `${asset.name} — ${asset.type}`
      : `${asset.name} — ${asset.type}, ${asset.role}`,
  ];

  if (asset.description.length > 0) {
    lines.push(asset.description);
  }

  lines.push(`files: ${asset.files.join(", ")}`);

  if (asset.dependencies.length > 0) {
    lines.push(`needs: ${asset.dependencies.join(", ")}`);
  }

  return lines.join("\n");
}

async function answer(work: () => Promise<string>): Promise<ToolAnswer> {
  try {
    return { isError: false, text: await work() };
  } catch (cause) {
    return { isError: true, text: errorMessage(cause) };
  }
}
