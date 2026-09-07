import { describe, expect, it } from "bun:test";
import { PRO_FEATURES, type ProFeature } from "@/shared/entitlement";
import { locateBundle } from "@/sidecar/agent/knowledge";
import {
  FREE_SERVERS,
  PLAN_REASON,
  PRO_SERVERS,
  pipelineAllowed,
  serversFor,
  skillsAllowed,
  writesAllowed,
} from "@/sidecar/agent/plan";
import {
  conventionsFor,
  FREE_CONVENTIONS,
  STUDIO_CONVENTIONS,
} from "@/sidecar/claude/conventions";
import {
  LIBRARY_SERVER,
  PIPELINE_SERVER,
  TOOL_SERVERS,
} from "@/sidecar/tools/specs";

// The sidecar gates four of the six; the other two are buttons, gated in
// `hooks/use-tools.ts` and pinned by its own test. Together they are the
// whole list, so a feature added to Pro cannot be gated nowhere.
const SIDECAR_GATED: readonly ProFeature[] = [
  "skills-bundle",
  "pipeline-tools",
  "craft-conventions",
  "write-to-code",
];
const WEBVIEW_GATED: readonly ProFeature[] = ["inspect", "snapshot"];

describe("the plan gates", () => {
  it("cover every Pro feature between the sidecar and the webview", () => {
    expect([...SIDECAR_GATED, ...WEBVIEW_GATED].sort()).toEqual(
      [...PRO_FEATURES].sort()
    );
  });

  it("withhold the skills bundle on Free, with the one reason that is not a failure", () => {
    expect(skillsAllowed("free")).toBe(false);
    expect(skillsAllowed("pro")).toBe(true);
    expect(locateBundle("/videos/promo", "free")).toEqual({
      collisions: [],
      loaded: false,
      path: null,
      reason: PLAN_REASON,
      source: "none",
    });
  });

  it("serve the pipeline server only on Pro, and the library on both", () => {
    expect(pipelineAllowed("free")).toBe(false);
    expect(serversFor("free")).toEqual(FREE_SERVERS);
    expect(serversFor("pro")).toEqual(PRO_SERVERS);
    expect(FREE_SERVERS).not.toContain(PIPELINE_SERVER);
    expect(FREE_SERVERS).toContain(LIBRARY_SERVER);
    expect([...PRO_SERVERS].sort()).toEqual([...TOOL_SERVERS].sort());
  });

  it("let only a Pro turn write values into the project's code", () => {
    expect(writesAllowed("free")).toBe(false);
    expect(writesAllowed("pro")).toBe(true);
  });

  it("keep a Pro turn's conventions exactly what they were", () => {
    expect(conventionsFor(false, null, "pro")).toBe(STUDIO_CONVENTIONS);
    expect(conventionsFor(false, null)).toBe(
      conventionsFor(false, null, "pro")
    );
  });

  it("send a Free turn no skill, no pipeline tool and no craft mandate", () => {
    const free = conventionsFor(true, "promo", "free");

    expect(free).toContain("`src/videos/promo/`");
    expect(free).toBe(
      `${FREE_CONVENTIONS}\n\nYour video for this conversation is \`promo\` — the folder \`src/videos/promo/\`, which registers the composition \`promo\`.`
    );
    expect(free).not.toContain(`mcp__${PIPELINE_SERVER}__`);
    expect(free).not.toContain("design_check");
    expect(free).not.toContain("remocn-studio");
    expect(free).not.toContain("video-lessons");
    expect(free).not.toContain("InteractivitySchema");
    expect(free).not.toContain("seven-stage");
    expect(free).not.toContain("moodboard");
  });
});
