import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Deferred, Effect, Exit, Fiber, Scope, Stream } from "effect";
import {
  type ExportFormat,
  type ExportQuality,
  type ExportResolution,
  FORMAT_SPECS,
} from "@/shared/export";
import { DATA_DIR_ENV, PREVIEW_ENTRY_ENV } from "@/shared/ipc";
import { exportFrom, previewEvents } from "./supervisor";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE = path.join(REPO, "test/fixtures/render-smoke");
const PROJECT = "render-smoke";

export const RENDER_SMOKE_ENV = "REMOCN_RENDER_SMOKE";

// Minutes of real compiling and encoding, so `bun run test` never picks these
// up just because the fixture happens to be installed on this machine.
// `bun run smoke:render` is what asks for them.
const installed =
  process.env[RENDER_SMOKE_ENV] === "1" &&
  existsSync(path.join(FIXTURE, "node_modules/remotion")) &&
  existsSync(path.join(FIXTURE, "public/clip.mp4"));

const GIF_HEADER = /^GIF8[79]a$/;

const NO_CONTEXT = /getContext\("webgl2"\) returned null/;

const BOOT_MS = 600_000;
const RENDER_MS = 600_000;

interface Renderer {
  getVideoMetadata: (file: string) => Promise<{
    audioCodec: string | null;
    codec: string;
    durationInSeconds: number;
    height: number;
    width: number;
  }>;
  RenderInternals: {
    getExecutablePath: (input: {
      binariesDirectory: null;
      indent: boolean;
      logLevel: string;
      type: string;
    }) => string;
  };
  renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
  selectComposition: (
    options: Record<string, unknown>
  ) => Promise<Record<string, unknown> & { height: number; width: number }>;
}

let scope: Scope.Closeable;
let fiber: Fiber.Fiber<unknown, unknown> | null = null;
let port = 0;
let dataDir = "";
let renderer: Renderer;
let out = "";
const said: string[] = [];

const serveUrl = () => `http://127.0.0.1:${port}/__remocn/render/index.html`;

async function decoded(
  file: string,
  size: { height: number; width: number }
): Promise<number[][]> {
  const ffmpeg = renderer.RenderInternals.getExecutablePath({
    binariesDirectory: null,
    indent: false,
    logLevel: "error",
    type: "ffmpeg",
  });

  // Remotion's ffmpeg is built down to what Remotion itself needs: it has no
  // rawvideo demuxer and no rawvideo *muxer*, so the frames come out through
  // image2pipe with the rawvideo encoder. Its dylibs sit beside it.
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(
      ffmpeg,
      [
        "-v",
        "error",
        "-i",
        file,
        "-f",
        "image2pipe",
        "-pix_fmt",
        "rgb24",
        "-c:v",
        "rawvideo",
        "-",
      ],
      { env: { ...process.env, DYLD_LIBRARY_PATH: path.dirname(ffmpeg) } }
    );

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", () => resolve(Buffer.concat(chunks)));
  });

  const stride = size.width * size.height * 3;
  const frames: number[][] = [];

  for (let at = 0; at + stride <= bytes.length; at += stride) {
    let red = 0;
    let green = 0;
    let blue = 0;

    for (let pixel = 0; pixel < stride; pixel += 3) {
      red += bytes[at + pixel] ?? 0;
      green += bytes[at + pixel + 1] ?? 0;
      blue += bytes[at + pixel + 2] ?? 0;
    }

    const count = stride / 3;
    frames.push([
      Math.round(red / count),
      Math.round(green / count),
      Math.round(blue / count),
    ]);
  }

  return frames;
}

function ship(
  composition: string,
  settings: {
    format?: ExportFormat;
    quality?: ExportQuality;
    resolution?: ExportResolution;
  } = {}
) {
  const format = settings.format ?? "mp4";

  return Effect.runPromise(
    exportFrom(
      PROJECT,
      {
        composition,
        format,
        outputPath: path.join(
          out,
          `${composition}-${format}.${FORMAT_SPECS[format].extension}`
        ),
        preset: "custom",
        quality: settings.quality ?? "project",
        resolution: settings.resolution ?? "source",
      },
      () => undefined
    )
  );
}

