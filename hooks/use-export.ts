"use client";

import { Effect, type Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRevealInFinder } from "@/hooks/use-reveal-in-finder";
import { causeMessage } from "@/lib/error-message";
import {
  type ExportBrief,
  exportBrief,
  exportPercent,
  exportStatus,
  renderExport,
} from "@/lib/studio/export";
import type { SidecarError } from "@/lib/studio/sidecar";
import type { ExportEvent, Exported } from "@/shared/ipc";

// The result belongs to a video, not to a project: with several videos in one
// folder, keying by project alone would show one video's render in another's
// panel. `composition` is that identity, and it is already a setting here.
export type ExportState =
  | {
      composition: string;
      event: ExportEvent | null;
      phase: "running";
      projectId: string;
    }
  | {
      composition: string;
      exported: Exported;
      phase: "done";
      projectId: string;
    }
  | {
      composition: string;
      message: string;
      phase: "failed";
      projectId: string;
    }
  | { phase: "idle" };

export interface Exporting {
  brief: ExportBrief | null;
  cancel: () => void;
  canExport: boolean;
  isRunning: boolean;
  percent: number | null;
  result: Exported | null;
  reveal: () => Promise<void>;
  start: () => void;
  status: string | null;
  trouble: string | null;
  unavailable: string | null;
}

export interface ExportSettings {
  composition: string | null;
  isServing: boolean;
  projectId: string | null;
}

const IDLE: ExportState = { phase: "idle" };

export function useExport({
  composition,
  isServing,
  projectId,
}: ExportSettings): Exporting {
  const [state, setState] = useState<ExportState>(IDLE);
  const inflight = useRef<Fiber.Fiber<Exported, SidecarError> | null>(null);

  const cancel = useCallback(() => {
    const fiber = inflight.current;

    if (fiber !== null) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const mine = ownedBy(state, projectId, composition);
  const result = mine?.phase === "done" ? mine.exported : null;
  const { error, reveal } = useRevealInFinder(result?.path ?? null);

  const unavailable = unavailableOf({
    busyElsewhere: state.phase === "running" && mine === null,
    composition,
    isServing,
    projectId,
  });

  const start = useCallback(() => {
    if (
      unavailable !== null ||
      inflight.current !== null ||
      projectId === null ||
      composition === null
    ) {
      return;
    }

    setState({ composition, event: null, phase: "running", projectId });

    const shipping = renderExport({ composition, projectId }, (event) =>
      setState((current) =>
        current.phase === "running" &&
        current.projectId === projectId &&
        current.composition === composition
          ? { composition, event, phase: "running", projectId }
          : current
      )
    ).pipe(
      Effect.onExit((exit) =>
        Effect.sync(() => {
          inflight.current = null;
          setState(settled(exit, projectId, composition));
        })
      )
    );

    inflight.current = Effect.runFork(shipping);
  }, [composition, projectId, unavailable]);

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () => ({
      brief: mine?.phase === "running" ? exportBrief(mine.event) : null,
      cancel,
      canExport: unavailable === null,
      isRunning: mine?.phase === "running",
      percent: mine?.phase === "running" ? exportPercent(mine.event) : null,
      result,
      reveal,
      start,
      status: mine?.phase === "running" ? exportStatus(mine.event) : null,
      trouble: (mine?.phase === "failed" ? mine.message : null) ?? error,
      unavailable,
    }),
    [cancel, error, mine, result, reveal, start, unavailable]
  );
}

function ownedBy(
  state: ExportState,
  projectId: string | null,
  composition: string | null
): Exclude<ExportState, { phase: "idle" }> | null {
  return state.phase !== "idle" &&
    state.projectId === projectId &&
    state.composition === composition
    ? state
    : null;
}

function settled(
  exit: Exit.Exit<Exported, SidecarError>,
  projectId: string,
  composition: string
): ExportState {
  if (exit._tag === "Success") {
    return { composition, exported: exit.value, phase: "done", projectId };
  }

  const message = causeMessage(exit.cause);

  return message === null
    ? IDLE
    : { composition, message, phase: "failed", projectId };
}

function unavailableOf(state: {
  busyElsewhere: boolean;
  composition: string | null;
  isServing: boolean;
  projectId: string | null;
}): string | null {
  if (state.projectId === null) {
    return "Open a project to export it.";
  }
  if (state.busyElsewhere) {
    return "Another project is exporting, and only one export runs at a time.";
  }
  if (!state.isServing) {
    return "The preview has to be running before it can be exported.";
  }
  if (state.composition === null) {
    return "There is no composition to export.";
  }
  return null;
}
