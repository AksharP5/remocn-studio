import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, Exit } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { Asset, AssetSource } from "@/shared/library";
import { extensionOf } from "@/shared/library";
import {
  decodeMoodboardSpec,
  googleFontsHref,
  isHexColor,
  MOODBOARD_HEIGHT,
  MOODBOARD_SPEC_FILE,
  MOODBOARD_WIDTH,
  type MoodboardImage,
  type MoodboardImageRole,
  type MoodboardSpec,
  type MoodboardSwatch,
  type MoodboardTypography,
} from "@/shared/moodboard";
import { LibraryError, listAssets, removeAsset, saveAsset } from "./store";

export interface MoodboardRecord {
  readonly asset: Asset;
  readonly spec: MoodboardSpec;
}

export interface MoodboardImageDraft {
  readonly columns: number | null;
  readonly file: string | null;
  readonly note: string;
  readonly role: MoodboardImageRole;
  readonly rows: number | null;
  readonly source: AssetSource | null;
  readonly url: string | null;
}

export interface MoodboardDraft {
  readonly images: readonly MoodboardImageDraft[];
  readonly keywords: readonly string[];
  readonly palette: readonly { hex: string; name: string }[];
  readonly project: string | null;
  readonly title: string;
  readonly typography: readonly {
    body: string;
    heading: string;
    sample: string;
  }[];
}

export type MoodboardRender = (input: {
  readonly output: string;
  readonly url: string;
}) => Effect.Effect<string, { readonly message: string }>;

const failed = (cause: unknown) =>
  new LibraryError({ message: errorMessage(cause) });

function attempt<A>(run: () => Promise<A>): Effect.Effect<A, LibraryError> {
  return Effect.tryPromise({ catch: failed, try: run });
}

export function specOf(
  asset: Asset
): Effect.Effect<MoodboardSpec | null, LibraryError> {
  if (!asset.files.includes(MOODBOARD_SPEC_FILE)) {
    return Effect.succeed(null);
  }

  return attempt(async () => {
    try {
      const raw = await readFile(join(asset.path, MOODBOARD_SPEC_FILE), "utf8");
      const decoded = decodeMoodboardSpec(JSON.parse(raw));
      return Exit.isSuccess(decoded) ? decoded.value : null;
    } catch {
      return null;
    }
  });
}

export function findMoodboard(
  projectId: string
): Effect.Effect<MoodboardRecord | null, LibraryError> {
  return Effect.gen(function* () {
    const assets = yield* listAssets();

    for (const asset of assets) {
      const spec = yield* specOf(asset);
      if (spec !== null && spec.project === projectId) {
        return { asset, spec };
      }
    }

    return null;
  });
}

export function saveMoodboard(
  draft: MoodboardDraft,
  render: MoodboardRender,
  fetcher: typeof fetch = fetch
): Effect.Effect<MoodboardRecord, LibraryError> {
  return Effect.gen(function* () {
    const bad = draft.palette.find((swatch) => !isHexColor(swatch.hex));
    if (bad !== undefined) {
      return yield* Effect.fail(
        new LibraryError({
          message: `${bad.hex} is not a hex color — a swatch is #rrggbb`,
        })
      );
    }
    if (draft.images.length === 0) {
      return yield* Effect.fail(
        new LibraryError({ message: "a moodboard needs at least one image" })
      );
    }

    const staging = yield* attempt(() =>
      mkdtemp(join(tmpdir(), "remocn-moodboard-"))
    );

    const built = Effect.gen(function* () {
      const images = yield* attempt(() =>
        stageImages(draft.images, staging, fetcher)
      );
      const spec = specFrom(draft, images);

      const specPath = join(staging, MOODBOARD_SPEC_FILE);
      const pagePath = join(staging, "board.html");
      const previewPath = join(staging, "preview.png");
      yield* attempt(async () => {
        await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
        await writeFile(pagePath, moodboardHtml(spec), "utf8");
      });

      yield* render({
        output: previewPath,
        url: pathToFileURL(pagePath).toString(),
      }).pipe(
        Effect.mapError(
          (error) =>
            new LibraryError({
              message: `the moodboard could not be rendered: ${error.message}`,
            })
        )
      );

      const existing =
        spec.project === null ? null : yield* findMoodboard(spec.project);
      if (existing !== null) {
        yield* removeAsset(existing.asset.slug);
      }

      const asset = yield* saveAsset({
        audiomap: null,
        dependencies: [],
        description:
          spec.keywords.length > 0
            ? `Moodboard — ${spec.keywords.join(", ")}`
            : "Moodboard",
        duration: null,
        files: [specPath, ...images.map((image) => join(staging, image.file))],
        name: spec.title,
        preview: previewPath,
        role: null,
        source: null,
        type: "img",
      });

      return { asset, spec };
    });

    return yield* built.pipe(
      Effect.ensuring(
        Effect.promise(() =>
          rm(staging, { force: true, recursive: true }).catch(() => undefined)
        )
      )
    );
  });
}

