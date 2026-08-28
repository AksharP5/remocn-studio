"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import {
  type StudioSettings,
  saveAssetOffers,
  saveCrashReports,
} from "@/lib/studio/settings";
import { CRASH_CONSENT_DEFAULT } from "@/shared/crash";

export interface Preferences {
  assetOffers: boolean;
  crashReports: boolean;
  setAssetOffers: (enabled: boolean) => void;
  setCrashReports: (enabled: boolean) => void;
}

export function usePreferences(settings: StudioSettings | null): Preferences {
  const [offers, setOffers] = useState<boolean | null>(null);
  const [crashes, setCrashes] = useState<boolean | null>(null);

  const assetOffers = offers ?? settings?.assetOffers ?? true;

  // Opt-in: a setting that has never been answered is off. The default lives
  // in `shared/crash.ts` beside the reader Rust mirrors, so the webview and
  // the core cannot disagree about what an unanswered setting means.
  const crashReports =
    crashes ?? settings?.crashReports ?? CRASH_CONSENT_DEFAULT;

  const setAssetOffers = useCallback((enabled: boolean) => {
    setOffers(enabled);
    Effect.runFork(saveAssetOffers(enabled));
  }, []);

  // Only the store is written here. Reaching the two SDKs is
  // `useCrashReporting`'s job, which watches this value — so a consent
  // restored from disk at boot and one flipped by hand take the same path.
  const setCrashReports = useCallback((enabled: boolean) => {
    setCrashes(enabled);
    Effect.runFork(saveCrashReports(enabled));
  }, []);

  return useMemo(
    () => ({ assetOffers, crashReports, setAssetOffers, setCrashReports }),
    [assetOffers, crashReports, setAssetOffers, setCrashReports]
  );
}
