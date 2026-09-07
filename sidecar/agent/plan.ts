import type { PlanTier } from "@/shared/entitlement";
import {
  DESIGN_SERVER,
  LIBRARY_SERVER,
  PIPELINE_SERVER,
  type ToolServer,
} from "../tools/specs";

// The one reason a bundle is withheld rather than missing. It is a token, not
// a sentence: nothing about Free is a failure to report, so the notice that
// every other reason earns is not raised for this one.
export const PLAN_REASON = "plan";

// What a Free turn is served: the library, so an asset picked from the drawer
// still lands, and the design check, which reads what is on disk and asks
// nothing of the pipeline. The pipeline itself is Pro.
export const FREE_SERVERS: readonly ToolServer[] = [
  DESIGN_SERVER,
  LIBRARY_SERVER,
];

export const PRO_SERVERS: readonly ToolServer[] = [
  DESIGN_SERVER,
  LIBRARY_SERVER,
  PIPELINE_SERVER,
];

export function serversFor(plan: PlanTier): readonly ToolServer[] {
  return plan === "pro" ? PRO_SERVERS : FREE_SERVERS;
}

export function skillsAllowed(plan: PlanTier): boolean {
  return plan === "pro";
}

export function pipelineAllowed(plan: PlanTier): boolean {
  return plan === "pro";
}

// The disk is the sidecar's, so the gate on writing into the person's project
// is the sidecar's too. On Free the properties pane never opens — Inspect is
// locked — so nothing should ever reach this; a refusal here is what makes
// that a fact rather than a consequence.
export function writesAllowed(plan: PlanTier): boolean {
  return plan === "pro";
}

export const WRITES_ARE_PRO =
  "Writing values back into the code is part of Pro.";
