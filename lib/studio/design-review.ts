import { Effect, Option, Schema } from "effect";
import type { ToolCall } from "./activity";

const Finding = Schema.Struct({
  code: Schema.String,
  fix: Schema.optional(Schema.NullOr(Schema.String)),
  frames: Schema.Array(Schema.Number).pipe(
    Schema.withDecodingDefault(Effect.succeed([]))
  ),
  message: Schema.String,
  selector: Schema.optional(Schema.NullOr(Schema.String)),
  severity: Schema.Literals(["error", "warning", "info"]),
});

const Report = Schema.Struct({
  composition: Schema.String,
  findings: Schema.Array(Finding),
  readiness: Schema.optional(
    Schema.Struct({
      coverage: Schema.optional(
        Schema.Struct({
          cancelled: Schema.optional(Schema.Boolean),
          complete: Schema.Boolean,
          limitations: Schema.Array(Schema.String).pipe(
            Schema.withDecodingDefault(Effect.succeed([]))
          ),
        })
      ),
      stale: Schema.optional(Schema.Boolean),
    })
  ),
});

const decodeReport = Schema.decodeUnknownOption(Schema.fromJsonString(Report));

export type VideoReview = (typeof Report)["Type"];
export type VideoFinding = (typeof Finding)["Type"];
export type FindingGroup = Omit<VideoFinding, "frames"> & {
  frames: readonly number[];
  id: string;
  occurrences: number;
};

export function groupFindings(
  findings: readonly VideoFinding[]
): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const item of findings) {
    const id = JSON.stringify([
      item.code,
      item.severity,
      item.message,
      item.selector,
      item.fix,
    ]);
    const group = groups.get(id);
    if (group) {
      group.occurrences += 1;
      group.frames = [...new Set([...group.frames, ...item.frames])].sort(
        (a, b) => a - b
      );
    } else {
      groups.set(id, { ...item, frames: [...item.frames], id, occurrences: 1 });
    }
  }
  return [...groups.values()];
}

export function isDesignCheck(name: string): boolean {
  return name === "design_check" || name === "mcp__remocn-design__design_check";
}

// Read a validated projection; keep the original report for diagnostics.
// Findings describe the video, never the success/failure of a tool invocation.
export function designReview(call: ToolCall): VideoReview | null {
  if (!isDesignCheck(call.name) || call.result === null) {
    return null;
  }
  return Option.getOrNull(decodeReport(call.result));
}

export function reviewStatus(review: VideoReview): string {
  if (review.readiness?.stale) {
    return "Sources changed · recheck needed";
  }
  if (review.readiness?.coverage?.cancelled) {
    return "Review interrupted";
  }
  if (review.readiness?.coverage?.complete === false) {
    return "Review incomplete";
  }
  return review.readiness?.coverage?.complete
    ? "Review completed"
    : "Sampled review";
}
