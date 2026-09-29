// biome-ignore-all lint/performance/noAwaitInLoops: sequential rendering and streaming keep resource use bounded and preserve frame order.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  readlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Effect, Schema } from "effect";
import type { VideoCheck } from "./choreography";
import { type VideoSample, videoFindings, videoPlan } from "./choreography";
import {
  type DesignFinding,
  type DesignResult,
  type MotionAssertion,
  motionFrames,
} from "./design";
import type { Exporter } from "./export";
import { footageRule, measureFootage } from "./footage";
import { MotionContractReview } from "./motion-contract";
import { type Measured, PreviewError, type RenderOptions } from "./project";
import {
  type AuditSample,
  analyzeFrames,
  analyzeMotion,
  applyIntentExceptions,
  fullPlan,
  makeFinding,
  mergeFindings,
  SAFE_PROFILES,
  unmeasuredIntervals,
} from "./readiness-analysis";
import {
  type AudioMeasurement,
  analyzeAudio,
  measureWav,
} from "./readiness-audio";
import { type ReadinessOptions, ReadinessReport } from "./readiness-contract";
import { openSession, type Session, type WarmInternals } from "./session";
import { type Renderer, readyBrowser } from "./still";

const RULES = [
  "text_bounds",
  "contrast",
  "reading_time",
  "safe_zones",
  "resources",
  "render",
  "motion_assertions",
  "choreography",
  "pauses",
  "transitions",
  "motion_contract",
  "audio_clipping",
  "audio_headroom",
  "audio_presence",
  "audio_silence",
  "audio_boundaries",
  "audio_masking",
  "footage_timing",
];
const ignored = new Set([
  "node_modules",
  ".git",
  ".next",
  ".cache",
  "out",
  "dist",
  "build",
  ".remocn",
  ".remotion",
  "coverage",
]);
const PRODUCTION_NOTES = /^src\/videos\/[^/]+\/docs$/;
export async function sourceRevision(
  root: string,
  extra: unknown,
  signal?: AbortSignal
): Promise<string> {
  const hash = createHash("sha256");
  hash.update(
    JSON.stringify(extra, (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).sort(([left], [right]) =>
              left.localeCompare(right)
            )
          )
        : value
    )
  );
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: deterministic directory walk hashes source, assets and symlinks while excluding production notes.
  const walk = async (folder: string) => {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      signal?.throwIfAborted();
      if (ignored.has(entry.name)) {
        continue;
      }
      const file = path.join(folder, entry.name);
      // Pipeline notes are not compiled by the video registry. Writing the review
      // must not invalidate the render it describes; actual source/assets still do.
      if (
        entry.isDirectory() &&
        PRODUCTION_NOTES.test(
          path.relative(root, file).split(path.sep).join("/")
        )
      ) {
        continue;
      }
      hash.update(path.relative(root, file));
      if (entry.isDirectory()) {
        await walk(file);
      } else if (entry.isSymbolicLink()) {
        hash.update(`symlink:${await readlink(file)}`);
      } else if (entry.isFile()) {
        for await (const bytes of createReadStream(file, { signal })) {
          hash.update(bytes);
        }
      }
    }
  };
  await walk(root);
  return hash.digest("hex");
}

export interface ReadinessInput {
  composition: string;
  dir: string;
  internals: WarmInternals | null;
  motion: readonly MotionAssertion[];
  options: ReadinessOptions;
  progress: (stage: string, completed: number, total: number) => void;
  publicDir: string;
  renderer: Renderer;
  renderOptions: RenderOptions;
  root: string;
  serveUrl: string;
  staticBase: string;
  video: VideoCheck | null;
}

export function checkReadiness(
  input: ReadinessInput
): Effect.Effect<DesignResult, PreviewError> {
  return Effect.tryPromise({
    catch: (cause) => new PreviewError({ message: String(cause) }),
    try: (signal) => runReadiness(input, signal),
  });
}

