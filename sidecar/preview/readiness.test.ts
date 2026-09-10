import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sourceRevision } from "./readiness";
import {
  type AuditSample,
  analyzeFrames,
  analyzeMotion,
  applyIntentExceptions,
  fullPlan,
  makeFinding,
  mergeFindings,
  readingSeconds,
} from "./readiness-analysis";
import { analyzeAudio, measureWav } from "./readiness-audio";

function sample(
  frame: number,
  visibleText = "A short sentence",
  defect = false
): AuditSample {
  return {
    audit: {
      details: {
        contrast: [],
        darkFraction: 0,
        limitations: [],
        pixelHash: String(frame),
        resources: [],
        texts: [
          {
            bbox: { height: 20, width: 100, x: 50, y: 50 },
            opacity: 1,
            readable: !!visibleText,
            role: "text",
            selector: "#title",
            text: "A short sentence",
            visibleText,
          },
        ],
      },
      findings: defect
        ? [
            {
              bbox: { height: 20, width: 100, x: 0, y: 0 },
              code: "text_clipped",
              expected: "visible",
              fix: "resize",
              frame,
              message: "clipped",
              observed: "clipped",
              selector: "#title",
              text: "title",
              type: "layer",
            },
          ]
        : [],
      fingerprint: String(frame),
      motion: [],
    },
    frame,
    output: `frame-${frame}.png`,
  };
}
export function wav(samples: readonly number[], rate = 1000): Buffer {
  const result = Buffer.alloc(44 + samples.length * 2);
  result.write("RIFF", 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write("WAVEfmt ", 8);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22);
  result.writeUInt32LE(rate, 24);
  result.writeUInt32LE(rate * 2, 28);
  result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34);
  result.write("data", 36);
  result.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => {
    result.writeInt16LE(
      Math.max(-32_768, Math.min(32_767, Math.round(v * 32_768))),
      44 + i * 2
    );
  });
  return result;
}

