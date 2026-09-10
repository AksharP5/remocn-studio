import { createHash } from "node:crypto";
import type { VideoCheck } from "./choreography";
import {
  type FrameDesignAudit,
  type MotionAssertion,
  motionFindings,
  motionFrames,
} from "./design";
import type { ReadinessFinding, ReadinessOptions } from "./readiness-contract";

export interface AuditSample {
  audit: FrameDesignAudit;
  frame: number;
  output: string;
}
export interface FullPlan {
  boundaries: number[];
  frames: number[];
  limited: boolean;
  required: number;
  step: number;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: explicit anchor and temporal budget allocation must be reviewed together.
export function fullPlan(
  duration: number,
  fps: number,
  video: VideoCheck | null,
  options: ReadinessOptions
): FullPlan {
  const budget = options.maxFrames ?? 360;
  const step = options.sampleEveryFrames ?? Math.max(1, Math.round(fps / 4));
  const anchors = new Set<number>([0, duration - 1]);
  const boundaries: number[] = [];
  for (const scene of video?.scenes ?? []) {
    for (const frame of [
      scene.from,
      scene.to - 1,
      Math.floor((scene.from + scene.to - 1) / 2),
    ]) {
      anchors.add(frame);
    }
    for (const boundary of [scene.from, scene.to]) {
      if (boundary > 0 && boundary < duration) {
        boundaries.push(boundary);
      }
      for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
        if (boundary + offset >= 0 && boundary + offset < duration) {
          anchors.add(boundary + offset);
        }
      }
    }
  }
  const gridCount = Math.ceil(duration / step);
  const required =
    new Set([
      ...anchors,
      ...Array.from(
        { length: Math.min(gridCount, budget * 2) },
        (_, i) => i * step
      ),
    ]).size + Math.max(0, gridCount - budget * 2);
  const slots = Math.max(2, Math.floor(budget * 0.75));
  const frames = [...anchors].sort((a, b) => a - b);
  if (frames.length > slots) {
    const spread = Array.from(
      { length: slots },
      (_, i) =>
        frames[Math.round((i * (frames.length - 1)) / (slots - 1))] as number
    );
    return {
      boundaries: [...new Set(boundaries)],
      frames: [...new Set(spread)],
      limited: true,
      required,
      step,
    };
  }
  const available = slots - frames.length;
  const grid =
    gridCount <= available
      ? Array.from({ length: gridCount }, (_, i) => i * step)
      : Array.from({ length: available }, (_, i) =>
          Math.round(((i + 1) * (duration - 1)) / (available + 1))
        );
  return {
    boundaries: [...new Set(boundaries)],
    frames: [...new Set([...frames, ...grid])].sort((a, b) => a - b),
    limited: gridCount > available,
    required,
    step,
  };
}

export function makeFinding(
  input: Partial<ReadinessFinding> &
    Pick<ReadinessFinding, "code" | "category" | "message" | "from" | "to">
): ReadinessFinding {
  const base: ReadinessFinding = {
    audience: "viewer",
    bbox: null,
    conclusion: "heuristic",
    confidence: "Sampled evidence; review the intended result.",
    evidence: [],
    exception: null,
    expected: "",
    fix: "Inspect the evidence and adjust the affected scene.",
    frames: [input.from],
    id: "",
    measurements: {},
    observed: "",
    scene: null,
    selector: null,
    severity: "warning",
    ...input,
  };
  return {
    ...base,
    id: createHash("sha256")
      .update(
        JSON.stringify([
          base.code,
          base.selector,
          base.targetId,
          base.from,
          base.to,
          base.scene,
        ])
      )
      .digest("hex")
      .slice(0, 24),
  };
}