function validate(options: ReadinessOptions): void {
  for (const [name, value, min, max] of [
    ["maxFrames", options.maxFrames, 4, 5000],
    ["maxDurationMs", options.maxDurationMs, 1000, 3_600_000],
    ["sampleEveryFrames", options.sampleEveryFrames, 1, 3600],
    ["wordsPerMinute", options.wordsPerMinute, 30, 1000],
    ["charactersPerSecond", options.charactersPerSecond, 1, 100],
    ["readingLeadSeconds", options.readingLeadSeconds, 0, 10],
    ["readableOpacity", options.readableOpacity, 0.1, 1],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < min || value > max)
    ) {
      throw new Error(`${name} must be between ${min} and ${max}.`);
    }
  }
  if (options.platform === "custom" && !options.insets) {
    throw new Error("Custom safe zones require explicit pixel insets.");
  }
  if (
    options.insets &&
    Object.values(options.insets).some((x) => !Number.isFinite(x) || x < 0)
  ) {
    throw new Error("Safe zone insets must be non-negative pixels.");
  }
  if (options.language) {
    Intl.getCanonicalLocales(options.language);
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one coordinator owns partial results and resource cleanup across every check stage.
export async function runReadiness(
  input: ReadinessInput,
  signal: AbortSignal
): Promise<DesignResult> {
  validate(input.options);
  const started = Date.now(),
    id = randomUUID(),
    folder = path.join(input.dir, `readiness-${id}`);
  await mkdir(folder, { recursive: true });
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) {
    abort();
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Analysis time budget exhausted."));
  }, input.options.maxDurationMs ?? 180_000);
  const active = controller.signal;
  const run = <A>(effect: Effect.Effect<A, PreviewError>) =>
    Effect.runPromise(effect, { signal: active });
  const checks = new Map<string, ReadinessReport["checks"][number]>(
    RULES.map((rule) => [
      rule,
      {
        reason: "Analysis has not reached this check.",
        rule,
        status: "skipped",
      },
    ])
  );
  const status = (
    rule: string,
    state: ReadinessReport["checks"][number]["status"],
    reason: string
  ) => checks.set(rule, { reason, rule, status: state });
  const samples: AuditSample[] = [],
    failed: { frame: number; reason: string }[] = [],
    limitations = new Set<string>([
      "Temporal sampling cannot prove correctness of every frame.",
      "peakRssBytes measures the preview host process; Chromium and encoder memory are separate.",
      "Remote resource content and symlink targets are not pinned; recheck after external changes.",
      "Source revision is checked before and after analysis; nondeterministic rendering is not fingerprinted.",
    ]);
  let session: Session | null = null,
    measured: Measured | null = null,
    revision = "",
    stale = false,
    planned = 0,
    limited = false;
  let motionReview: MotionContractReview | null = null;
  let findings: ReadinessReport["findings"][number][] = [],
    fps = 30,
    duration = 0,
    width = 0,
    height = 0,
    peakRss = process.memoryUsage().rss;
  const props = input.options.inputProps ?? {};
  // Exceptions do not affect the measured inputs and must not invalidate themselves.
  const { exceptions: _exceptions, ...measurementOptions } = input.options;
  const identity = {
    composition: input.composition,
    context: { motion: input.motion, video: input.video },
    options: measurementOptions,
    render: input.renderOptions,
  };
  const audioStems: {
    role: "speech" | "music" | "sfx";
    measurement: AudioMeasurement;
  }[] = [];
  try {
    input.progress("preparing", 0, 1);
    revision = await sourceRevision(input.root, identity, active);
    await run(
      readyBrowser({
        onEvent: () => input.progress("browser", 0, 1),
        options: input.renderOptions,
        renderer: input.renderer,
      })
    );
    measured = await input.renderer.selectComposition({
      chromiumOptions: input.renderOptions.chromiumOptions,
      id: input.composition,
      inputProps: props,
      logLevel: "error",
      serveUrl: input.serveUrl,
      ...(input.renderOptions.chromeMode
        ? { chromeMode: input.renderOptions.chromeMode }
        : {}),
      timeoutInMilliseconds: Math.min(
        input.renderOptions.timeoutInMilliseconds ?? 30_000,
        input.options.maxDurationMs ?? 180_000
      ),
    });
    active.throwIfAborted();
    fps = Number(measured.fps);
    duration = Number(measured.durationInFrames);
    ({ width, height } = measured);
    if (!(fps > 0 && duration > 0 && width > 0 && height > 0)) {
      throw new Error(
        "Composition metadata has invalid dimensions, fps or duration."
      );
    }
    if (input.video) {
      for (const [i, scene] of input.video.scenes.entries()) {
        if (
          scene.from < 0 ||
          scene.to > duration ||
          scene.to <= scene.from ||
          (i > 0 && scene.from <= (input.video.scenes[i - 1]?.from ?? -1))
        ) {
          throw new Error(`Invalid scene interval: ${scene.name}.`);
        }
      }
    }
    if (!input.video) {
      limitations.add(
        "No scene map: a uniform temporal grid is used; short scenes and exact transitions may be missed."
      );
    }
    if (
      input.options.insets &&
      (input.options.insets.left + input.options.insets.right >= width ||
        input.options.insets.top + input.options.insets.bottom >= height)
    ) {
      throw new Error("Safe zone insets leave no visible safe area.");
    }
    if (!input.internals) {
      throw new Error(
        "This Remotion version does not expose browser audit internals."
      );
    }
    session = await run(
      openSession({
        composition: input.composition,
        inputProps: props,
        internals: input.internals,
        measured,
        options: input.renderOptions,
        root: input.root,
        serveUrl: input.serveUrl,
        timeoutMs: input.renderOptions.timeoutInMilliseconds ?? 30_000,
      })
    );
    const plan = fullPlan(duration, fps, input.video, input.options);
    motionReview = new MotionContractReview(fps, duration);
    const checkedMotion = input.motion.filter(
      (assertion) =>
        assertion.kind !== "keeps_moving" ||
        (assertion.maxStaticFrames > 0 &&
          assertion.to > assertion.from &&
          Math.ceil(
            (assertion.to - assertion.from) /
              Math.max(1, Math.floor(assertion.maxStaticFrames / 2))
          ) +
            1 <=
            (input.options.maxFrames ?? 360))
    );
    const asserted = motionFrames(checkedMotion);
    const queue = [...new Set([0, ...plan.frames, ...asserted])];
    planned = Math.max(plan.required, queue.length);
    ({ limited } = plan);
    const maxFrames = input.options.maxFrames ?? 360;
    const seen = new Set<number>();
    const videoSamples: VideoSample[] = [];
    while (queue.length && seen.size < maxFrames) {
      if (active.aborted) {
        break;
      }
      const frame = queue.shift();
      if (frame === undefined || seen.has(frame)) {
        continue;
      }
      seen.add(frame);
      if (frame < 0 || frame >= duration) {
        failed.push({ frame, reason: "Frame outside composition." });
        continue;
      }
      input.progress("frames", seen.size, maxFrames);
      const output = path.join(folder, `frame-${frame}.png`);
      try {
        const audit = await run(
          session.audit(
            frame,
            output,
            input.motion.map((x) => x.selector),
            input.options.readableOpacity ?? 0.8
          )
        );
        samples.push({ audit, frame, output });
        const boundaries = motionReview.discover(
          frame,
          audit.details?.motionPlans ?? []
        );
        // Executed plans know short transitions that a uniform sample cannot discover.
        const next = boundaries.filter((at) => !seen.has(at));
        for (const at of next) {
          const existing = queue.indexOf(at);
          if (existing !== -1) {
            queue.splice(existing, 1);
          }
        }
        queue.unshift(...next);
        planned = Math.max(planned, new Set([...seen, ...queue]).size);
        for (const limitation of audit.details?.limitations ?? []) {
          limitations.add(limitation);
        }
        const probe = await run(
          session.probe(frame, input.video?.camera ?? null)
        );
        videoSamples.push({ ...probe, frame });
        // Refine defects and changes locally while reserving initial coverage across every scene.
        const previous = samples.at(-2);
        if (
          audit.findings.length ||
          (audit.details?.darkFraction ?? 0) > 0.98 ||
          (previous && previous.audit.fingerprint !== audit.fingerprint)
        ) {
          for (const near of [
            frame - 1,
            frame + 1,
            Math.floor((frame + (previous?.frame ?? frame)) / 2),
          ]) {
            if (
              near >= 0 &&
              near < duration &&
              !seen.has(near) &&
              !queue.includes(near)
            ) {
              queue.push(near);
            }
          }
        }
      } catch (error) {
        if (active.aborted) {
          break;
        }
        failed.push({ frame, reason: String(error) });
      }
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }
    if (queue.length) {
      limited = true;
      limitations.add(
        "Frame budget exhausted; unvisited planned/refinement frames are not checked."
      );
    }
    findings = analyzeFrames(
      samples,
      fps,
      width,
      height,
      input.video,
      input.options,
      plan.step
    );
    findings.push(...motionReview.findings(samples));
    const footage = await footageRule(
      measureFootage({
        fps,
        publicDir: input.publicDir,
        root: input.root,
        serveUrl: input.serveUrl,
        sightings: samples.map(({ audit, frame }) => ({
          footage: audit.footage,
          frame,
        })),
        staticBase: input.staticBase,
      })
    );
    findings.push(...footage.findings);
    status("footage_timing", footage.status, footage.reason);
    const contractCoverage = motionReview.summary(
      samples.map((sample) => sample.frame)
    );
    let contractStatus: "completed" | "failed" | "skipped" = "skipped";
    if (
      contractCoverage.contracts &&
      !contractCoverage.unvisited.length &&
      !contractCoverage.uncovered.length
    ) {
      contractStatus = "completed";
    }
    if (contractCoverage.invalid.length) {
      contractStatus = "failed";
    }
    status(
      "motion_contract",
      contractStatus,
      contractCoverage.contracts
        ? `${contractCoverage.cues} cues; ${contractCoverage.boundaries.length} event frames, ${contractCoverage.unvisited.length} unvisited.`
        : "No runtime motion contract was found. Add MotionReview around the generated sequence to inspect exact event boundaries."
    );
    if (!contractCoverage.contracts) {
      limitations.add(
        "No runtime motion contract: exact component handoffs, group exits and declared reading positions are not verified."
      );
    }
    if (contractCoverage.unvisited.length) {
      limited = true;
      limitations.add(
        `${contractCoverage.unvisited.length} motion event frames remain unvisited; increase the review budget.`
      );
    }
    if (contractCoverage.contracts && contractCoverage.uncovered.length) {
      limited = true;
      limitations.add(
        "Parts of the composition have no runtime motion contract. Keep MotionReview mounted across the full authored sequence and include each scene's executable plan."
      );
    }
    for (const rule of [
      "text_bounds",
      "reading_time",
      "resources",
      "render",
      "pauses",
      "transitions",
    ]) {
      status(
        rule,
        samples.length ? "completed" : "failed",
        `Measured ${samples.length} frames; ${failed.length} frame failures. See coverage for unvisited intervals.`
      );
    }
    if (failed.length) {
      status(
        "render",
        "failed",
        `${failed.length} frames failed; ${samples.length} successfully inspected frames are retained.`
      );
      findings.push(
        ...failed.map((row) =>
          makeFinding({
            category: "resources",
            code: "render_failed",
            conclusion: "measurement",
            expected: "A renderable frame.",
            from: row.frame,
            message: "Frame rendering or inspection failed.",
            observed: row.reason,
            scene:
              input.video?.scenes.find(
                (scene) => scene.from <= row.frame && scene.to > row.frame
              )?.name ?? null,
            severity: "error",
            to: row.frame + 1,
          })
        )
      );
    }
    const chronological = samples.map((s) => s.frame).sort((a, b) => a - b);
    if (
      chronological.some(
        (frame, i) =>
          i > 0 && frame - (chronological[i - 1] ?? frame) > plan.step + 1
      )
    ) {
      status(
        "reading_time",
        "skipped",
        "Temporal gaps exceed the reading-window resolution; increase the frame/time budget."
      );
      findings = findings.filter((row) => row.category !== "reading_time");
    }
    const contrasts = samples.flatMap((s) => s.audit.details?.contrast ?? []);
    const unknown = contrasts.filter((c) => c.ratio === null);
    status(
      "contrast",
      contrasts.some((c) => c.ratio !== null) ? "completed" : "skipped",
      `${contrasts.length - unknown.length} rendered-background measurements; ${unknown.length} unknown backgrounds. WCAG thresholds are guidance, not certification.`
    );
    for (const row of unknown) {
      limitations.add(`${row.selector}: ${row.reason}`);
    }
    status(
      "safe_zones",
      input.options.platform ? "completed" : "not_applicable",
      input.options.platform
        ? `Explicit ${input.options.platform} profile; applied bounds are recorded with findings. Profiles are conservative guidance and UI can vary.`
        : "No platform profile selected. Composition bounds remain checked."
    );
    if (input.options.platform) {
      const profile =
        input.options.platform === "custom"
          ? null
          : SAFE_PROFILES[input.options.platform];
      const bounds =
        input.options.insets ??
        (profile
          ? {
              bottom: profile.bottom * height,
              left: profile.left * width,
              right: profile.right * width,
              top: profile.top * height,
            }
          : null);
      status(
        "safe_zones",
        "completed",
        JSON.stringify({
          basis: profile?.basis ?? "User supplied insets",
          height,
          insets: bounds,
          limitation:
            "Conservative guidance; actual overlays vary by device, caption and placement.",
          platform: input.options.platform,
          reviewed: profile?.date ?? new Date().toISOString().slice(0, 10),
          source: profile?.source ?? "User-defined pixel insets",
          width,
        })
      );
    }
    const motionResult = analyzeMotion(
      input.motion,
      samples,
      width,
      height,
      input.options.maxFrames ?? 360
    );
    const motion = motionResult.findings;
    findings.push(
      ...motion.map((row) =>
        makeFinding({
          ...row,
          category: "motion",
          conclusion: "measurement",
          evidence: row.frames.flatMap((frame) =>
            samples.filter((s) => s.frame === frame).map((s) => s.output)
          ),
          from: row.frames[0] ?? 0,
          to: (row.frames.at(-1) ?? 0) + 1,
        })
      )
    );
    status(
      "motion_assertions",
      motionStatus(input.motion.length, motionResult.complete),
      input.motion.length
        ? "Declared assertions evaluated where all required frames fit the budget; missing targets remain findings. Oversized or unvisited assertion intervals are unverified."
        : "No motion assertions declared."
    );
    if (input.video && input.video.scenes.length >= 1) {
      const choreography = videoFindings({
        fps,
        plan: videoPlan(
          input.video,
          duration,
          videoSamples.map((s) => s.frame)
        ),
        samples: videoSamples.sort((a, b) => a.frame - b.frame),
        video: input.video,
      });
      findings.push(
        ...choreography
          .filter((row) => row.code !== "video_frozen_run")
          .map((row) =>
            makeFinding({
              ...row,
              audience: "intent",
              category: "motion",
              evidence: row.frames.flatMap((frame) =>
                samples.filter((s) => s.frame === frame).map((s) => s.output)
              ),
              from: row.frames[0] ?? 0,
              to: (row.frames.at(-1) ?? 0) + 1,
            })
          )
      );
      status(
        "choreography",
        "completed",
        "Existing rhythm, boundary and camera analysis reused over available samples; static camera and uniform rhythm are intent recommendations."
      );
    } else {
      status(
        "choreography",
        "not_applicable",
        "No declared scene map. A single continuous shot is sufficient for camera analysis; rhythm and boundary comparisons need multiple shots."
      );
    }
    if (!active.aborted) {
      try {
        const mix = await renderMix(
          input,
          measured,
          props,
          path.join(folder, "mix.wav"),
          active
        );
        findings.push(
          ...mergeFindings(
            analyzeAudio(mix, fps, plan.boundaries, input.options),
            0,
            fps
          )
        );
        for (const rule of [
          "audio_clipping",
          "audio_headroom",
          "audio_silence",
          "audio_boundaries",
        ]) {
          status(
            rule,
            "completed",
            "Measured the actual Remotion PCM mix; optional stem failures do not erase this measurement."
          );
        }
        status(
          "audio_presence",
          input.options.audio?.expected ||
            input.options.audio?.expectedIntervals?.length
            ? "completed"
            : "not_applicable",
          "Absence is a defect only with explicit audio expectation."
        );
        for (const [index, stem] of (
          input.options.audio?.stems ?? []
        ).entries()) {
          const stemProps = { ...props, ...stem.inputProps };
          const stemMeasured = await input.renderer.selectComposition({
            chromiumOptions: input.renderOptions.chromiumOptions,
            id: input.composition,
            inputProps: stemProps,
            logLevel: "error",
            serveUrl: input.serveUrl,
            timeoutInMilliseconds: 30_000,
          });
          if (
            stemMeasured.durationInFrames !== duration ||
            stemMeasured.fps !== fps
          ) {
            throw new Error(
              "A role stem changed the composition timeline; masking measurement is invalid."
            );
          }
          audioStems.push({
            measurement: await renderMix(
              input,
              stemMeasured,
              stemProps,
              path.join(folder, `stem-${index}.wav`),
              active
            ),
            role: stem.role,
          });
        }
        findings.push(
          ...mergeFindings(
            analyzeAudio(
              mix,
              fps,
              plan.boundaries,
              input.options,
              audioStems
            ).filter(
              (row) =>
                row.code === "audio_speech_masking" || row.evidence.length > 1
            ),
            1,
            fps
          )
        );
        for (const rule of [
          "audio_clipping",
          "audio_headroom",
          "audio_silence",
          "audio_boundaries",
        ]) {
          status(
            rule,
            "completed",
            "Measured the actual Remotion PCM mix with trim, playback rate, fades and Sequence bounds."
          );
        }
        status(
          "audio_presence",
          input.options.audio?.expected ||
            input.options.audio?.expectedIntervals?.length
            ? "completed"
            : "not_applicable",
          "Absence is a defect only with an explicit audio expectation."
        );
        const canMask =
          audioStems.some((s) => s.role === "speech") &&
          audioStems.some((s) => s.role !== "speech") &&
          !!input.options.audio?.speechIntervals?.length;
        status(
          "audio_masking",
          canMask ? "completed" : "skipped",
          canMask
            ? "Measured mix and role stems during declared speech intervals; intelligibility remains a heuristic."
            : "Masking requires role-isolated render props and speech intervals. The full mix was measured; volume declarations alone are insufficient."
        );
        limitations.add(
          "Sample peaks are measured; intersample true peaks and semantic word truncation are not determined."
        );
      } catch (error) {
        for (const rule of RULES.filter((x) => x.startsWith("audio_"))) {
          if (checks.get(rule)?.status === "skipped") {
            status(rule, active.aborted ? "skipped" : "failed", String(error));
          }
        }
        limitations.add(`Audio analysis did not finish: ${String(error)}`);
      }
    }
  } catch (error) {
    limitations.add(String(error));
    if (!active.aborted) {
      status("render", "failed", String(error));
      findings.push(
        makeFinding({
          category: "resources",
          code: "render_failed",
          conclusion: "measurement",
          expected: "Composition can be prepared and rendered.",
          from: 0,
          message: "Composition preparation or rendering failed.",
          observed: String(error),
          severity: "error",
          to: Math.max(1, duration),
        })
      );
    }
  } finally {
    if (session) {
      await Effect.runPromise(session.close);
    }
  }
  if (revision && !active.aborted) {
    try {
      stale = revision !== (await sourceRevision(input.root, identity, active));
    } catch {
      stale = true;
    }
  }
  clearTimeout(timer);
  signal.removeEventListener("abort", abort);
  if (active.aborted) {
    limitations.add(
      timedOut ? "Time budget exhausted." : "Analysis cancelled."
    );
    limitations.add(
      "Input revision was not revalidated after interruption; reload the report before using its evidence."
    );
    limited = true;
  }
  if (stale) {
    limitations.add(
      "Sources or assets changed during analysis. This report is stale; recheck all scenes."
    );
  }
  findings = applyIntentExceptions(findings, input.options, revision, stale);
  const report: ReadinessReport = {
    checks: [...checks.values()],
    composition: input.composition,
    context: { motion: input.motion, video: input.video },
    coverage: {
      ...(motionReview
        ? {
            motion: motionReview.summary(samples.map((sample) => sample.frame)),
          }
        : {}),
      cancelled: signal.aborted,
      complete:
        !(limited || stale) &&
        failed.length === 0 &&
        samples.length > 0 &&
        ![...checks.values()].some((x) => x.status === "failed"),
      durationInFrames: duration,
      elapsedMs: Date.now() - started,
      exhaustive:
        samples.length === duration && failed.length === 0 && duration > 0,
      failed,
      fps,
      limitations: [...limitations],
      peakRssBytes: Math.max(peakRss, process.memoryUsage().rss),
      planned: Math.max(planned, samples.length + failed.length),
      sampled: samples.map((s) => s.frame).sort((a, b) => a - b),
      strategy: input.video ? "scene_aware_sampled" : "uniform_sampled",
      unmeasuredIntervals: unmeasuredIntervals(
        samples.map((sample) => sample.frame),
        duration
      ),
    },
    createdAt: new Date().toISOString(),
    findings,
    height,
    id,
    options: input.options,
    path: path.join(folder, "report.json"),
    project: input.root,
    props: (measured?.props && typeof measured.props === "object"
      ? measured.props
      : props) as Record<string, unknown>,
    revision,
    stale,
    width,
  };
  await writeFile(
    path.join(folder, "report.json"),
    JSON.stringify(report, null, 2)
  );
  input.progress("done", samples.length, Math.max(samples.length, planned));
  return resultFromReport(report);
}