// An existing board found for the same project answers instead of a fresh
// generation: the search-and-curate pass is the expensive half, and repeating
// it is a decision the person makes in words, never the model on its own.
export function moodboardBrief(record: MoodboardRecord): string {
  const { preview } = record.asset;

  return [
    `This project already has a moodboard: ${record.asset.name} (${record.asset.slug}).`,
    preview === null
      ? "It has no rendered preview."
      : `Its rendered board is at ${preview} — read that file to look at it.`,
    "Work from this spec; do not regenerate the board unless the person explicitly asks to start over:",
    JSON.stringify(record.spec, null, 2),
  ].join("\n");
}

function specFrom(
  draft: MoodboardDraft,
  images: readonly MoodboardImage[]
): MoodboardSpec {
  return {
    images,
    keywords: draft.keywords.filter((word) => word.length > 0),
    palette: draft.palette.map((swatch, index) => ({
      hex: swatch.hex.toLowerCase(),
      id: `swatch-${index + 1}`,
      name: swatch.name,
    })),
    project: draft.project,
    title: draft.title,
    typography: draft.typography.map((pair, index) => ({
      body: pair.body,
      heading: pair.heading,
      id: `type-${index + 1}`,
      sample: pair.sample,
    })),
  };
}

async function stageImages(
  drafts: readonly MoodboardImageDraft[],
  staging: string,
  fetcher: typeof fetch
): Promise<MoodboardImage[]> {
  await mkdir(join(staging, "images"), { recursive: true });

  const staged: MoodboardImage[] = [];

  for (const [index, draft] of drafts.entries()) {
    const id = `image-${index + 1}`;
    // biome-ignore lint/performance/noAwaitInLoops: images are fetched one at a time so a stock host is not hammered
    const file = await stageImage(draft, staging, id, fetcher);
    staged.push({
      columns: draft.columns ?? (draft.role === "texture" ? 1 : 2),
      file,
      id,
      note: draft.note,
      role: draft.role,
      rows: draft.rows ?? (draft.role === "texture" ? 1 : 2),
      source: draft.source,
    });
  }

  return staged;
}

async function stageImage(
  draft: MoodboardImageDraft,
  staging: string,
  id: string,
  fetcher: typeof fetch
): Promise<string> {
  if (draft.file !== null) {
    const extension = extensionOf(basename(draft.file));
    const name = `images/${id}.${extension.length > 0 ? extension : "png"}`;
    await copyFile(draft.file, join(staging, name));
    return name;
  }
  if (draft.url === null) {
    throw new Error(`${id} names neither a local file nor a download URL`);
  }

  const answer = await fetcher(draft.url);
  if (!answer.ok) {
    throw new Error(`downloading ${draft.url} answered ${answer.status}`);
  }
  const fromUrl = extensionOf(basename(new URL(draft.url).pathname));
  const name = `images/${id}.${fromUrl.length > 0 ? fromUrl : "jpg"}`;
  await writeFile(join(staging, name), Buffer.from(await answer.arrayBuffer()));
  return name;
}

const BOARD_COLUMNS = 4;
const BOARD_PADDING = 24;
const BOARD_GAP = 12;

