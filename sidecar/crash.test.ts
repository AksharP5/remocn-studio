// @vitest-environment node
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crashLine } from "@/shared/crash";
import { APP_ENVIRONMENT_ENV } from "@/shared/ipc";
import { applyCrashConsent, type CrashSdk, isReporting } from "@/sidecar/crash";

const DSN = "https://key@o1.ingest.sentry.io/1";

function fakeSdk() {
  const sdk = {
    close: vi.fn(() => Promise.resolve(true)),
    eventFiltersIntegration: vi.fn(() => ({ name: "EventFilters" })),
    functionToStringIntegration: vi.fn(() => ({ name: "FunctionToString" })),
    initWithoutDefaultIntegrations: vi.fn(),
    linkedErrorsIntegration: vi.fn(() => ({ name: "LinkedErrors" })),
    onUncaughtExceptionIntegration: vi.fn(() => ({
      name: "OnUncaughtException",
    })),
    onUnhandledRejectionIntegration: vi.fn(() => ({
      name: "OnUnhandledRejection",
    })),
  };
  return sdk as unknown as CrashSdk & typeof sdk;
}

const before = {
  dsn: process.env.REMOCN_STUDIO_SENTRY_DSN,
  environment: process.env[APP_ENVIRONMENT_ENV],
};

beforeEach(() => {
  process.env.REMOCN_STUDIO_SENTRY_DSN = DSN;
  process.env[APP_ENVIRONMENT_ENV] = "production";
});

afterEach(async () => {
  // Back to off, so one test's client cannot outlive it.
  await Effect.runPromise(applyCrashConsent(false, () => Promise.reject()));
  process.env.REMOCN_STUDIO_SENTRY_DSN = before.dsn;
  process.env[APP_ENVIRONMENT_ENV] = before.environment;
});

describe("applyCrashConsent", () => {
  it("never touches the SDK without consent", async () => {
    const load = vi.fn(() => Promise.resolve(fakeSdk()));

    const outcome = await Effect.runPromise(applyCrashConsent(false, load));

    expect(outcome).toEqual({ reason: "no-consent", started: false });
    expect(load).not.toHaveBeenCalled();
    expect(isReporting()).toBe(false);
  });

  // A static import ran on every boot of every process this bundle has, and
  // a module that could not be resolved exited all of them with code 1 — four
  // restart attempts and then `down`, for a feature that was switched off.
  it("is one more way to be off when the SDK cannot be loaded", async () => {
    const load = vi.fn(() =>
      Promise.reject(new Error("Cannot find module '@sentry/bun'"))
    );

    const outcome = await Effect.runPromise(applyCrashConsent(true, load));

    expect(outcome).toEqual({
      detail: "Cannot find module '@sentry/bun'",
      reason: "no-sdk",
      started: false,
    });
    expect(isReporting()).toBe(false);
    expect(crashLine(outcome)).toBe(
      "crash reports are off (no-sdk: Cannot find module '@sentry/bun')"
    );
  });

  it("loads the SDK once consent, build and DSN all agree, and closes it on withdrawal", async () => {
    const sdk = fakeSdk();
    const load = vi.fn(() => Promise.resolve(sdk));

    const on = await Effect.runPromise(applyCrashConsent(true, load));
    expect(on).toEqual({ started: true });
    expect(isReporting()).toBe(true);
    expect(sdk.initWithoutDefaultIntegrations).toHaveBeenCalledTimes(1);
    expect(sdk.initWithoutDefaultIntegrations).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN, includeServerName: false })
    );

    // Idempotent: consent said twice loads nothing twice.
    await Effect.runPromise(applyCrashConsent(true, load));
    expect(load).toHaveBeenCalledTimes(1);

    const off = await Effect.runPromise(applyCrashConsent(false, load));
    expect(off).toEqual({ reason: "no-consent", started: false });
    expect(sdk.close).toHaveBeenCalledWith(0);
    expect(isReporting()).toBe(false);
  });
});