async function renderMix(
  input: ReadinessInput,
  measured: Measured,
  props: Record<string, unknown>,
  output: string,
  signal: AbortSignal
): Promise<AudioMeasurement> {
  const renderer = input.renderer as Renderer & Partial<Exporter>;
  if (!(renderer.renderMedia && renderer.makeCancelSignal)) {
    throw new Error("Project renderer has no audio mixdown API.");
  }
  signal.throwIfAborted();
  const cancellation = renderer.makeCancelSignal();
  signal.addEventListener("abort", cancellation.cancel, { once: true });
  try {
    await renderer.renderMedia({
      chromiumOptions: input.renderOptions.chromiumOptions,
      codec: "wav",
      composition: measured,
      concurrency: 2,
      logLevel: "error",
      outputLocation: output,
      overwrite: true,
      serveUrl: input.serveUrl,
      ...(input.renderOptions.chromeMode
        ? { chromeMode: input.renderOptions.chromeMode }
        : {}),
      cancelSignal: cancellation.cancelSignal,
      enforceAudioTrack: true,
      inputProps: props,
      onProgress: (progress) =>
        input.progress(
          "audio",
          progress.renderedFrames,
          Number(measured.durationInFrames)
        ),
      onStart: () =>
        input.progress("audio", 0, Number(measured.durationInFrames)),
      timeoutInMilliseconds:
        input.renderOptions.timeoutInMilliseconds ?? 30_000,
    });
    signal.throwIfAborted();
    return await measureWav(output, signal);
  } finally {
    signal.removeEventListener("abort", cancellation.cancel);
  }
}

