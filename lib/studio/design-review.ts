import { z } from "zod";
import type { ToolCall } from "./activity";

const finding = z.object({
  code: z.string(),
  fix: z.string().nullable().optional(),
  frames: z.array(z.number()).default([]),
  message: z.string(),
  selector: z.string().nullable().optional(),
  severity: z.enum(["error", "warning", "info"]),
});

const report = z.object({
  composition: z.string(),
  findings: z.array(finding),
  readiness: z
    .object({
      coverage: z
        .object({
          cancelled: z.boolean().optional(),
          complete: z.boolean(),
          limitations: z.array(z.string()).default([]),
        })
        .optional(),
      stale: z.boolean().optional(),
    })
    .optional(),
});

export type VideoReview = z.infer<typeof report>;
export type VideoFinding = z.infer<typeof finding>;
export type FindingGroup = VideoFinding & { id: string; occurrences: number };

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
  try {
    const parsed = report.safeParse(JSON.parse(call.result));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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