describe("full readiness", () => {
  it("covers scene interiors, composition ends and neighboring transition frames", () => {
    const plan = fullPlan(
      120,
      30,
      {
        camera: null,
        scenes: [
          { from: 0, name: "one", to: 60 },
          { from: 60, name: "two", to: 120 },
        ],
      },
      { maxFrames: 200 }
    );
    for (const frame of [0, 29, 58, 59, 60, 61, 62, 89, 119]) {
      expect(plan.frames).toContain(frame);
    }
    expect(plan.limited).toBe(false);
  });
  it("bounds a long composition while preserving distributed coverage", () => {
    const plan = fullPlan(30 * 60 * 60, 30, null, { maxFrames: 40 });
    expect(plan.frames.length).toBeLessThanOrEqual(30);
    expect(plan.frames).toContain(107_999);
    expect(plan.limited).toBe(true);
    expect(plan.required).toBeGreaterThan(10_000);
  });
  it("uses language-aware configurable reading estimates", () => {
    expect(readingSeconds("one two three", { wordsPerMinute: 180 })).toBe(1.5);
    expect(
      readingSeconds("日本語文字", { charactersPerSecond: 5, language: "ja" })
    ).toBe(1.5);
  });
  it("detects short reading time and clears the finding after a longer hold", () => {
    const short = analyzeFrames(
      [sample(0), sample(5)],
      30,
      640,
      360,
      null,
      {},
      5
    );
    expect(short.some((x) => x.code === "text_reading_time")).toBe(true);
    const fixed = analyzeFrames(
      Array.from({ length: 20 }, (_, i) => sample(i * 5)),
      30,
      640,
      360,
      null,
      {},
      5
    );
    expect(fixed.some((x) => x.code === "text_reading_time")).toBe(false);
  });
  it("does not count an invisible entrance as readable time", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      sample(i * 5, i < 12 ? "" : "A short sentence")
    );
    expect(
      analyzeFrames(rows, 30, 640, 360, null, {}, 5).some(
        (x) => x.code === "text_reading_time"
      )
    ).toBe(true);
  });
  it("does not promote an intentional single-frame exit to a persistent defect", () => {
    const findings = analyzeFrames(
      [sample(0), sample(5), sample(10, "A short sentence", true)],
      30,
      640,
      360,
      null,
      {},
      5
    );
    expect(findings.find((x) => x.code === "text_clipped")?.severity).toBe(
      "info"
    );
  });
  it("merges a held defect and separates its later recurrence", () => {
    const finding = (frame: number) =>
      makeFinding({
        category: "text_bounds",
        code: "text_clipped",
        from: frame,
        message: "clip",
        selector: "#title",
        to: frame + 1,
      });
    const rows = mergeFindings(
      [finding(0), finding(5), finding(10), finding(15), finding(80)],
      5,
      30
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.severity).toBe("error");
    expect(rows[1]?.severity).toBe("info");
    expect(rows[0]?.id).not.toBe(rows[1]?.id);
  });
  it("keeps intentional mask reveals separate from persistent held clipping", () => {
    const rows = [0, 5, 10, 15, 20].map((frame) =>
      sample(frame, "A short sentence", true)
    );
    const intentional = rows.map((row) => ({
      ...row,
      audit: {
        ...row.audit,
        findings: row.audit.findings.map((finding) => ({
          ...finding,
          intentionalReveal: true,
        })),
      },
    }));
    const inspect = (samples: AuditSample[]) =>
      analyzeFrames(samples, 30, 640, 360, null, {}, 5).filter(
        (finding) => finding.code === "text_clipped"
      );
    expect(
      inspect(intentional).every(
        (finding) =>
          finding.category === "motion_reveal" && finding.severity === "info"
      )
    ).toBe(true);
    expect(inspect(rows).some((finding) => finding.severity === "error")).toBe(
      true
    );
    const followingHold = rows.map((row) => ({
      ...row,
      audit: {
        ...row.audit,
        findings: row.audit.findings.map((finding) => ({
          ...finding,
          frame: finding.frame + 25,
        })),
      },
      frame: row.frame + 25,
    }));
    const mixed = inspect([...intentional, ...followingHold]);
    expect(
      mixed.find((finding) => finding.category === "text_bounds")?.severity
    ).toBe("error");
    expect(
      mixed.find((finding) => finding.category === "motion_reveal")?.severity
    ).toBe("info");
  });
  it("requires explicit safe-zone selection and scales applied bounds", () => {
    expect(
      analyzeFrames([sample(0)], 30, 640, 360, null, {}, 5).some(
        (x) => x.code === "platform_safe_zone"
      )
    ).toBe(false);
    expect(
      analyzeFrames(
        [sample(0)],
        30,
        640,
        360,
        null,
        {
          insets: { bottom: 0, left: 0, right: 0, top: 100 },
          platform: "custom",
        },
        5
      ).some((x) => x.code === "platform_safe_zone")
    ).toBe(true);
    expect(
      analyzeFrames(
        [sample(0)],
        30,
        640,
        360,
        null,
        {
          insets: { bottom: 0, left: 0, right: 0, top: 0 },
          platform: "custom",
        },
        5
      ).some((x) => x.code === "platform_safe_zone")
    ).toBe(false);
  });
  it("black backgrounds alone do not prove a missing resource or bad transition", () => {
    const rows = [sample(0), sample(5), sample(10)];
    for (const row of rows) {
      if (row.audit.details) {
        row.audit.details.darkFraction = 1;
      }
    }
    expect(
      analyzeFrames(rows, 30, 640, 360, null, {}, 5).filter(
        (x) => x.code === "transition_black_gap" || x.code === "resource_failed"
      )
    ).toHaveLength(0);
  });
  it("streams real PCM and detects clipping, missing expected sound and intentional silence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "readiness-audio-"));
    try {
      const file = path.join(root, "mix.wav");
      await writeFile(file, wav(Array.from({ length: 1000 }, () => 1)));
      const clipped = await measureWav(file);
      expect(clipped.duration).toBe(1);
      expect(
        analyzeAudio(clipped, 30, [], {}).some(
          (x) => x.code === "audio_clipping"
        )
      ).toBe(true);
      await writeFile(
        file,
        wav(Array.from({ length: 1000 }, (_, i) => Math.sin(i) * 0.2))
      );
      expect(
        analyzeAudio(await measureWav(file), 30, [], {}).some(
          (x) => x.code === "audio_clipping"
        )
      ).toBe(false);
      await writeFile(file, wav(Array.from({ length: 1000 }, () => 0)));
      const silent = await measureWav(file);
      expect(analyzeAudio(silent, 30, [], {})).toHaveLength(0);
      expect(
        analyzeAudio(silent, 30, [], { audio: { expected: true } }).some(
          (x) => x.code === "audio_expected_missing"
        )
      ).toBe(true);
      expect(
        analyzeAudio(silent, 30, [], {
          audio: { expected: true, silenceIntervals: [{ from: 0, to: 30 }] },
        })
      ).toHaveLength(0);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
  it("detects a rendered masking risk only with speech evidence and role stems", () => {
    const measure = (rms: number) => ({
      channels: 1,
      duration: 0.01,
      path: "mix.wav",
      sampleRate: 1000,
      windows: [{ clipped: 0, from: 0, peak: rms, rms, to: 0.01 }],
    });
    const stems = [
      { measurement: measure(0.1), role: "speech" as const },
      { measurement: measure(0.3), role: "music" as const },
    ];
    expect(
      analyzeAudio(
        measure(0.4),
        30,
        [],
        { audio: { speechIntervals: [{ from: 0, to: 1 }] } },
        stems
      ).some((x) => x.code === "audio_speech_masking")
    ).toBe(true);
    expect(
      analyzeAudio(measure(0.4), 30, [], {}, stems).some(
        (x) => x.code === "audio_speech_masking"
      )
    ).toBe(false);
    expect(
      analyzeAudio(
        measure(0.11),
        30,
        [],
        { audio: { speechIntervals: [{ from: 0, to: 1 }] } },
        [
          { measurement: measure(0.1), role: "speech" },
          { measurement: measure(0.01), role: "music" },
        ]
      ).some((x) => x.code === "audio_speech_masking")
    ).toBe(false);
  });
  it("invalidates revisions on source, asset, props or settings changes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "readiness-revision-"));
    try {
      await writeFile(path.join(root, "scene.tsx"), "one");
      const original = await sourceRevision(root, { props: { title: "a" } });
      await writeFile(path.join(root, "scene.tsx"), "two");
      expect(await sourceRevision(root, { props: { title: "a" } })).not.toBe(
        original
      );
      expect(await sourceRevision(root, { props: { title: "b" } })).not.toBe(
        await sourceRevision(root, { props: { title: "a" } })
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

describe("saved readiness reports", () => {
  it("keeps production notes out of the render identity while hashing actual video assets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "readiness-notes-"));
    try {
      const video = path.join(root, "src/videos/example");
      await mkdir(video, { recursive: true });
      await writeFile(path.join(video, "index.tsx"), "original");
      const before = await sourceRevision(root, {});
      await mkdir(path.join(video, "docs"));
      await writeFile(
        path.join(video, "docs/review.md"),
        "Reviewed this export"
      );
      expect(await sourceRevision(root, {})).toBe(before);
      await mkdir(path.join(video, "assets"));
      await writeFile(path.join(video, "assets/image.png"), "changed pixels");
      expect(await sourceRevision(root, {})).not.toBe(before);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
  it("reloads with stable settings ordering and invalidates old exceptions after an edit", async () => {
    const { readReadinessReport } = await import("./readiness");
    const root = await mkdtemp(path.join(tmpdir(), "readiness-report-"));
    const id = "00000000-0000-4000-8000-000000000001";
    const dir = path.join(root, "out");
    const folder = path.join(dir, `readiness-${id}`);
    const renderOptions = {
      chromeMode: null,
      chromiumOptions: {},
      timeoutInMilliseconds: null,
    };
    const options = { inputProps: { a: 1, b: 2 }, maxFrames: 40 };
    const context = { motion: [], video: null };
    try {
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(root, "scene.tsx"), "original");
      const revision = await sourceRevision(root, {
        composition: "Main",
        context,
        options,
        render: renderOptions,
      });
      await writeFile(
        path.join(folder, "report.json"),
        JSON.stringify({
          checks: [],
          composition: "Main",
          context,
          coverage: {
            cancelled: false,
            complete: true,
            durationInFrames: 30,
            elapsedMs: 1,
            exhaustive: false,
            failed: [],
            fps: 30,
            limitations: [],
            peakRssBytes: 1,
            planned: 2,
            sampled: [0, 29],
            strategy: "uniform_sampled",
            unmeasuredIntervals: [{ from: 1, to: 29 }],
          },
          createdAt: new Date().toISOString(),
          findings: [
            makeFinding({
              category: "text_bounds",
              code: "text_clipped",
              exception: "Intentional entrance",
              from: 0,
              message: "intentional",
              to: 30,
            }),
          ],
          height: 360,
          id,
          options,
          path: path.join(folder, "report.json"),
          project: root,
          props: {},
          revision,
          stale: false,
          width: 640,
        })
      );
      const input = { composition: "Main", dir, renderOptions, root };
      const fresh = await readReadinessReport(input, id, {
        inputProps: { a: 1, b: 2 },
        maxFrames: 40,
      });
      expect(fresh.readiness?.stale).toBe(false);
      expect(fresh.readiness?.findings[0]?.exception).toBe(
        "Intentional entrance"
      );
      await writeFile(path.join(root, "scene.tsx"), "edited");
      const stale = await readReadinessReport(input, id);
      expect(stale.readiness?.stale).toBe(true);
      expect(stale.readiness?.coverage.complete).toBe(false);
      expect(stale.readiness?.findings[0]?.exception).toBeNull();
      await expect(
        readReadinessReport(input, "../../another-project")
      ).rejects.toThrow("Invalid readiness report id");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

it("scopes intentional exceptions to one revision, rule, target and interval", () => {
  const first = makeFinding({
    category: "text_bounds",
    code: "text_clipped",
    from: 10,
    message: "clip",
    selector: "#one",
    to: 20,
  });
  const second = makeFinding({ ...first, selector: "#two" });
  const options = {
    exceptions: [
      {
        code: "text_clipped",
        from: 10,
        reason: "Intentional reveal",
        revision: "same",
        selector: "#one",
        to: 20,
      },
    ],
  };
  const result = applyIntentExceptions([first, second], options, "same", false);
  expect(result[0]?.exception).toBe("Intentional reveal");
  expect(result[1]?.exception).toBeNull();
  expect(
    applyIntentExceptions([first], options, "changed", false)[0]?.exception
  ).toBeNull();
  expect(
    applyIntentExceptions([first], options, "same", true)[0]?.exception
  ).toBeNull();
});

it("does not turn unsampled motion frames into missing targets or shift selector indices", () => {
  const row = sample(0);
  row.audit = {
    ...row.audit,
    motion: [
      { matches: 2, target: null },
      { matches: 0, target: null },
    ],
  };
  const missing = analyzeMotion(
    [{ frame: 50, kind: "visible_at", selector: "#later" }],
    [row],
    640,
    360,
    30
  );
  expect(missing.complete).toBe(false);
  expect(missing.findings).toHaveLength(0);
  const mixed = analyzeMotion(
    [
      {
        from: 0,
        kind: "keeps_moving",
        maxStaticFrames: 1,
        selector: "#long",
        to: 1_000_000,
      },
      { frame: 0, kind: "visible_at", selector: "#second" },
    ],
    [row],
    640,
    360,
    30
  );
  expect(mixed.complete).toBe(false);
  expect(mixed.findings[0]?.code).toBe("motion_target_missing");
  expect(mixed.findings[0]?.selector).toBe("#second");
});