beforeAll(async () => {
  if (!installed) {
    return;
  }

  dataDir = mkdtempSync(path.join(tmpdir(), "remocn-smoke-"));
  out = mkdtempSync(path.join(tmpdir(), "remocn-smoke-out-"));
  process.env[PREVIEW_ENTRY_ENV] = path.join(REPO, "preview/entry.tsx");
  process.env[DATA_DIR_ENV] = dataDir;

  // The supervisor re-execs `process.argv[1]`, which under `bun test` is the
  // runner rather than the sidecar. Everything else about the spawn is the
  // real one.
  process.argv[1] = path.join(REPO, "sidecar/index.ts");

  renderer = createRequire(path.join(FIXTURE, "package.json"))(
    "@remotion/renderer"
  ) as Renderer;

  scope = Effect.runSync(Scope.make());

  const ready = Effect.runSync(Deferred.make<number>());

  fiber = Effect.runFork(
    Effect.provideService(
      Stream.runForEach(
        previewEvents(PROJECT, FIXTURE, (line) =>
          Effect.sync(() => {
            said.push(line);
          })
        ),
        (event) =>
          event.type === "ready"
            ? Deferred.succeed(ready, Number(new URL(event.url).port))
            : Effect.void
      ).pipe(Effect.ignore),
      Scope.Scope,
      scope
    )
  );

  port = await Effect.runPromise(
    Deferred.await(ready).pipe(
      Effect.timeoutOrElse({
        duration: BOOT_MS - 30_000,
        orElse: () =>
          Effect.die(
            new Error(
              `the preview host never became ready:\n${said.slice(-20).join("\n")}`
            )
          ),
      })
    )
  );
}, BOOT_MS);

afterAll(async () => {
  if (!installed) {
    return;
  }

  if (fiber !== null) {
    await Effect.runPromise(Fiber.interrupt(fiber));
  }

  await Effect.runPromise(Scope.close(scope, Exit.void));

  for (const created of [dataDir, out]) {
    rmSync(created, { force: true, recursive: true });
  }
});