// Profiles are conservative product guidance, not a guarantee of every UI variant.
// The provenance and applicability caveats are recorded in docs/plans/2026-09-09-rem-377-checks.md.
export const SAFE_PROFILES = {
  reels: {
    basis:
      "Bottom 35% is documented in Meta Reels creative guidance; top 14% and sides 6% are guidance margins. Current placement page could not be fetched; validate in Ads Manager.",
    bottom: 0.35,
    date: "2026-09-09",
    left: 0.06,
    right: 0.06,
    source:
      "https://www.facebook.com/business/ads/facebook-instagram-reels-ads",
    top: 0.14,
  },
  shorts: {
    basis:
      "Google vertical 1080×1920 overlay: left 48, right 192, top 288, bottom 672 pixels.",
    bottom: 0.35,
    date: "2026-09-09",
    left: 48 / 1080,
    right: 192 / 1080,
    source:
      "https://services.google.com/fh/files/misc/universalsafezones-youtube.pdf",
    top: 0.15,
  },
  tiktok: {
    basis:
      "TikTok standard LTR 720×1280 template: conservative rectangle inside the irregular safe region; left 80, right 200, top 160, bottom 440 pixels.",
    bottom: 440 / 1280,
    date: "2026-09-09",
    left: 80 / 720,
    right: 200 / 720,
    source:
      "https://ads.tiktok.com/resources/help/article/tiktok-auction-in-feed-ads",
    top: 160 / 1280,
  },
} as const;

