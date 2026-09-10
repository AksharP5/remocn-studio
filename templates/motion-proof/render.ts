// biome-ignore-all lint/performance/noAwaitInLoops: A bounded serial render queue shares one browser to avoid oversubscribing CPU and RAM.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import {
  getCompositions,
  openBrowser,
  renderMedia,
  renderStill,
} from "@remotion/renderer";
import { cases } from "./cases";
import { checkTiming, reviewFrames } from "./studio-motion-v1/timing";

const output = resolve(process.argv[2]);
const requested = process.argv.slice(3);
const selected = cases.filter(
  (item) => requested.length === 0 || requested.includes(item.id)
);
const serveUrl = await bundle({
  entryPoint: resolve("src/entry.tsx"),
  publicDir: resolve("public"),
});
const browser = await openBrowser("chrome", { logLevel: "error" });
const results: {
  id: string;
  fps: number;
  width: number;
  height: number;
  frames: number;
  reviewFrames: number[];
  video: string;
  initialFrameClear: boolean;
  timingIssues: ReturnType<typeof checkTiming>;
}[] = [];
const comparisons: {
  first: string;
  second: string;
  seconds: number;
  equal: boolean;
}[] = [];
let failure: string | null = null;
try {
  const compositions = await getCompositions(serveUrl, {
    logLevel: "error",
    puppeteerInstance: browser,
  });
  for (const item of selected) {
    const composition = compositions.find(
      (candidate) => candidate.id === item.id
    );
    if (!composition) {
      throw new Error(`Composition missing: ${item.id}`);
    }
    const timingIssues = checkTiming(
      item.plan,
      composition.durationInFrames,
      item.fps
    );
    if (timingIssues.length) {
      throw new Error(JSON.stringify(timingIssues));
    }
    console.log(`Rendering ${item.id}: ${composition.durationInFrames} frames`);
    const video = `${item.id}.mp4`;
    await renderMedia({
      codec: "h264",
      composition,
      concurrency: 2,
      crf: 18,
      logLevel: "error",
      outputLocation: join(output, video),
      puppeteerInstance: browser,
      serveUrl,
    });
    const frames = reviewFrames(item.plan, item.fps);
    const directory = join(output, item.id);
    await mkdir(directory, { recursive: true });
    for (const frame of frames) {
      await renderStill({
        composition,
        frame,
        imageFormat: "png",
        logLevel: "error",
        output: join(directory, `${String(frame).padStart(5, "0")}.png`),
        puppeteerInstance: browser,
        serveUrl,
      });
    }
    const blank = join(directory, "expected-blank.png");
    await renderStill({
      composition: {
        ...composition,
        props: { ...composition.props, blank: true },
      },
      frame: 0,
      imageFormat: "png",
      logLevel: "error",
      output: blank,
      puppeteerInstance: browser,
      serveUrl,
    });
    const initialFrameClear = (await readFile(blank)).equals(
      await readFile(join(directory, "00000.png"))
    );
    if (!initialFrameClear) {
      throw new Error(
        `${item.id}: content leaks into the initial frame before the reveal`
      );
    }
    results.push({
      fps: item.fps,
      frames: composition.durationInFrames,
      height: item.height,
      id: item.id,
      initialFrameClear,
      reviewFrames: frames,
      timingIssues,
      video,
      width: item.width,
    });
    console.log(
      `Verified render: ${item.id}; ${frames.length} event frames saved`
    );
  }
  // PNG bytes at identical wall-clock times expose accidental frame-based timing.
  // This compares renders, including font fitting and React markup, not just math.
  for (const family of ["type-short", "image", "metric"]) {
    const first = compositions.find((item) => item.id === `${family}-30`);
    const second = compositions.find((item) => item.id === `${family}-60`);
    if (
      !(
        first &&
        second &&
        results.some((item) => item.id === first.id) &&
        results.some((item) => item.id === second.id)
      )
    ) {
      continue;
    }
    for (const seconds of [0.2, 0.5, 1, 2.5, 3]) {
      const hashes: string[] = [];
      for (const composition of [first, second]) {
        const file = join(output, composition.id, `time-${seconds}.png`);
        await renderStill({
          composition,
          frame: Math.round(seconds * composition.fps),
          imageFormat: "png",
          logLevel: "error",
          output: file,
          puppeteerInstance: browser,
          serveUrl,
        });
        hashes.push(
          createHash("sha256")
            .update(await readFile(file))
            .digest("hex")
        );
      }
      comparisons.push({
        equal: hashes[0] === hashes[1],
        first: first.id,
        second: second.id,
        seconds,
      });
    }
  }
  if (comparisons.some((item) => !item.equal)) {
    throw new Error(
      "Rendered motion differs at the same time between FPS variants; inspect comparisons"
    );
  }
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await browser.close({ silent: true });
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(
      {
        comparisons,
        failure,
        limits:
          "Mechanical render and timing coverage. Human visual review is separate; this is not a model-generation benchmark or audio evaluation.",
        remotion: manifest.dependencies.remotion,
        results,
        status: failure ? "failed" : "passed",
      },
      null,
      2
    )
  );
}
