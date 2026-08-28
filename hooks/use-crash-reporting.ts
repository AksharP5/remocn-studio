"use client";

import { Effect } from "effect";
import { useEffect } from "react";
import { applyCrashConsent, tellSidecarConsent } from "@/lib/studio/crash";
import type { AppEnvironment } from "@/shared/ipc";

/**
 * Applies the consent to both processes the webview can reach: its own SDK,
 * and the sidecar's.
 *
 * It runs on every change rather than once at boot, because withdrawing
 * consent is the direction that has to take effect now — a switch that only
 * bit at the next launch would be a switch that lies. `applyCrashConsent` is
 * idempotent, so a re-render costs a comparison.
 *
 * Nothing is reported before the settings hydrate, and that is accepted: the
 * alternative is initialising the SDK on a guess and closing it a moment
 * later, which is the one shape #268 rules out.
 */
export function useCrashReporting(input: {
  consent: boolean;
  environment: AppEnvironment | null;
  isHydrated: boolean;
  version: string | null;
}): void {
  const { consent, environment, isHydrated, version } = input;

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    applyCrashConsent({ build: { environment, version }, consent });
  }, [consent, environment, isHydrated, version]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    // The sidecar answers what it is actually doing, which a build with no
    // DSN reports as false. Nothing is shown either way: this is a setting
    // taking effect, not an action with a result to report.
    Effect.runFork(Effect.ignore(tellSidecarConsent(consent)));
  }, [consent, isHydrated]);
}
