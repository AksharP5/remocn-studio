import {
  type ContextUsage,
  DEFAULT_SESSION_MODE,
  type EffortLevel,
  type PermissionReason,
  type PromptAttachment,
  type PromptElement,
  type PromptFrame,
  type PromptMedia,
  type SessionMode,
  type TranscriptEntry,
} from "@/shared/ipc";
import type { PromptAsset } from "@/shared/library";
import type { PipelineStage } from "@/shared/pipeline";
import { type AgentProvider, DEFAULT_AGENT_PROVIDER } from "@/shared/providers";
import type { ReferenceCounts } from "@/shared/references";

export type SessionStatus = "failed" | "idle" | "running" | "waiting";

export interface PendingPermission {
  askedAt: number;
  id: string;
  input: unknown;
  name: string;
  reason: PermissionReason;
}

export interface PendingSourceAsset {
  askedAt: number;
  attempt: string;
  id: string;
  name: string;
  source: string;
}

export interface QueuedMessage {
  assets: readonly PromptAsset[];
  attachments: readonly PromptAttachment[];
  effort: EffortLevel | null;
  elements: readonly PromptElement[];
  id: string;
  media: readonly PromptMedia[];
  model: string | null;
  playing: PromptFrame | null;
  projectId: string;
  text: string;
  videoId: string;
}

export interface TurnState {
  context: ContextUsage | null;
  entries: readonly TranscriptEntry[];
  error: string | null;
  isLoading: boolean;
  isRunning: boolean;
  mode: SessionMode;
  permissions: readonly PendingPermission[];
  provider: AgentProvider;
  queue: readonly QueuedMessage[];
  sdkSessionId: string | null;
  sources: readonly PendingSourceAsset[];
  stages: readonly PipelineStage[];
  startedAt: number | null;
  unread: boolean;
}

export const IDLE_TURN: TurnState = {
  context: null,
  entries: [],
  error: null,
  isLoading: false,
  isRunning: false,
  mode: DEFAULT_SESSION_MODE,
  permissions: [],
  provider: DEFAULT_AGENT_PROVIDER,
  queue: [],
  sdkSessionId: null,
  sources: [],
  stages: [],
  startedAt: null,
  unread: false,
};

export function enqueue(turn: TurnState, message: QueuedMessage): TurnState {
  return { ...turn, queue: [...turn.queue, message] };
}

export function dropQueued(turn: TurnState, id: string): TurnState {
  const queue = turn.queue.filter((message) => message.id !== id);
  return queue.length === turn.queue.length ? turn : { ...turn, queue };
}

export function nextQueued(
  turn: TurnState,
  hasFailed: boolean
): QueuedMessage | null {
  if (hasFailed || turn.permissions.length > 0 || turn.sources.length > 0) {
    return null;
  }
  return turn.queue[0] ?? null;
}

// A turn that just ended frees its *video*, not only its own chat, so the
// baton can pass to a sibling chat that has been waiting. The order is the
// map's, which is insertion order — the chat that queued first goes first.
export function waitingSibling(
  turns: ReadonlyMap<string, TurnState>,
  videoOf: (historyId: string) => string | null,
  video: string | null,
  besides: string
): { historyId: string; message: QueuedMessage } | null {
  if (video === null) {
    return null;
  }

  for (const [historyId, turn] of turns) {
    if (historyId === besides || videoOf(historyId) !== video) {
      continue;
    }
    const message = nextQueued(turn, false);
    if (message !== null) {
      return { historyId, message };
    }
  }

  return null;
}

export function queuedCounts(message: QueuedMessage): ReferenceCounts {
  return {
    asset: message.assets.length,
    element: message.elements.length,
    image: message.attachments.length,
  };
}

export function queuedLabel(message: QueuedMessage): string {
  const text = message.text.trim();
  if (text.length > 0) {
    return text;
  }

  const carried =
    message.attachments.length +
    message.elements.length +
    message.assets.length +
    message.media.length;

  return carried === 1 ? "1 attachment" : `${carried} attachments`;
}

export function statusOf(turn: TurnState | undefined): SessionStatus {
  if (turn === undefined) {
    return "idle";
  }
  if (turn.permissions.length > 0 || turn.sources.length > 0) {
    return "waiting";
  }
  if (turn.isRunning) {
    return "running";
  }
  return turn.error === null ? "idle" : "failed";
}
