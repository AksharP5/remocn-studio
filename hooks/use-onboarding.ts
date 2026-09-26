"use client";

import type { Dialog } from "@base-ui/react/dialog";
import { Effect } from "effect";
import { type MouseEvent, useCallback, useMemo, useRef, useState } from "react";
import {
  ONBOARDING_CHAPTERS,
  type OnboardingProgress,
  onboardingChapter,
} from "@/lib/studio/onboarding";
import { type StudioSettings, saveOnboarding } from "@/lib/studio/settings";

export interface OnboardingInputs {
  blocked: boolean;
  hasProject: boolean;
  isRunning: boolean;
  isSettingsOpen: boolean;
  settings: Pick<StudioSettings, "onboarding"> | null;
}

export function useOnboarding({
  blocked,
  hasProject,
  isRunning,
  isSettingsOpen,
  settings,
}: OnboardingInputs) {
  const [draft, setDraft] = useState<OnboardingProgress | null>(null);
  const [manual, setManual] = useState(false);
  const [onCover, setOnCover] = useState(true);
  const [motion, setMotion] = useState<
    "idle" | "instant" | "forward" | "backward"
  >("idle");
  const [saveError, setSaveError] = useState(false);
  const writeRevision = useRef(0);
  const progress = draft ??
    settings?.onboarding ?? { chapter: "inspect", dismissed: false };
  const chapter = onboardingChapter(progress.chapter);
  const index = ONBOARDING_CHAPTERS.indexOf(chapter);
  const isOpen =
    manual ||
    (!blocked &&
      settings !== null &&
      !progress.dismissed &&
      hasProject &&
      !isRunning &&
      !isSettingsOpen);
  const persist = useCallback((updated: OnboardingProgress) => {
    writeRevision.current += 1;
    const revision = writeRevision.current;
    setDraft(updated);
    Effect.runFork(
      saveOnboarding(updated).pipe(
        Effect.match({
          onFailure: () => {
            if (revision === writeRevision.current) {
              setSaveError(true);
            }
          },
          onSuccess: () => {
            if (revision === writeRevision.current) {
              setSaveError(false);
            }
          },
        })
      )
    );
  }, []);
  const open = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    setMotion(event && event.detail > 0 ? "idle" : "instant");
    setOnCover(false);
    setManual(true);
  }, []);
  const onKeyDownCapture = useCallback(() => setMotion("instant"), []);
  const close = useCallback(() => {
    setManual(false);
    persist({ ...progress, dismissed: true });
  }, [persist, progress]);
  const select = useCallback(
    (id: string, animate = false) => {
      const selected = onboardingChapter(id);
      if (onCover) {
        setMotion(animate ? "forward" : "instant");
        setOnCover(false);
      }
      if (selected.id === chapter.id) {
        return;
      }
      const direction =
        ONBOARDING_CHAPTERS.indexOf(selected) > index ? "forward" : "backward";
      setMotion(animate ? direction : "instant");
      persist({ ...progress, chapter: selected.id });
    },
    [chapter.id, index, onCover, persist, progress]
  );
  const onChapterClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      select(event.currentTarget.value, event.detail > 0),
    [select]
  );
  const start = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) =>
      select(ONBOARDING_CHAPTERS[0].id, Boolean(event && event.detail > 0)),
    [select]
  );
  const previous = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) => {
      if (index === 0) {
        setMotion(event && event.detail > 0 ? "backward" : "instant");
        setOnCover(true);
      } else {
        select(
          ONBOARDING_CHAPTERS[index - 1].id,
          Boolean(event && event.detail > 0)
        );
      }
    },
    [index, select]
  );
  const next = useCallback(
    (event?: MouseEvent<HTMLButtonElement>) => {
      if (index === ONBOARDING_CHAPTERS.length - 1) {
        close();
      } else {
        select(
          ONBOARDING_CHAPTERS[index + 1].id,
          Boolean(event && event.detail > 0)
        );
      }
    },
    [close, index, select]
  );
  const retrySave = useCallback(() => persist(progress), [persist, progress]);
  const onOpenChange = useCallback(
    (value: boolean, details?: Dialog.Root.ChangeEventDetails) => {
      if (!value) {
        details?.event.preventDefault();
        close();
      }
    },
    [close]
  );
  return useMemo(
    () => ({
      chapter,
      close,
      index,
      isOpen,
      motion,
      next,
      onChapterClick,
      onCover,
      onKeyDownCapture,
      onOpenChange,
      open,
      previous,
      retrySave,
      saveError,
      start,
    }),
    [
      chapter,
      close,
      index,
      isOpen,
      motion,
      next,
      onKeyDownCapture,
      onChapterClick,
      onCover,
      onOpenChange,
      open,
      previous,
      retrySave,
      saveError,
      start,
    ]
  );
}

export type Onboarding = ReturnType<typeof useOnboarding>;
