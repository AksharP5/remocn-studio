import { beforeEach, describe, expect, it } from "bun:test";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { renderHook, waitFor } from "@testing-library/react";
import { useCrashReporting } from "@/hooks/use-crash-reporting";
import { applyCrashConsent, isCrashReportingStarted } from "@/lib/studio/crash";

interface Told {
  consents: boolean[];
}

function install(reporting = false): Told {
  const told: Told = { consents: [] };

  mockIPC((cmd, payload) => {
    if (cmd === "sidecar_request") {
      const { method, params } = payload as {
        method: string;
        params: { enabled: boolean };
      };

      if (method === "crash.consent") {
        told.consents.push(params.enabled);
        return { reporting };
      }
    }
  });

  return told;
}

describe("the webview's own SDK", () => {
  // The test build has no `NEXT_PUBLIC_SENTRY_DSN`, which is the same state
  // every build is in until #268's Sentry project exists. It is the state
  // worth pinning: nothing may start in it.
  it("starts nothing without consent, whatever the build says", () => {
    expect(
      applyCrashConsent({
        build: { environment: "production", version: "0.4.1" },
        consent: false,
      })
    ).toEqual({ reason: "no-consent", started: false });

    expect(isCrashReportingStarted()).toBe(false);
  });

  it("starts nothing in a build carrying no DSN", () => {
    expect(
      applyCrashConsent({
        build: { environment: "production", version: "0.4.1" },
        consent: true,
      })
    ).toEqual({ reason: "no-dsn", started: false });

    expect(isCrashReportingStarted()).toBe(false);
  });

  it("starts nothing in development", () => {
    expect(
      applyCrashConsent({
        build: { environment: "development", version: "0.4.1" },
        consent: true,
      })
    ).toEqual({ reason: "development", started: false });
  });

  // Before `studio_build` answers there is no environment to judge, and the
  // updater treats that state the same way: nothing happens yet.
  it("starts nothing before the core has answered", () => {
    expect(
      applyCrashConsent({
        build: { environment: null, version: null },
        consent: true,
      })
    ).toEqual({ reason: "development", started: false });
  });
});

describe("useCrashReporting", () => {
  beforeEach(() => {
    clearMocks();
  });

  it("says nothing to the sidecar until the settings have hydrated", async () => {
    const told = install();

    renderHook(() =>
      useCrashReporting({
        consent: true,
        environment: "production",
        isHydrated: false,
        version: "0.4.1",
      })
    );

    await waitFor(() => expect(told.consents).toEqual([]));
  });

  it("tells the sidecar what the settings said", async () => {
    const told = install(true);

    renderHook(() =>
      useCrashReporting({
        consent: true,
        environment: "production",
        isHydrated: true,
        version: "0.4.1",
      })
    );

    await waitFor(() => expect(told.consents).toEqual([true]));
  });

  // The direction that has to bite now rather than at the next launch.
  it("tells the sidecar when the switch goes off", async () => {
    const told = install();

    const { rerender } = renderHook(
      (consent: boolean) =>
        useCrashReporting({
          consent,
          environment: "production",
          isHydrated: true,
          version: "0.4.1",
        }),
      { initialProps: true }
    );

    await waitFor(() => expect(told.consents).toEqual([true]));

    rerender(false);

    await waitFor(() => expect(told.consents).toEqual([true, false]));
  });

  // A sidecar that is down, or a build with no DSN, answers with an error or
  // a `false` — and neither is a thing to put on screen. The setting is
  // already saved; this is only the process being told.
  it("survives a sidecar that cannot answer", () => {
    mockIPC(() => {
      throw new Error("the sidecar is not running");
    });

    expect(() =>
      renderHook(() =>
        useCrashReporting({
          consent: true,
          environment: "production",
          isHydrated: true,
          version: "0.4.1",
        })
      )
    ).not.toThrow();
  });
});
