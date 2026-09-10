// biome-ignore-all lint/performance/noAwaitInLoops: one temporary render session at a time bounds CPU/memory use.
import { strict as assert } from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { file, serve, spawn } from "bun";
import { Effect } from "effect";
import { importFrom, warmInternalsOf } from "../sidecar/preview/project";
import { runReadiness, sourceRevision } from "../sidecar/preview/readiness";
import type { Renderer } from "../sidecar/preview/still";
import { reviewCompletionProblem } from "../sidecar/tools/review";

const studio = path.resolve(import.meta.dir, "..");
const root = await mkdtemp(path.join(tmpdir(), "remocn-motion-contract-"));
const output = path.join(
  studio,
  "out/motion-contract-proof",
  new Date().toISOString().replaceAll(/[:.]/g, "-")
);
await mkdir(path.join(root, "src"));
await mkdir(output, { recursive: true });
await cp(
  path.join(studio, "templates/remotion/src/lib/studio-motion-v2"),
  path.join(root, "src/studio-motion-v2"),
  { recursive: true }
);
await cp(
  path.join(studio, "templates/motion-contract-proof/entry.tsx"),
  path.join(root, "src/entry.tsx")
);
await cp(
  path.join(studio, "templates/motion-proof/public"),
  path.join(root, "public"),
  { recursive: true }
);
await cp(
  path.join(studio, "templates/remotion/package.json"),
  path.join(root, "package.json")
);
if (process.env.REMOCN_MOTION_TEST_PROJECT) {
  await symlink(
    path.join(process.env.REMOCN_MOTION_TEST_PROJECT, "node_modules"),
    path.join(root, "node_modules")
  );
} else {
  await mkdir(path.join(root, "cache"));
  const install = spawn(["bun", "install"], {
    cwd: root,
    env: { ...process.env, BUN_INSTALL_CACHE_DIR: path.join(root, "cache") },
    stderr: "inherit",
    stdout: "inherit",
  });
  assert.equal(
    await install.exited,
    0,
    "Install the pinned template dependencies"
  );
}
const checker = spawn(
  [
    "bun",
    path.join(studio, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--jsx",
    "react-jsx",
    "--moduleResolution",
    "bundler",
    "--module",
    "esnext",
    "--target",
    "es2022",
    "--lib",
    "es2022,dom",
    "src/entry.tsx",
  ],
  { cwd: root, stderr: "inherit", stdout: "inherit" }
);
assert.equal(
  await checker.exited,
  0,
  "The actual copied runtime must typecheck"
);
const bundler = await Effect.runPromise(
  importFrom<{ bundle: (options: Record<string, unknown>) => Promise<string> }>(
    root,
    "@remotion/bundler"
  )
);
const renderer = await Effect.runPromise(
  importFrom<
    Renderer & {
      renderMedia: (options: Record<string, unknown>) => Promise<unknown>;
    }
  >(root, "@remotion/renderer")
);
const internals = await Effect.runPromise(warmInternalsOf(root));
const bundle = await bundler.bundle({
  enableCaching: false,
  entryPoint: path.join(root, "src/entry.tsx"),
  outDir: path.join(root, "dist"),
  publicDir: path.join(root, "public"),
  rootDir: root,
});
const server = serve({
  fetch: (request) =>
    new Response(
      file(path.join(bundle, decodeURIComponent(new URL(request.url).pathname)))
    ),
  hostname: "127.0.0.1",
  port: 0,
});
const ids = [
  "broken-phrases",
  "broken-caption",
  "broken-clipping",
  "phrases",
  "details",
  "details-portrait",
  "cards",
  "cards-portrait",
  "image",
  "metric",
];
const requested = process.argv.slice(2);
for (const id of requested) {
  assert(ids.includes(id), `Unknown proof: ${id}`);
}
const selected = requested.length ? requested : ids;
const results: unknown[] = [];
console.log(`Motion contract proof: ${output}`);
try {
  for (const id of selected) {
    console.log(`Checking ${id}`);
    const serveUrl = `http://localhost:${server.port}/index.html`;
    const measured = await renderer.selectComposition({
      chromiumOptions: { gl: "angle" },
      id,
      logLevel: "error",
      serveUrl,
      timeoutInMilliseconds: 30_000,
    });
    const result = await runReadiness(
      {
        composition: id,
        dir: output,
        internals,
        motion: [],
        options: {
          audio: { expected: false },
          maxDurationMs: 240_000,
          maxFrames: 900,
          sampleEveryFrames: 8,
        },
        progress: () => undefined,
        renderer,
        renderOptions: {
          chromeMode: null,
          chromiumOptions: { gl: "angle" },
          timeoutInMilliseconds: 30_000,
        },
        root,
        serveUrl,
        video: {
          camera: null,
          scenes: [
            { from: 0, name: id, to: Number(measured.durationInFrames) },
          ],
        },
      },
      new AbortController().signal
    );
    const report = result.readiness;
    assert(report);
    const defects = report.findings.filter(
      (finding) => finding.category === "motion_contract"
    );
    const codes = [...new Set(defects.map((finding) => finding.code))];
    const viewerErrors = report.findings.filter(
      (finding) =>
        finding.audience === "viewer" &&
        finding.conclusion === "measurement" &&
        finding.severity === "error" &&
        finding.exception === null
    );
    const row = {
      codes,
      coverage: report.coverage,
      id,
      report: report.path,
      sourceRevision: report.revision,
      viewerErrors,
    };
    results.push(row);
    await writeFile(
      path.join(output, "results.json"),
      JSON.stringify(results, null, 2)
    );
    console.log(
      `${id}: ${report.coverage.sampled.length} frames, ${codes.join(", ") || "no contract defects"}`
    );
    assert(
      report.coverage.motion?.contracts,
      "The checker must discover contracts in the real browser"
    );
    assert.equal(report.coverage.motion.unvisited.length, 0);
    assert.equal(report.coverage.failed.length, 0);
    assert.deepEqual(report.coverage.motion.uncovered, []);
    assert.equal(
      report.coverage.complete,
      true,
      JSON.stringify(report.coverage)
    );
    assert.equal(
      reviewCompletionProblem(report) === null,
      !id.startsWith("broken-")
    );
    if (id === "broken-phrases") {
      assert(codes.includes("motion_contract_collision"));
    } else if (id === "broken-caption") {
      assert(codes.includes("motion_contract_target"));
    } else if (id === "broken-clipping") {
      assert(viewerErrors.some((finding) => finding.code === "text_clipped"));
    } else {
      assert.equal(defects.length, 0, JSON.stringify(defects));
      assert.equal(viewerErrors.length, 0, JSON.stringify(viewerErrors));
      await renderer.renderMedia({
        chromiumOptions: { gl: "angle" },
        codec: "h264",
        composition: measured,
        concurrency: 2,
        crf: 18,
        logLevel: "error",
        outputLocation: path.join(output, `${id}.mp4`),
        serveUrl,
      });
    }
  }
} finally {
  server.stop(true);
  await writeFile(
    path.join(output, "source.json"),
    JSON.stringify(
      {
        fixtureSha256: createHash("sha256")
          .update(await readFile(path.join(root, "src/entry.tsx")))
          .digest("hex"),
        runtimeRevision: await sourceRevision(root, {}),
        workspace: root,
      },
      null,
      2
    )
  );
}
console.log(`Review rendered videos and event frames in ${output}`);
