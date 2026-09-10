import type { ReadinessReport } from "../preview/readiness-contract";

/** Agent completion is evidence-based; this does not gate the person's Export action. */
export function reviewCompletionProblem(
  report: ReadinessReport | undefined
): string | null {
  if (!report) {
    return "Review needs a full design_check report, not a sampled check or a written summary.";
  }
  if (report.stale) {
    return "The reviewed sources or render settings changed. Run design_check mode=full again for the current version.";
  }
  if (
    !report.coverage.complete ||
    report.coverage.cancelled ||
    report.coverage.failed.length ||
    report.checks.some((check) => check.status === "failed")
  ) {
    return "Review coverage is incomplete. Inspect failed checks and unvisited intervals, then rerun with a sufficient frame/time budget.";
  }
  const { motion } = report.coverage;
  if (
    !motion?.contracts ||
    motion.invalid.length ||
    motion.unvisited.length ||
    motion.uncovered === undefined ||
    motion.uncovered.length
  ) {
    return "Exact motion boundaries are not verified. Add MotionReview using the same plans that drive the generated components, then run a full check.";
  }
  const unresolved = report.findings.filter(
    (finding) =>
      finding.audience === "viewer" &&
      finding.conclusion === "measurement" &&
      finding.severity === "error" &&
      finding.exception === null
  );
  if (unresolved.length) {
    return `Review has ${unresolved.length} unresolved measured defects: ${[...new Set(unresolved.map((finding) => finding.code))].join(", ")}. Fix them and recheck, or record a narrow intentional exception through design_check.`;
  }
  return null;
}
