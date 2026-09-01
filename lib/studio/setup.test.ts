import { describe, expect, it } from "vitest";
import type { EnvironmentCheck } from "@/shared/ipc";
import { PROVIDER_SETUP } from "@/shared/providers";
import {
  failedProviders,
  pendingStep,
  providerStatus,
  shouldRecheck,
  stageStates,
} from "./setup";

const HTTPS = /^https:\/\//;

function row(shape: Partial<EnvironmentCheck>): EnvironmentCheck {
  return {
    detail: null,
    fix: null,
    id: "claude",
    state: "failed",
    title: "",
    ...shape,
  };
}

describe("stageStates", () => {
  it("ticks nothing and points at install when the CLI is missing", () => {
    expect(
      stageStates(row({ fix: { step: "install", type: "provider" } }))
    ).toEqual({ install: "current", return: "todo", signin: "todo" });
  });

  it("ticks install when only the sign-in is missing", () => {
    expect(
      stageStates(row({ fix: { step: "signin", type: "provider" } }))
    ).toEqual({ install: "done", return: "todo", signin: "current" });
  });

  it("ticks everything on an ok row", () => {
    expect(stageStates(row({ state: "ok" }))).toEqual({
      install: "done",
      return: "done",
      signin: "done",
    });
  });

  it("starts from install when a failed row names no step", () => {
    expect(stageStates(row({})).install).toBe("current");
    expect(stageStates(undefined).install).toBe("current");
  });
});

describe("providerStatus", () => {
  it("words the pending step, and says Unavailable for a failure with no step", () => {
    expect(
      providerStatus(row({ fix: { step: "signin", type: "provider" } }))
    ).toBe("Sign in");
    expect(
      providerStatus(row({ fix: { step: "install", type: "provider" } }))
    ).toBe("Not installed");
    expect(providerStatus(row({}))).toBe("Unavailable");
    expect(providerStatus(row({ state: "ok" }))).toBeNull();
    expect(providerStatus(undefined)).toBeNull();
    expect(pendingStep(row({ state: "warn" }))).toBeNull();
  });
});

describe("failedProviders", () => {
  it("lists only failed rows that are providers", () => {
    expect(
      failedProviders([
        row({ id: "claude" }),
        row({ id: "codex", state: "ok" }),
        row({ id: "manager" }),
        row({ id: "grok" }),
      ])
    ).toEqual(["claude", "grok"]);
  });
});

describe("shouldRecheck", () => {
  it("fires the first time and then only once per gap", () => {
    expect(shouldRecheck(null, 1000, 5000)).toBe(true);
    expect(shouldRecheck(1000, 3000, 5000)).toBe(false);
    expect(shouldRecheck(1000, 6000, 5000)).toBe(true);
  });
});

describe("PROVIDER_SETUP", () => {
  it("names a sign-in command per provider that speaks that provider's CLI", () => {
    expect(PROVIDER_SETUP.claude.signin.command).toBe("claude auth login");
    expect(PROVIDER_SETUP.codex.signin.command).toBe("codex login");
    expect(PROVIDER_SETUP.copilot.signin.command).toBe("copilot login");
    expect(PROVIDER_SETUP.grok.signin.command).toBe("grok login");
  });

  it("leads Claude with the native installer and says Desktop does not count", () => {
    expect(PROVIDER_SETUP.claude.install.command).toContain(
      "claude.ai/install.sh"
    );
    expect(PROVIDER_SETUP.claude.note).toContain("Claude Desktop");
  });

  it("gives every install step a page to read", () => {
    for (const setup of Object.values(PROVIDER_SETUP)) {
      expect(setup.install.url).toMatch(HTTPS);
    }
  });
});