describe.skipIf(!installed)(
  "the project's own renderer, driven for real",
  () => {
    it(
      "renders DOM, SVG and text into an H.264 mp4 whose frames really change",
      async () => {
        const exported = await ship("Dom");

        const metadata = await renderer.getVideoMetadata(exported.path);

        expect(metadata.codec).toBe("h264");
        expect(metadata.width).toBe(320);
        expect(metadata.height).toBe(180);

        const frames = await decoded(exported.path, {
          height: 180,
          width: 320,
        });

        expect(frames.length).toBeGreaterThanOrEqual(6);
        expect(frames[0]?.[0]).toBeLessThan(frames.at(-1)?.[0] ?? 0);
        expect(new Set(frames.map((frame) => frame.join(","))).size).toBe(
          frames.length
        );
      },
      RENDER_MS
    );

    it(
      "cannot make a WebGL2 context with no backend, which is the failure the studio's policy exists to fix",
      async () => {
        const composition = await renderer.selectComposition({
          chromiumOptions: { gl: null },
          id: "WebGL",
          logLevel: "error",
          serveUrl: serveUrl(),
          timeoutInMilliseconds: 30_000,
        });

        const target = path.join(out, "webgl-no-backend.mp4");

        const attempt = renderer.renderMedia({
          chromiumOptions: { gl: null },
          codec: "h264",
          composition,
          logLevel: "error",
          outputLocation: target,
          overwrite: true,
          serveUrl: serveUrl(),
          timeoutInMilliseconds: 30_000,
        });

        // Not merely "it failed": the fixture cancels the render with the exact
        // sentence the audit reproduced, so this pins the cause rather than the
        // symptom.
        await expect(attempt).rejects.toThrow(NO_CONTEXT);
      },
      RENDER_MS
    );

    it(
      "renders that same WebGL2 scene through the studio, with frames that move",
      async () => {
        const exported = await ship("WebGL");

        const frames = await decoded(exported.path, {
          height: 180,
          width: 320,
        });

        expect(frames.length).toBeGreaterThanOrEqual(6);
        expect(frames[0]?.[0]).toBeLessThan(frames.at(-1)?.[0] ?? 0);
        expect(frames[0]?.[2]).toBeGreaterThan(frames.at(-1)?.[2] ?? 255);
      },
      RENDER_MS
    );

    it(
      "resolves calculateMetadata the same way the preview does",
      async () => {
        const exported = await ship("Computed");
        const metadata = await renderer.getVideoMetadata(exported.path);

        expect(metadata.width).toBe(200);
        expect(metadata.height).toBe(100);

        // The container's own duration carries the last frame's length, so the
        // frames are what this counts: twelve of them, at the 24 fps the
        // composition computes for itself rather than the 1 it declares.
        const frames = await decoded(exported.path, {
          height: 100,
          width: 200,
        });

        expect(frames.length).toBe(12);
      },
      RENDER_MS
    );

    it(
      "trims an odd frame to even dimensions for H.264, and says the same size the dialog did",
      async () => {
        const exported = await ship("Odd");
        const metadata = await renderer.getVideoMetadata(exported.path);

        expect(metadata.width).toBe(320);
        expect(metadata.height).toBe(180);
        expect(exported.width).toBe(320);
        expect(exported.height).toBe(180);
      },
      RENDER_MS
    );

    it(
      "exports a 720 short side as 1280×720",
      async () => {
        const exported = await ship("Dom", { resolution: "720" });
        const metadata = await renderer.getVideoMetadata(exported.path);

        expect([metadata.width, metadata.height]).toEqual([1280, 720]);
      },
      RENDER_MS
    );

    it(
      "keeps the audio in a format that carries it, and drops it from a GIF",
      async () => {
        const withSound = await ship("Media", { format: "mp4" });
        const gif = await ship("Media", { format: "gif" });

        const sounded = await renderer.getVideoMetadata(withSound.path);

        expect(sounded.audioCodec).not.toBeNull();
        expect(sounded.codec).toBe("h264");

        // Remotion's own video probe answers "unknown" for a GIF, so this reads
        // the container's own header instead. A GIF has nowhere to put audio.
        const header = readFileSync(gif.path).subarray(0, 6).toString("ascii");

        expect(header).toMatch(GIF_HEADER);

        const frames = await decoded(gif.path, { height: 180, width: 320 });

        expect(frames.length).toBeGreaterThan(1);
      },
      RENDER_MS
    );

    it(
      "really encodes WebM/VP9 and MOV/ProRes",
      async () => {
        const webm = await ship("Dom", { format: "webm" });
        const mov = await ship("Dom", { format: "mov", quality: "draft" });

        expect((await renderer.getVideoMetadata(webm.path)).codec).toBe("vp9");
        expect((await renderer.getVideoMetadata(mov.path)).codec).toBe(
          "prores"
        );

        const frames = await decoded(mov.path, { height: 180, width: 320 });
        expect(frames.length).toBeGreaterThanOrEqual(6);
      },
      RENDER_MS
    );

    it(
      "leaves the file an earlier export wrote when a later one fails",
      async () => {
        const good = await ship("Dom");

        const failed = await Effect.runPromiseExit(
          exportFrom(
            PROJECT,
            {
              composition: "NotThere",
              format: "mp4",
              outputPath: good.path,
              preset: "custom",
              quality: "project",
              resolution: "source",
            },
            () => undefined
          )
        );

        expect(failed._tag).toBe("Failure");
        expect(existsSync(good.path)).toBe(true);
        expect((await renderer.getVideoMetadata(good.path)).width).toBe(320);
      },
      RENDER_MS
    );
  }
);
