export const MESSAGE_SOURCE = "remocn-preview";
export const COMMAND_SOURCE = "remocn-studio";

export type TuningValue =
  | boolean
  | number
  | string
  | null
  | readonly (boolean | number | string | null)[];

export type StatusKind = "computed" | "keyframed" | "static";

/** Remotion's own subscription key, carried whole between the two ends. */
export interface TuningNodePath {
  readonly absolutePath: string;
  readonly effectKeys: readonly (readonly string[])[];
  readonly nodePath: readonly (number | string)[];
  readonly sequenceKeys: readonly string[];
  readonly videoConfigValues: {
    readonly durationInFrames: number;
    readonly fps: number;
    readonly height: number;
    readonly width: number;
  } | null;
}

export interface TuningStatus {
  readonly kind: StatusKind;
  readonly status: unknown;
}

export interface TargetStatuses {
  readonly nodePath: TuningNodePath | null;
  readonly props: Readonly<Record<string, TuningStatus>>;
  readonly targetId: string;
}

export type PreviewCommand =
  | { armed: boolean; type: "inspect" }
  | { armed: boolean; type: "snapshot" }
  | { frame: number; type: "seek" }
  | { from: number; type: "replay"; until: number }
  | { type: "pause" }
  | { targets: readonly TargetStatuses[]; type: "tuning.statuses" }
  | { open: boolean; targetId: string | null; type: "highlight" }
  | {
      path: string;
      requestId: string;
      targetId: string;
      type: "tune.set";
      value: TuningValue;
    }
  | {
      paths: readonly string[];
      requestId: string;
      targetId: string;
      type: "tune.reset";
    };

export function post(message: Record<string, unknown>): void {
  window.parent.postMessage({ ...message, source: MESSAGE_SOURCE }, "*");
}

export function onCommand(
  handle: (command: PreviewCommand) => void
): () => void {
  const listener = (event: MessageEvent) => {
    if (event.source !== window.parent || typeof event.data !== "object") {
      return;
    }

    const frame = event.data as { source?: unknown; type?: unknown };

    if (frame.source !== COMMAND_SOURCE || typeof frame.type !== "string") {
      return;
    }

    handle(event.data as PreviewCommand);
  };

  window.addEventListener("message", listener);

  return () => {
    window.removeEventListener("message", listener);
  };
}
