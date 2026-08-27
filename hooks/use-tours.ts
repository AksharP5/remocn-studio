"use client";

import { type Duration, Effect, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type StudioSettings, saveToursSeen } from "@/lib/studio/settings";
import {
  nextTip,
  type TourId,
  type TourReveal,
  type TourStage,
  type TourTip,
} from "@/lib/studio/tours";

// A feature becoming available is not on its own a reason to interrupt: the
// tip waits until it has been available and unchanged for this long, so a
// pane that opens on the way somewhere else never flashes a card at you.
const DWELL = "2 seconds";

export interface Tours {
  /** Dismiss for this launch only — nothing is written down. */
  close: () => void;
  /** "Got it": the tip is answered and never offered again. */
  dismiss: () => void;
  hasSeenAny: boolean;
  replay: () => void;
  /** The tip's "Show me", when it has one. */
  reveal: (() => void) | null;
  tip: TourTip | null;
}

export interface TourInputs {
  /** The wait before an available tip appears. A parameter so tests shrink it. */
  dwell?: Duration.Input;
  onReveal: (reveal: TourReveal) => void;
  settings: StudioSettings | null;
  stage: TourStage;
}

// One tip at a time, remembered across launches, and never before the studio
// knows which tips have already been answered — showing a card the person
// dismissed last week is worse than showing none.
export function useTours({
  dwell = DWELL,
  onReveal,
  settings,
  stage,
}: TourInputs): Tours {
  const [answered, setAnswered] = useState<readonly string[] | null>(null);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const [shownId, setShownId] = useState<TourId | null>(null);

  const seen = answered ?? settings?.toursSeen ?? null;

  const candidate =
    seen === null ? null : nextTip(stage, [...seen, ...skipped]);
  const candidateId = candidate?.id ?? null;

  useEffect(() => {
    if (candidateId === null) {
      setShownId(null);
      return;
    }

    const fiber = Effect.runFork(
      Effect.sleep(dwell).pipe(
        Effect.andThen(
          Effect.sync(() => {
            setShownId(candidateId);
          })
        )
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [candidateId, dwell]);

  const dismiss = useCallback(() => {
    if (candidateId === null || seen === null) {
      return;
    }

    const next = seen.includes(candidateId) ? seen : [...seen, candidateId];
    setAnswered(next);
    setShownId(null);
    Effect.runFork(saveToursSeen(next));
  }, [candidateId, seen]);

  const close = useCallback(() => {
    if (candidateId === null) {
      return;
    }

    setSkipped((current) =>
      current.includes(candidateId) ? current : [...current, candidateId]
    );
    setShownId(null);
  }, [candidateId]);

  const replay = useCallback(() => {
    setAnswered([]);
    setSkipped([]);
    Effect.runFork(saveToursSeen([]));
  }, []);

  // The tip on screen is the candidate itself: the dwell only decides *when*
  // it is allowed to appear, so a feature that goes away while the timer runs
  // takes its tip with it rather than showing a card about nothing.
  const tip = candidate !== null && candidate.id === shownId ? candidate : null;
  const action = tip?.action ?? null;

  const reveal = useCallback(() => {
    if (action !== null) {
      onReveal(action.reveal);
    }
    dismiss();
  }, [action, dismiss, onReveal]);

  return useMemo(
    () => ({
      close,
      dismiss,
      hasSeenAny: (seen?.length ?? 0) > 0,
      replay,
      reveal: action === null ? null : reveal,
      tip,
    }),
    [action, close, dismiss, replay, reveal, seen, tip]
  );
}
