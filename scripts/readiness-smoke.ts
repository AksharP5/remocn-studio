// biome-ignore-all lint/performance/noAwaitInLoops: sequential rendering and streaming keep resource use bounded and preserve frame order.
import { strict as assert } from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { file, serve } from "bun";
import { Effect } from "effect";
import { importFrom, warmInternalsOf } from "../sidecar/preview/project";
import { runReadiness } from "../sidecar/preview/readiness";
import { measureWav } from "../sidecar/preview/readiness-audio";
import type { Renderer } from "../sidecar/preview/still";

const dependencies = process.env.REMOCN_READINESS_TEST_PROJECT;
if (!dependencies) {
  throw new Error(
    "Set REMOCN_READINESS_TEST_PROJECT to a project with @remotion/bundler and @remotion/renderer installed."
  );
}
const root = await mkdtemp(path.join(tmpdir(), "remocn-readiness-smoke-"));
await mkdir(path.join(root, "src"));
await mkdir(path.join(root, "public"));
await writeFile(
  path.join(root, "package.json"),
  JSON.stringify({ name: "readiness-smoke", private: true })
);
await symlink(
  path.join(dependencies, "node_modules"),
  path.join(root, "node_modules")
);
await writeFile(
  path.join(root, "src/index.tsx"),
  await readFile(new URL("./fixtures/readiness.tsx.txt", import.meta.url))
);
function tone(hz: number, leadSeconds = 0) {
  const rate = 48_000,
    samples = rate * 4,
    buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) {
    buffer.writeInt16LE(
      i < rate * leadSeconds
        ? 0
        : Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 0.8 * 32_767),
      44 + i * 2
    );
  }
  return buffer;
}
await writeFile(path.join(root, "public/voice.wav"), tone(440, 1));
await writeFile(path.join(root, "public/music.wav"), tone(330));
const bundler = await Effect.runPromise(
  importFrom<{ bundle: (options: Record<string, unknown>) => Promise<string> }>(
    root,
    "@remotion/bundler"
  )
);
const renderer = await Effect.runPromise(
  importFrom<Renderer>(root, "@remotion/renderer")
);
const internals = await Effect.runPromise(warmInternalsOf(root));
const bundle = await bundler.bundle({
  enableCaching: false,
  entryPoint: path.join(root, "src/index.tsx"),
  outDir: path.join(root, "dist"),
  rootDir: root,
  webpackOverride: (config: Record<string, unknown>) => ({
    ...config,
    cache: false,
  }),
});
const server = serve({
  fetch: async (request) => {
    const url = new URL(request.url);
    const asset = file(path.join(bundle, decodeURIComponent(url.pathname)));
    return (await asset.exists())
      ? new Response(asset)
      : new Response("Missing fixture resource", { status: 404 });
  },
  port: 0,
});
let last = "";
const base = {
  composition: "Main",
  dir: path.join(root, "out"),
  internals,
  motion: [],
  progress: (stage: string, done: number, total: number) => {
    if (stage !== last) {
      process.stdout.write(`${stage} ${done}/${total}\n`);
      last = stage;
    }
  },
  renderer,
  renderOptions: {
    chromeMode: null,
    chromiumOptions: { gl: "angle" },
    timeoutInMilliseconds: 15_000,
  },
  root,
  serveUrl: `http://localhost:${server.port}/index.html`,
  video: {
    camera: null,
    scenes: [
      { from: 0, name: "First", to: 60 },
      { from: 60, name: "Second", to: 120 },
    ],
  },
};
try {
  if (process.env.REMOCN_READINESS_SMOKE_ONLY !== "failures") {
    for (const fixed of [false, true]) {
      const result = await runReadiness(
        {
          ...base,
          options: {
            audio: {
              expected: true,
              speechIntervals: [{ from: 0, to: 60 }],
              stems: [
                { inputProps: { music: false, voice: true }, role: "speech" },
                { inputProps: { music: true, voice: false }, role: "music" },
              ],
            },
            inputProps: { fixed },
            insets: { bottom: 30, left: 30, right: 30, top: 30 },
            maxDurationMs: 120_000,
            maxFrames: 100,
            platform: "custom",
            sampleEveryFrames: 6,
          },
        },
        new AbortController().signal
      );
      const report = result.readiness;
      assert(report);
      await writeFile(
        path.join(root, fixed ? "fixed.json" : "defective.json"),
        JSON.stringify(report, null, 2)
      );
      process.stdout.write(
        `${JSON.stringify({ checks: report.checks, codes: [...new Set(report.findings.map((x) => x.code))], elapsedMs: report.coverage.elapsedMs, failed: report.coverage.failed, fixed, frames: report.coverage.sampled.length, peakRss: report.coverage.peakRssBytes })}\n`
      );
      assert(
        report.coverage.sampled.length > 9,
        "Must sample more than legacy key-frame limit"
      );
      assert(
        report.checks.some(
          (x) => x.rule === "audio_clipping" && x.status === "completed"
        ),
        "Actual audio mix must be measured"
      );
      const speech = await measureWav(
        path.join(path.dirname(report.path), "stem-0.wav")
      );
      const onset = speech.windows.find((window) => window.rms > 0.01)?.from;
      assert(onset !== undefined);
      assert(
        Math.abs(onset - (fixed ? 1 : 0.4)) < 0.07,
        `Trim/playback onset ${onset}`
      );
      const codes = new Set(report.findings.map((row) => row.code));
      const defects = [
        "text_clipped",
        "text_out_of_frame",
        "contrast_aa_failure",
        "text_reading_time",
        "audio_clipping",
        "audio_speech_masking",
        "audio_speech_boundary",
        "audio_tail_boundary",
      ];
      for (const code of defects) {
        assert.equal(codes.has(code), !fixed, `${code}: fixed=${fixed}`);
      }
    }

    const long = await runReadiness(
      {
        ...base,
        composition: "Long",
        options: {
          inputProps: { fixed: true },
          maxDurationMs: 120_000,
          maxFrames: 80,
        },
        video: {
          camera: null,
          scenes: [
            { from: 0, name: "Long first", to: 900 },
            { from: 900, name: "Long second", to: 1800 },
          ],
        },
      },
      new AbortController().signal
    );
    assert(long.readiness);
    assert(!long.readiness.coverage.complete);
    assert(long.readiness.coverage.sampled.includes(1799));
    process.stdout.write(
      `Long benchmark: ${JSON.stringify(long.readiness.coverage)}\n`
    );
    const controller = new AbortController();
    const cancelled = await runReadiness(
      {
        ...base,
        options: { maxFrames: 100 },
        progress: (stage, done) => {
          if (stage === "frames" && done === 5) {
            controller.abort();
          }
        },
      },
      controller.signal
    );
    assert(cancelled.readiness?.coverage.cancelled);
    assert((cancelled.readiness?.coverage.sampled.length ?? 0) > 0);
    assert(!cancelled.readiness?.coverage.complete);
    process.stdout.write(
      `Cancelled with ${cancelled.readiness?.coverage.sampled.length} retained frames\n`
    );
    const resource = await runReadiness(
      {
        ...base,
        options: {
          inputProps: {
            badResource: true,
            fixed: true,
            music: false,
            voice: false,
          },
          maxDurationMs: 30_000,
          maxFrames: 12,
        },
      },
      new AbortController().signal
    );
    assert(
      resource.readiness?.findings.some(
        (row) => row.code === "resource_failed" || row.code === "render_failed"
      ) || resource.readiness?.coverage.failed.length
    );
    process.stdout.write(
      `Resource fixture: ${resource.readiness?.findings.map((x) => x.code).join(",")}\n`
    );
  }
  const partial = await runReadiness(
    {
      ...base,
      options: {
        inputProps: { badFrame: true, fixed: true },
        maxDurationMs: 60_000,
        maxFrames: 20,
      },
    },
    new AbortController().signal
  );
  assert((partial.readiness?.coverage.sampled.length ?? 0) > 0);
  assert((partial.readiness?.coverage.failed.length ?? 0) > 0);
  assert(!partial.readiness?.coverage.complete);
  const transparent = await runReadiness(
    {
      ...base,
      options: {
        inputProps: {
          fixed: true,
          music: false,
          transparent: true,
          voice: false,
        },
        maxDurationMs: 30_000,
        maxFrames: 12,
      },
    },
    new AbortController().signal
  );
  assert(
    transparent.readiness?.checks.some(
      (check) => check.rule === "contrast" && check.status === "skipped"
    )
  );
  process.stdout.write(
    `Partial render retains ${partial.readiness?.coverage.sampled.length} frames; transparent contrast is skipped\n`
  );
  process.stdout.write(`Evidence: ${root}\n`);
} finally {
  server.stop(true);
}