const REPORT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function readReadinessReport(
  input: Pick<ReadinessInput, "root" | "dir" | "composition" | "renderOptions">,
  id: string,
  options?: ReadinessOptions
): Promise<DesignResult> {
  if (!REPORT_ID.test(id)) {
    throw new Error("Invalid readiness report id.");
  }
  const location = path.join(input.dir, `readiness-${id}`, "report.json");
  const report = Schema.decodeUnknownSync(ReadinessReport)(
    JSON.parse(await readFile(location, "utf8"))
  );
  if (
    report.project !== input.root ||
    report.composition !== input.composition
  ) {
    throw new Error("Report belongs to another project or composition.");
  }
  const { exceptions: _exceptions, ...measurementOptions } =
    options ?? report.options;
  const revision = await sourceRevision(input.root, {
    composition: input.composition,
    context: report.context,
    options: measurementOptions,
    render: input.renderOptions,
  });
  const stale = report.stale || revision !== report.revision;
  const readiness = {
    ...report,
    coverage: {
      ...report.coverage,
      complete: report.coverage.complete && !stale,
    },
    findings: report.findings.map((row) => ({
      ...row,
      exception: stale ? null : row.exception,
    })),
    stale,
  };
  await writeFile(location, JSON.stringify(readiness, null, 2));
  return resultFromReport(readiness);
}

function resultFromReport(report: ReadinessReport): DesignResult {
  const findings: DesignFinding[] = report.findings
    .filter((row) => row.exception === null && row.audience !== "tunability")
    .map((row) => ({
      bbox: row.bbox,
      code: row.code as DesignFinding["code"],
      expected: row.expected,
      fix: row.fix,
      frames: row.frames,
      message: row.message,
      observed: row.observed,
      selector: row.selector,
      severity: row.severity,
      text: null,
    }));
  return {
    composition: report.composition,
    findings,
    frames: report.coverage.sampled,
    height: report.height,
    readiness: report,
    snapshots: report.coverage.sampled.map((frame) => ({
      frame,
      path: path.join(path.dirname(report.path), `frame-${frame}.png`),
    })),
    summary: {
      errors: findings.filter((row) => row.severity === "error").length,
      info: findings.filter((row) => row.severity === "info").length,
      warnings: findings.filter((row) => row.severity === "warning").length,
    },
    width: report.width,
  };
}

function motionStatus(
  count: number,
  covered: boolean
): "not_applicable" | "completed" | "skipped" {
  if (count === 0) {
    return "not_applicable";
  }
  return covered ? "completed" : "skipped";
}
