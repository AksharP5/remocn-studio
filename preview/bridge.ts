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
  | {
      type: "studio.geometry.config";
      enabled: boolean;
      generation: string;
      objectId: string | null;
      video: string;
      fields: readonly {
        id: string;
        value: number;
        min: number | null;
        max: number | null;
      }[];
    }
  | { type: "studio.geometry.result"; requestId: string; error: string | null }
  | {
      type: "studio.batch";
      generation: string;
      objectId: string;
      values: Readonly<
        Record<
          string,
          string | number | boolean | readonly [number, number, number, number]
        >
      >;
    }
  | {
      type: "studio.text.open";
      requestId: string;
      candidate: number;
      label: string;
      value: string;
    }
  | { type: "studio.text.close"; requestId: string; error: string | null }
  | { type: "transport.request" }
  | { type: "transport.toggle" }
  | { type: "transport.step"; direction: -1 | 1 }
  | { type: "transport.audio"; muted: boolean; volume: number }
  | { type: "studio.request" }
  | {
      type: "studio.draft";
      generation: string;
      objectId: string;
      field: string;
      value:
        | string
        | number
        | boolean
        | readonly [number, number, number, number];
    }
  | {
      type: "studio.highlight";
      objectId: string | null;
      generation: string;
      video: string;
    }
  | { objectId: string | null; type: "studio.hover" }
  | { armed: boolean; type: "inspect" }
  | { type: "inspect.clear" }
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

interface LocalBridge {
  emit: (message: Record<string, unknown>) => void;
  subscribe: (receive: (command: PreviewCommand) => void) => () => void;
}
let local: LocalBridge | null = null;

export function configureBridge(bridge: LocalBridge): () => void {
  local = bridge;
  return () => {
    if (local === bridge) {
      local = null;
    }
  };
}

export function post(message: Record<string, unknown>): void {
  if (local) {
    const bridge = local;
    queueMicrotask(() => {
      if (local === bridge) {
        bridge.emit({ ...message, source: MESSAGE_SOURCE });
      }
    });
  } else {
    window.parent.postMessage({ ...message, source: MESSAGE_SOURCE }, "*");
  }
}

export function onCommand(
  handle: (command: PreviewCommand) => void
): () => void {
  if (local) {
    return local.subscribe(handle);
  }
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