const CJK_LANGUAGE = /^(zh|ja|ko)/i;
const CJK_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function readingSeconds(
  text: string,
  options: ReadinessOptions
): number {
  const lead = options.readingLeadSeconds ?? 0.5;
  if (CJK_LANGUAGE.test(options.language ?? "") || CJK_TEXT.test(text)) {
    return (
      lead +
      [...text.replace(/\s/g, "")].length / (options.charactersPerSecond ?? 8)
    );
  }
  const words = [
    ...new Intl.Segmenter(options.language || undefined, {
      granularity: "word",
    }).segment(text),
  ].filter((x) => x.isWordLike).length;
  return lead + (words * 60) / (options.wordsPerMinute ?? 180);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the pass evaluates related frame histories before collapsing temporal evidence.
export function analyzeFrames(
  samples: readonly AuditSample[],
  fps: number,
  width: number,
  height: number,
  video: VideoCheck | null,
  options: ReadinessOptions,
  step: number
): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  const sorted = [...samples].sort((a, b) => a.frame - b.frame);
  const sceneAt = (frame: number) =>
    video?.scenes
      .filter((s) => s.from <= frame && s.to > frame)
      .map((s) => s.name)
      .join(" / ") || null;
  const maxGap = step + 1;
  for (const sample of sorted) {
    for (const finding of sample.audit.findings) {
      if (
        finding.type === "contrast" &&
        sample.audit.details?.contrast.some(
          (row) => row.selector === finding.selector && row.ratio === null
        )
      ) {
        continue;
      }
      const category = finding.type === "contrast" ? "contrast" : "text_bounds";
      findings.push(
        makeFinding({
          ...finding,
          category: finding.intentionalReveal ? "motion_reveal" : category,
          conclusion: "measurement",
          confidence:
            "Measured at this rendered frame; persistence is evaluated across adjacent samples.",
          evidence: [sample.output],
          frames: [sample.frame],
          from: sample.frame,
          measurements: Object.fromEntries(
            (sample.audit.details?.contrast ?? [])
              .filter(
                (c) => c.selector === finding.selector && c.ratio !== null
              )
              .flatMap((c) => [
                ["contrastRatio", c.ratio as number],
                ["threshold", c.threshold],
              ])
          ),
          observed: finding.observed,
          scene: sceneAt(sample.frame),
          severity: "info",
          to: sample.frame + 1,
        })
      );
    }
    const { details } = sample.audit;
    if (!details) {
      continue;
    }
    for (const text of details.texts) {
      const b = text.bbox;
      if (
        text.text.trim() &&
        text.opacity >= (options.readableOpacity ?? 0.8) &&
        (b.x + b.width <= 0 ||
          b.y + b.height <= 0 ||
          b.x >= width ||
          b.y >= height)
      ) {
        findings.push(
          makeFinding({
            bbox: b,
            category: "text_bounds",
            code: "text_out_of_frame",
            conclusion: "measurement",
            evidence: [sample.output],
            expected: `Text inside ${width}×${height}.`,
            from: sample.frame,
            message: "Text is entirely outside the composition.",
            observed: JSON.stringify(b),
            scene: sceneAt(sample.frame),
            selector: text.selector,
            severity: "info",
            to: sample.frame + 1,
          })
        );
      }
    }
    for (const resource of details.resources) {
      findings.push(
        makeFinding({
          category: "resources",
          code: "resource_failed",
          conclusion: "measurement",
          evidence: [sample.output],
          expected: "The resource loads and decodes successfully.",
          from: sample.frame,
          message: resource.reason,
          observed: resource.resource,
          scene: sceneAt(sample.frame),
          selector: resource.selector,
          severity: "error",
          to: sample.frame + 1,
        })
      );
    }
    if (options.platform) {
      const normalized =
        options.platform === "custom" ? null : SAFE_PROFILES[options.platform];
      const insets =
        options.insets ??
        (normalized
          ? {
              bottom: normalized.bottom * height,
              left: normalized.left * width,
              right: normalized.right * width,
              top: normalized.top * height,
            }
          : null);
      if (insets) {
        for (const text of details.texts) {
          if (
            text.opacity < (options.readableOpacity ?? 0.8) ||
            (!text.visibleText.trim() && text.role === "text")
          ) {
            continue;
          }
          const b = text.bbox;
          if (
            b.x < insets.left ||
            b.y < insets.top ||
            b.x + b.width > width - insets.right ||
            b.y + b.height > height - insets.bottom
          ) {
            findings.push(
              makeFinding({
                bbox: b,
                category: "safe_zones",
                code: "platform_safe_zone",
                confidence: normalized
                  ? `Conservative profile reviewed ${normalized.date}; ${normalized.source}. UI varies by placement and caption. ${normalized.basis}`
                  : "Explicit custom pixel insets.",
                evidence: [sample.output],
                expected: JSON.stringify({
                  bottom: height - insets.bottom,
                  left: insets.left,
                  right: width - insets.right,
                  top: insets.top,
                }),
                from: sample.frame,
                measurements: { ...insets },
                message: `${text.role} may be covered by ${options.platform} controls.`,
                observed: JSON.stringify(b),
                scene: sceneAt(sample.frame),
                selector: text.selector,
                to: sample.frame + 1,
              })
            );
          }
        }
      }
    }
  }
  // Track text by semantic group. Word/letter spans contribute only the text actually readable.
  const selectors = new Set(
    sorted.flatMap(
      (s) =>
        s.audit.details?.texts
          .filter((t) => t.role === "text" || t.role === "subtitle")
          .map((t) => t.selector) ?? []
    )
  );
  for (const selector of selectors) {
    let run: {
      sample: AuditSample;
      text: NonNullable<FrameDesignAudit["details"]>["texts"][number];
    }[] = [];
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: progressive disclosure accumulates reading debt within one text lifetime.
    const flush = () => {
      if (!run.length) {
        return;
      }
      const [first] = run;
      const last = run.at(-1);
      if (!(first && last)) {
        return;
      }
      const fullText = run.reduce(
        (best, row) =>
          row.text.text.length > best.length ? row.text.text : best,
        ""
      );
      let available = 0;
      let revealed = 0;
      let debt = 0;
      for (let i = 0; i < run.length; i += 1) {
        const row = run[i];
        if (!row) {
          continue;
        }
        const chars = row.text.visibleText.trim().length;
        const added = Math.max(0, chars - revealed);
        // New words consume reading time as revealed, rather than pretending the final text was present at entry.
        if (added) {
          debt += Math.max(
            0,
            readingSeconds(row.text.visibleText, options) -
              (revealed
                ? readingSeconds(
                    row.text.visibleText.slice(0, revealed),
                    options
                  )
                : 0)
          );
        }
        const next = run[i + 1];
        const dt =
          next && next.sample.frame - row.sample.frame <= maxGap
            ? (next.sample.frame - row.sample.frame) / fps
            : 1 / fps;
        if (chars > 0) {
          available += dt;
          debt = Math.max(0, debt - dt);
        }
        revealed = chars;
      }
      const required = readingSeconds(fullText, options);
      if (fullText.trim() && (available < required || debt > 0.1)) {
        findings.push(
          makeFinding({
            bbox: last.text.bbox,
            category: "reading_time",
            code: "text_reading_time",
            confidence:
              "Configurable reading-speed heuristic; timing uncertainty includes unsampled intervals.",
            evidence: [first.sample.output, last.sample.output],
            expected: `Estimated ${required.toFixed(2)}s for ${options.language ?? "detected script"}.`,
            fix: "Hold the fully revealed text longer, reveal it earlier, or shorten the copy.",
            frames: [first.sample.frame, last.sample.frame],
            from: first.sample.frame,
            measurements: {
              readableSeconds: available,
              remainingReadingSeconds: debt,
              requiredSeconds: required,
            },
            message: "Text may disappear before it can be read comfortably.",
            observed: `${available.toFixed(2)}s sampled readable window.`,
            scene: sceneAt(first.sample.frame),
            selector,
            to: last.sample.frame + 1,
          })
        );
      }
      run = [];
    };
    for (const sample of sorted) {
      const text = sample.audit.details?.texts.find(
        (t) => t.selector === selector
      );
      const previous = run.at(-1);
      if (
        !text ||
        (previous &&
          (sample.frame - previous.sample.frame > maxGap ||
            !(
              text.text.startsWith(previous.text.text) ||
              previous.text.text.startsWith(text.text)
            )))
      ) {
        flush();
      }
      if (text) {
        run.push({ sample, text });
      }
    }
    flush();
  }
  // A run of black frames is a recommendation only when visible content brackets it.
  for (let index = 1; index < sorted.length - 1; index += 1) {
    const first = sorted[index];
    const before = sorted[index - 1];
    if (
      !(first && before) ||
      (first.audit.details?.darkFraction ?? 0) <= 0.98 ||
      (before.audit.details?.darkFraction ?? 1) >= 0.9
    ) {
      continue;
    }
    let last = first;
    while (
      index + 1 < sorted.length &&
      (sorted[index + 1]?.audit.details?.darkFraction ?? 0) > 0.98 &&
      (sorted[index + 1]?.frame ?? last.frame) - last.frame <= maxGap
    ) {
      index += 1;
      last = sorted[index] as AuditSample;
    }
    const after = sorted[index + 1];
    if (
      !after ||
      (after.audit.details?.darkFraction ?? 1) >= 0.9 ||
      first.frame - before.frame > maxGap ||
      after.frame - last.frame > maxGap
    ) {
      continue;
    }
    findings.push(
      makeFinding({
        audience: "intent",
        category: "motion",
        code: "transition_black_gap",
        confidence:
          "Rendered dark interval flanked by visible frames; black transitions are valid.",
        evidence: [before.output, first.output, last.output, after.output],
        expected: "The intended scene transition.",
        frames: [before.frame, first.frame, last.frame, after.frame],
        from: first.frame,
        measurements: { darkFraction: first.audit.details?.darkFraction ?? 0 },
        message:
          "A dark or empty interval separates visible frames; confirm this transition is intentional.",
        observed: "Near-black run with visible content on both sides.",
        scene: sceneAt(first.frame),
        to: last.frame + 1,
      })
    );
  }
  let stillStart = 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    const prev = sorted[i - 1],
      row = sorted[i];
    if (
      row &&
      prev &&
      row.frame - prev.frame <= maxGap &&
      row.audit.fingerprint === prev.audit.fingerprint &&
      row.audit.details?.pixelHash === prev.audit.details?.pixelHash
    ) {
      continue;
    }
    const first = sorted[stillStart];
    if (first && prev && (prev.frame - first.frame) / fps >= 3) {
      findings.push(
        makeFinding({
          audience: "intent",
          category: "motion",
          code: "video_frozen_run",
          evidence: [first.output, prev.output],
          expected: "The intended pacing; static scenes are allowed.",
          frames: [first.frame, prev.frame],
          from: first.frame,
          measurements: { seconds: (prev.frame - first.frame) / fps },
          message:
            "The sampled picture holds still; confirm the pause is intentional.",
          observed: "Matching sampled DOM and pixel fingerprints.",
          scene: sceneAt(first.frame),
          severity: "info",
          to: prev.frame + 1,
        })
      );
    }
    stillStart = i;
  }
  return mergeFindings(findings, maxGap, fps);
}

