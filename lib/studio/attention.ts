import type { TurnState } from "@/lib/studio/turns";
import type { SidecarPhase } from "@/shared/ipc";

export type AttentionKind =
  | "export-failed"
  | "export-finished"
  | "sidecar-down"
  | "turn-ended"
  | "waiting";

export interface AttentionEvent {
  readonly body: string;
  readonly historyId: string | null;
  readonly kind: AttentionKind;
  readonly title: string;
}

export const NOTIFY_EVENTS = [
  "turnEnded",
  "waiting",
  "export",
  "sidecar",
] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export function notifyEventOf(kind: AttentionKind): NotifyEvent {
  switch (kind) {
    case "turn-ended":
      return "turnEnded";
    case "waiting":
      return "waiting";
    case "export-failed":
    case "export-finished":
      return "export";
    default:
      return "sidecar";
  }
}

export type ExportPhase = "done" | "failed" | "idle" | "running";

export interface AttentionReading {
  readonly exportPhase: ExportPhase;
  readonly sidecarPhase: SidecarPhase | "unknown";
  readonly turns: ReadonlyMap<string, TurnState>;
}

export interface AttentionContext {
  readonly exportVideoName: string | null;
  readonly isEnabled: boolean;
  readonly isEventEnabled: (event: NotifyEvent) => boolean;
  readonly isFocused: boolean;
  readonly videoNameOf: (historyId: string) => string | null;
}

export const STUDIO_TITLE = "Remocn Studio";

const BODIES: Readonly<Record<AttentionKind, string>> = {
  "export-failed": "Export failed.",
  "export-finished": "Export finished.",
  "sidecar-down": "The studio's helper stopped.",
  "turn-ended": "The turn finished.",
  waiting: "The agent is waiting for your answer.",
};

export function attentionEvents(
  before: AttentionReading,
  after: AttentionReading,
  context: AttentionContext
): readonly AttentionEvent[] {
  if (!context.isEnabled || context.isFocused) {
    return [];
  }

  const events: AttentionEvent[] = [];
  const chat = (historyId: string, kind: AttentionKind) =>
    events.push({
      body: BODIES[kind],
      historyId,
      kind,
      title: context.videoNameOf(historyId) ?? STUDIO_TITLE,
    });

  for (const [historyId, turn] of after.turns) {
    const was = before.turns.get(historyId);
    if (was?.isRunning === true && !turn.isRunning) {
      chat(historyId, "turn-ended");
    }
    if (appeared(was, turn)) {
      chat(historyId, "waiting");
    }
  }

  if (before.exportPhase === "running" && after.exportPhase === "done") {
    events.push(exportEvent("export-finished", context.exportVideoName));
  }
  if (before.exportPhase === "running" && after.exportPhase === "failed") {
    events.push(exportEvent("export-failed", context.exportVideoName));
  }

  if (before.sidecarPhase !== "down" && after.sidecarPhase === "down") {
    events.push({
      body: BODIES["sidecar-down"],
      historyId: null,
      kind: "sidecar-down",
      title: STUDIO_TITLE,
    });
  }

  return events.filter((event) =>
    context.isEventEnabled(notifyEventOf(event.kind))
  );
}

function appeared(before: TurnState | undefined, after: TurnState): boolean {
  const known = new Set([
    ...(before?.permissions ?? []).map((row) => row.id),
    ...(before?.sources ?? []).map((row) => row.id),
  ]);
  return (
    after.permissions.some((row) => !known.has(row.id)) ||
    after.sources.some((row) => !known.has(row.id))
  );
}

function exportEvent(
  kind: "export-failed" | "export-finished",
  videoName: string | null
): AttentionEvent {
  return {
    body: BODIES[kind],
    historyId: null,
    kind,
    title: videoName ?? STUDIO_TITLE,
  };
}
