import { Schema } from "effect";

const Interval = Schema.Struct({ from: Schema.Int, to: Schema.Int });
const Insets = Schema.Struct({
  bottom: Schema.Finite,
  left: Schema.Finite,
  right: Schema.Finite,
  top: Schema.Finite,
});
export const ReadinessOptions = Schema.Struct({
  audio: Schema.optionalKey(
    Schema.Struct({
      expected: Schema.optionalKey(Schema.Boolean),
      expectedIntervals: Schema.optionalKey(Schema.Array(Interval)),
      maskingDb: Schema.optionalKey(Schema.Finite),
      peakDb: Schema.optionalKey(Schema.Finite),
      silenceDb: Schema.optionalKey(Schema.Finite),
      silenceIntervals: Schema.optionalKey(Schema.Array(Interval)),
      speechIntervals: Schema.optionalKey(Schema.Array(Interval)),
      stems: Schema.optionalKey(
        Schema.Array(
          Schema.Struct({
            inputProps: Schema.Record(Schema.String, Schema.Unknown),
            role: Schema.Literals(["speech", "music", "sfx"]),
          })
        )
      ),
    })
  ),
  charactersPerSecond: Schema.optionalKey(Schema.Finite),
  exceptions: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        code: Schema.NonEmptyString,
        from: Schema.Int,
        reason: Schema.NonEmptyString,
        revision: Schema.NonEmptyString,
        selector: Schema.NullOr(Schema.String),
        targetId: Schema.optionalKey(Schema.String),
        to: Schema.Int,
      })
    )
  ),
  exportSettings: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.Unknown)
  ),
  inputProps: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  insets: Schema.optionalKey(Insets),
  language: Schema.optionalKey(Schema.String),
  maxDurationMs: Schema.optionalKey(Schema.Int),
  maxFrames: Schema.optionalKey(Schema.Int),
  platform: Schema.optionalKey(
    Schema.Literals(["tiktok", "reels", "shorts", "custom"])
  ),
  readableOpacity: Schema.optionalKey(Schema.Finite),
  readingLeadSeconds: Schema.optionalKey(Schema.Finite),
  sampleEveryFrames: Schema.optionalKey(Schema.Int),
  wordsPerMinute: Schema.optionalKey(Schema.Finite),
});
export type ReadinessOptions = typeof ReadinessOptions.Type;

export const ReadinessFinding = Schema.Struct({
  audience: Schema.Literals(["viewer", "intent", "tunability"]),
  bbox: Schema.NullOr(
    Schema.Struct({
      height: Schema.Finite,
      width: Schema.Finite,
      x: Schema.Finite,
      y: Schema.Finite,
    })
  ),
  category: Schema.String,
  code: Schema.String,
  conclusion: Schema.Literals(["measurement", "heuristic"]),
  confidence: Schema.String,
  evidence: Schema.Array(Schema.String),
  exception: Schema.NullOr(Schema.String),
  expected: Schema.String,
  fix: Schema.String,
  frames: Schema.Array(Schema.Int),
  from: Schema.Int,
  id: Schema.String,
  measurements: Schema.Record(Schema.String, Schema.Finite),
  message: Schema.String,
  observed: Schema.String,
  scene: Schema.NullOr(Schema.String),
  selector: Schema.NullOr(Schema.String),
  severity: Schema.Literals(["error", "warning", "info"]),
  targetId: Schema.optionalKey(Schema.String),
  to: Schema.Int,
});
export type ReadinessFinding = typeof ReadinessFinding.Type;

export const ReadinessReport = Schema.Struct({
  checks: Schema.Array(
    Schema.Struct({
      reason: Schema.String,
      rule: Schema.String,
      status: Schema.Literals([
        "completed",
        "not_applicable",
        "skipped",
        "failed",
      ]),
    })
  ),
  composition: Schema.String,
  context: Schema.Record(Schema.String, Schema.Unknown),
  coverage: Schema.Struct({
    cancelled: Schema.Boolean,
    complete: Schema.Boolean,
    durationInFrames: Schema.Int,
    elapsedMs: Schema.Finite,
    exhaustive: Schema.Boolean,
    failed: Schema.Array(
      Schema.Struct({ frame: Schema.Int, reason: Schema.String })
    ),
    fps: Schema.Finite,
    limitations: Schema.Array(Schema.String),
    motion: Schema.optionalKey(
      Schema.Struct({
        boundaries: Schema.Array(Schema.Int),
        contracts: Schema.Int,
        cues: Schema.Int,
        invalid: Schema.Array(Schema.String),
        uncovered: Schema.optionalKey(Schema.Array(Interval)),
        unvisited: Schema.Array(Schema.Int),
      })
    ),
    peakRssBytes: Schema.Finite,
    planned: Schema.Int,
    sampled: Schema.Array(Schema.Int),
    strategy: Schema.Literals(["scene_aware_sampled", "uniform_sampled"]),
    unmeasuredIntervals: Schema.Array(
      Schema.Struct({ from: Schema.Int, to: Schema.Int })
    ),
  }),
  createdAt: Schema.String,
  findings: Schema.Array(ReadinessFinding),
  height: Schema.Int,
  id: Schema.String,
  options: ReadinessOptions,
  path: Schema.String,
  project: Schema.String,
  props: Schema.Record(Schema.String, Schema.Unknown),
  revision: Schema.String,
  stale: Schema.Boolean,
  width: Schema.Int,
});
export type ReadinessReport = typeof ReadinessReport.Type;
