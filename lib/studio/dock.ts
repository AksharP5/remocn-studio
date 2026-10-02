import {
  type ProgressBarState,
  ProgressBarStatus,
} from "@tauri-apps/api/window";
import type { ExportPhase } from "@/lib/studio/attention";
import type { TurnState } from "@/lib/studio/turns";
import type { ExportEvent } from "@/shared/ipc";

export interface DockExportReading {
  readonly event: ExportEvent | null;
  readonly phase: ExportPhase;
}

export const ERROR_HOLD_MS = 3000;

export function windowTitleOf(
  reading: DockExportReading,
  waiting: number
): string {
  const parts = ["Remocn Studio"];
  if (waiting > 0) {
    parts.push(`${waiting} waiting`);
  }

  const bar = dockProgressOf(reading);
  if (bar.status === ProgressBarStatus.Error) {
    parts.push("Export failed");
  }
  if (bar.status === ProgressBarStatus.Normal) {
    const { event } = reading;
    parts.push(
      event?.type === "progress" && event.total > 0
        ? `Export ${bar.progress ?? 0}%`
        : "Exporting"
    );
  }
  return parts.join(" · ");
}

export function dockProgressOf(reading: DockExportReading): ProgressBarState {
  if (reading.phase === "failed") {
    return { status: ProgressBarStatus.Error };
  }
  if (reading.phase !== "running") {
    return { status: ProgressBarStatus.None };
  }

  const { event } = reading;
  if (event === null || event.type !== "progress" || event.total === 0) {
    return { progress: 0, status: ProgressBarStatus.Normal };
  }
  if (event.rendered >= event.total && event.encoded >= event.total) {
    return { progress: 100, status: ProgressBarStatus.Normal };
  }
  const progress = Math.round(
    ((event.rendered + event.encoded) / (2 * event.total)) * 100
  );
  return {
    progress: Math.max(0, Math.min(100, progress)),
    status: ProgressBarStatus.Normal,
  };
}

export function sameProgress(
  a: ProgressBarState,
  b: ProgressBarState
): boolean {
  return a.status === b.status && (a.progress ?? null) === (b.progress ?? null);
}

export function badgeCountOf(turns: ReadonlyMap<string, TurnState>): number {
  let count = 0;
  for (const turn of turns.values()) {
    count += turn.permissions.length + turn.sources.length;
  }
  return count;
}
