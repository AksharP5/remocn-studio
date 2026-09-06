"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import {
  type StudioSettings,
  saveAssetOffers,
  saveCrashReports,
  saveTitlebarMotion,
  saveTitlebarShader,
} from "@/lib/studio/settings";
import { CRASH_CONSENT_DEFAULT } from "@/shared/crash";

export interface Preferences {
  assetOffers: boolean;
  crashReports: boolean;
  setAssetOffers: (enabled: boolean) => void;
  setCrashReports: (enabled: boolean) => void;
  setTitlebarMotion: (enabled: boolean) => void;
  setTitlebarShader: (shown: boolean) => void;
  titlebarMotion: boolean;
  titlebarShader: boolean;
}

export function usePreferences(settings: StudioSettings | null): Preferences {
  const [offers, setOffers] = useState<boolean | null>(null);
  const [crashes, setCrashes] = useState<boolean | null>(null);
  const [shader, setShader] = useState<boolean | null>(null);
  const [motion, setMotion] = useState<boolean | null>(null);

  const assetOffers = offers ?? settings?.assetOffers ?? true;

  // The band's shader is on by default, and so is its drift: both are the
  // studio's own look, and both are a person's to turn off — the second
  // without losing the first, since a still field is still the mood.
  const titlebarShader = shader ?? settings?.titlebarShader ?? true;
  const titlebarMotion = motion ?? settings?.titlebarMotion ?? true;

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

  const setTitlebarShader = useCallback((shown: boolean) => {
    setShader(shown);
    Effect.runFork(saveTitlebarShader(shown));
  }, []);

  const setTitlebarMotion = useCallback((enabled: boolean) => {
    setMotion(enabled);
    Effect.runFork(saveTitlebarMotion(enabled));
  }, []);

  return useMemo(
    () => ({
      assetOffers,
      crashReports,
      setAssetOffers,
      setCrashReports,
      setTitlebarMotion,
      setTitlebarShader,
      titlebarMotion,
      titlebarShader,
    }),
    [
      assetOffers,
      crashReports,
      setAssetOffers,
      setCrashReports,
      setTitlebarMotion,
      setTitlebarShader,
      titlebarMotion,
      titlebarShader,
    ]
  );
}
