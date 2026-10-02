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
  windowTitleOf,
} from "@/lib/studio/dock";
import { currentPlatform } from "@/lib/studio/platform";
import type { TurnState } from "@/lib/studio/turns";

const paintProgress = (state: ProgressBarState) =>
  Effect.tryPromise(() => getCurrentWindow().setProgressBar(state)).pipe(
    Effect.ignore
  );

const paintBadge = (count: number) =>
  Effect.tryPromise(() =>
    getCurrentWindow().setBadgeCount(count === 0 ? undefined : count)
  ).pipe(Effect.ignore);

const paintTitle = (title: string) =>
  Effect.tryPromise(() => getCurrentWindow().setTitle(title)).pipe(
    Effect.ignore
  );

export function useDock(
  exporting: DockExportReading,
  turns: ReadonlyMap<string, TurnState>
): void {
  const { event, phase } = exporting;
  const bar = useMemo(() => dockProgressOf({ event, phase }), [event, phase]);
  const badge = badgeCountOf(turns);
  const isLinux = currentPlatform() === "linux";
  const title = windowTitleOf({ event, phase }, badge);
  const failureUntil = useRef<number | null>(null);

  useEffect(() => {
    if (!isLinux) {
      return;
    }

    if (phase !== "failed") {
      failureUntil.current = null;
    }
    if (phase === "failed" && failureUntil.current === null) {
      failureUntil.current = Date.now() + ERROR_HOLD_MS;
    }
    const remaining = Math.max(0, (failureUntil.current ?? 0) - Date.now());
    const cleared = windowTitleOf({ event: null, phase: "idle" }, badge);
    const paint =
      remaining === 0
        ? paintTitle(phase === "failed" ? cleared : title)
        : paintTitle(title).pipe(
            Effect.andThen(Effect.sleep(remaining)),
            Effect.andThen(paintTitle(cleared))
          );
    const fiber = Effect.runFork(paint);
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [badge, isLinux, phase, title]);

  useEffect(() => {
    if (isLinux) {
      return;
    }
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
  }, [bar, isLinux]);

  const painted = useRef<number | null>(null);
  useEffect(() => {
    if (isLinux || painted.current === badge) {
      return;
    }
    painted.current = badge;
    Effect.runFork(paintBadge(badge));
  }, [badge, isLinux]);
}
