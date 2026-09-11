"use client";

import {
  getCurrentWindow,
  type ProgressBarState,
  ProgressBarStatus,
} from "@tauri-apps/api/window";
import { Effect, Fiber } from "effect";
import { useEffect, useMemo, useRef } from "react";
import {
  badgeCountOf,
  type DockExportReading,
  dockProgressOf,
  ERROR_HOLD_MS,
} from "@/lib/studio/dock";
import type { TurnState } from "@/lib/studio/turns";

const paintProgress = (state: ProgressBarState) =>
  Effect.tryPromise(() => getCurrentWindow().setProgressBar(state)).pipe(
    Effect.ignore
  );

const paintBadge = (count: number) =>
  Effect.tryPromise(() =>
    getCurrentWindow().setBadgeCount(count === 0 ? undefined : count)
  ).pipe(Effect.ignore);

export function useDock(
  exporting: DockExportReading,
  turns: ReadonlyMap<string, TurnState>
): void {
  const { event, phase } = exporting;
  const bar = useMemo(() => dockProgressOf({ event, phase }), [event, phase]);
  const badge = badgeCountOf(turns);

  useEffect(() => {
    const paint =
      bar.status === ProgressBarStatus.Error
        ? paintProgress(bar).pipe(
            Effect.andThen(Effect.sleep(ERROR_HOLD_MS)),
            Effect.andThen(paintProgress({ status: ProgressBarStatus.None }))
          )
        : paintProgress(bar);
    const fiber = Effect.runFork(paint);
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [bar]);

  const painted = useRef<number | null>(null);
  useEffect(() => {
    if (painted.current === badge) {
      return;
    }
    painted.current = badge;
    Effect.runFork(paintBadge(badge));
  }, [badge]);
}
