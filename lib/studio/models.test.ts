import { describe, expect, it } from "vitest";
import {
  CLAUDE_MODELS,
  modelLabelOf,
  offersAutoMode,
  runningMode,
  runningModeLabel,
} from "@/lib/studio/models";

// Measured one probe per model against the real CLI, reading the mode
// `system`/`init` answers with: everything in the catalog runs Auto except
// Haiku 4.5, which Claude Code silently downgrades to `default`.
describe("offersAutoMode", () => {
  it("knows the one Claude model that cannot run Auto", () => {
    const without = CLAUDE_MODELS.filter(
      (model) => !offersAutoMode(model.value)
    );

    expect(without.map((model) => model.label)).toEqual(["Haiku 4.5"]);
  });

  it("treats a model it has never heard of as offering Auto", () => {
    expect(offersAutoMode("claude-something-6")).toBe(true);
  });
});

describe("runningMode", () => {
  it("falls Auto back to what the turn will really run in", () => {
    expect(runningMode("auto", "claude-haiku-4-5-20251001")).toBe("default");
    expect(
      runningModeLabel(runningMode("auto", "claude-haiku-4-5-20251001"))
    ).toBe("Default");
  });

  it("leaves Auto alone on a model that has it", () => {
    expect(runningMode("auto", "claude-opus-5")).toBe("auto");
    expect(runningModeLabel(runningMode("auto", "claude-opus-5"))).toBe("Auto");
  });

  // Only Auto is downgraded — the other two run on every model, so a fallback
  // there would be inventing a limit that is not measured.
  it("leaves the other modes alone on a model without Auto", () => {
    expect(runningMode("acceptEdits", "claude-haiku-4-5-20251001")).toBe(
      "acceptEdits"
    );
    expect(runningMode("plan", "claude-haiku-4-5-20251001")).toBe("plan");
  });
});

describe("modelLabelOf", () => {
  it("names a model the catalog knows", () => {
    expect(modelLabelOf("claude", "claude-haiku-4-5-20251001")).toBe(
      "Haiku 4.5"
    );
  });
});