export function mergeFindings(
  findings: readonly ReadinessFinding[],
  maxGap: number,
  fps: number
): ReadinessFinding[] {
  const groups = new Map<string, ReadinessFinding[]>();
  for (const row of findings) {
    const key = JSON.stringify([
      row.code,
      row.category,
      row.selector,
      row.targetId,
      row.scene,
    ]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const result: ReadinessFinding[] = [];
  for (const group of groups.values()) {
    let merged: ReadinessFinding | undefined;
    for (const row of group.sort((a, b) => a.from - b.from)) {
      if (merged && row.from - merged.to <= maxGap) {
        merged = {
          ...merged,
          evidence: [...new Set([...merged.evidence, ...row.evidence])].slice(
            0,
            4
          ),
          frames: [...new Set([...merged.frames, ...row.frames])],
          to: Math.max(row.to, merged.to),
        };
      } else {
        if (merged) {
          result.push(merged);
        }
        merged = row;
      }
    }
    if (merged) {
      result.push(merged);
    }
  }
  return result.map((row) => {
    let { severity } = row;
    if (row.category === "text_bounds" || row.category === "contrast") {
      severity =
        (row.to - row.from) / fps >= 0.5 && row.frames.length >= 2
          ? "error"
          : "info";
    }
    return makeFinding({ ...row, id: "", severity });
  });
}

export function unmeasuredIntervals(
  frames: readonly number[],
  duration: number
): { from: number; to: number }[] {
  const intervals: { from: number; to: number }[] = [];
  let next = 0;
  for (const frame of [...new Set(frames)].sort((a, b) => a - b)) {
    if (frame < 0 || frame >= duration) {
      continue;
    }
    if (frame > next) {
      intervals.push({ from: next, to: frame });
    }
    next = frame + 1;
  }
  if (next < duration) {
    intervals.push({ from: next, to: duration });
  }
  return intervals;
}

export function applyIntentExceptions(
  findings: readonly ReadinessFinding[],
  options: ReadinessOptions,
  revision: string,
  stale: boolean
): ReadinessFinding[] {
  return findings.map((row) => ({
    ...row,
    exception:
      options.exceptions?.find(
        (exception) =>
          !stale &&
          exception.revision === revision &&
          exception.code === row.code &&
          exception.selector === row.selector &&
          exception.targetId === row.targetId &&
          exception.from <= row.from &&
          exception.to >= row.to
      )?.reason ?? null,
  }));
}

export function analyzeMotion(
  assertions: readonly MotionAssertion[],
  samples: readonly AuditSample[],
  width: number,
  height: number,
  budget: number
) {
  let complete = true;
  const findings = assertions.flatMap((assertion, index) => {
    if (
      assertion.kind === "keeps_moving" &&
      (assertion.maxStaticFrames < 1 ||
        assertion.to <= assertion.from ||
        Math.ceil(
          (assertion.to - assertion.from) /
            Math.max(1, Math.floor(assertion.maxStaticFrames / 2))
        ) +
          1 >
          budget)
    ) {
      complete = false;
      return [];
    }
    if (
      !(
        samples.length &&
        motionFrames([assertion]).every((frame) =>
          samples.some((sample) => sample.frame === frame)
        )
      )
    ) {
      complete = false;
      return [];
    }
    return motionFindings({
      assertions: [assertion],
      height,
      samples: samples.map((sample) => ({
        frame: sample.frame,
        probes: [sample.audit.motion[index] ?? { matches: 0, target: null }],
      })),
      width,
    });
  });
  return { complete, findings };
}