// The board is authored to the exact viewport the host's `source` capture
// already opens, so rendering it needs no protocol change: a fixed canvas,
// a dense photo grid on the left, and a rail of palette, typography and
// keywords on the right. Everything is derived from the spec — same spec,
// same pixels.
export function moodboardHtml(spec: MoodboardSpec): string {
  const fonts = googleFontsHref(spec);
  const heading = spec.typography[0]?.heading ?? null;
  const body = spec.typography[0]?.body ?? null;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(spec.title)}</title>
    ${fonts === null ? "" : `<link rel="stylesheet" href="${escapeHtml(fonts)}" />`}
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { width: ${MOODBOARD_WIDTH}px; height: ${MOODBOARD_HEIGHT}px; overflow: hidden; }
      body {
        background: #f4f2ee; color: #1c1a17;
        font-family: ${fontStack(body, "system-ui, sans-serif")};
        display: flex; gap: ${BOARD_GAP}px; padding: ${BOARD_PADDING}px;
      }
      .photos {
        flex: 1 1 auto; display: grid; align-content: stretch;
        grid-template-columns: repeat(${BOARD_COLUMNS}, 1fr);
        grid-auto-rows: 1fr; grid-auto-flow: dense; gap: ${BOARD_GAP}px;
        overflow: hidden;
      }
      .photos figure { position: relative; overflow: hidden; border-radius: 6px; background: #e5e1da; }
      .photos img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .photos figcaption {
        position: absolute; left: 0; right: 0; bottom: 0;
        padding: 3px 8px; font-size: 10px; line-height: 1.3;
        color: rgba(255, 255, 255, 0.85); background: rgba(20, 19, 24, 0.45);
      }
      .rail { flex: 0 0 340px; display: flex; flex-direction: column; gap: 20px; overflow: hidden; }
      h1 {
        font-family: ${fontStack(heading, "system-ui, sans-serif")};
        font-size: 34px; font-weight: 700; line-height: 1.1;
      }
      .keywords { display: flex; flex-wrap: wrap; gap: 6px; }
      .keywords span {
        font-size: 13px; padding: 4px 10px; border-radius: 999px;
        border: 1px solid rgba(28, 26, 23, 0.25);
      }
      .palette { display: flex; gap: 8px; }
      .palette .swatch { flex: 1 1 0; min-width: 0; }
      .palette .chip { height: 72px; border-radius: 6px; border: 1px solid rgba(28, 26, 23, 0.12); }
      .palette .hex { font-size: 11px; margin-top: 4px; letter-spacing: 0.02em; }
      .type-pair .families { font-size: 12px; color: rgba(28, 26, 23, 0.6); margin-bottom: 6px; }
      .type-pair .sample-heading { font-size: 26px; font-weight: 700; line-height: 1.15; }
      .type-pair .sample-body { font-size: 14px; line-height: 1.45; margin-top: 4px; }
      .credits { margin-top: auto; font-size: 10px; color: rgba(28, 26, 23, 0.5); line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="photos">
${spec.images.map(figureOf).join("\n")}
    </div>
    <div class="rail">
      <h1>${escapeHtml(spec.title)}</h1>
${keywordsOf(spec)}${paletteOf(spec.palette)}${typographyOf(spec.typography)}${creditsOf(spec.images)}
    </div>
  </body>
</html>
`;
}

function figureOf(image: MoodboardImage): string {
  const caption =
    image.note.length > 0
      ? `<figcaption>${escapeHtml(image.note)}</figcaption>`
      : "";

  return `      <figure id="${escapeHtml(image.id)}" style="grid-column: span ${clampSpan(image.columns)}; grid-row: span ${clampSpan(image.rows)};">
        <img src="${escapeHtml(image.file)}" alt="" />${caption}
      </figure>`;
}

function keywordsOf(spec: MoodboardSpec): string {
  if (spec.keywords.length === 0) {
    return "";
  }

  const words = spec.keywords
    .map((word) => `<span>${escapeHtml(word)}</span>`)
    .join("");
  return `      <div class="keywords">${words}</div>\n`;
}

function paletteOf(palette: readonly MoodboardSwatch[]): string {
  if (palette.length === 0) {
    return "";
  }

  const swatches = palette
    .map(
      (swatch) => `<div class="swatch" id="${escapeHtml(swatch.id)}">
          <div class="chip" style="background: ${escapeHtml(swatch.hex)};"></div>
          <div class="hex">${escapeHtml(swatch.hex)}${swatch.name.length > 0 ? ` — ${escapeHtml(swatch.name)}` : ""}</div>
        </div>`
    )
    .join("");
  return `      <div class="palette">${swatches}</div>\n`;
}

function typographyOf(pairs: readonly MoodboardTypography[]): string {
  return pairs
    .map((pair) => {
      const sample =
        pair.sample.length > 0 ? pair.sample : "The quick brown fox";
      return `      <div class="type-pair" id="${escapeHtml(pair.id)}">
        <div class="families">${escapeHtml(pair.heading)} / ${escapeHtml(pair.body)}</div>
        <div class="sample-heading" style="font-family: ${fontStack(pair.heading, "system-ui, sans-serif")};">${escapeHtml(sample)}</div>
        <div class="sample-body" style="font-family: ${fontStack(pair.body, "system-ui, sans-serif")};">${escapeHtml(sample)}</div>
      </div>\n`;
    })
    .join("");
}

function creditsOf(images: readonly MoodboardImage[]): string {
  const authors = [
    ...new Set(
      images
        .map((image) => image.source?.author ?? "")
        .filter((author) => author.length > 0)
    ),
  ];
  if (authors.length === 0) {
    return "";
  }

  return `      <div class="credits">Photography: ${authors.map(escapeHtml).join(", ")} — Pexels</div>\n`;
}

function clampSpan(value: number): number {
  return Math.min(BOARD_COLUMNS, Math.max(1, Math.round(value)));
}

function fontStack(family: string | null, fallback: string): string {
  return family === null
    ? fallback
    : `"${family.replaceAll('"', "")}", ${fallback}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
