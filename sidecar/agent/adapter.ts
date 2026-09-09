import type { Effect } from "effect";
import type {
  AgentEvent,
  EnvironmentCheck,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import type { ProviderInfo } from "@/shared/providers";
import type { StdioTransport } from "../tools/gateway";
import type { ToolServer } from "../tools/specs";
import type { PermissionGate } from "./gate";
import type { ApplyMode } from "./mode";

export interface TurnBriefs {
  readonly assets: string | null;
  readonly brand?: string | null;
  readonly media: string | null;
  readonly pipeline: string | null;
}

// Everything a turn needs from the app, in provider-neutral terms: the gate
// and the mode switch are pure Effect, and the studio's tools arrive as
// stdio-MCP transports every CLI can spawn — the implementations stay behind
// the gateway in the sidecar. `emit` is the raw stream; `record` is the
// history write, kept separate because a permission ask rides the stream but
// must not land in the transcript.
export interface TurnServices {
  readonly briefs: TurnBriefs;
  readonly cwd: string;
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly gate: PermissionGate;
  readonly log: (line: string) => Effect.Effect<void>;
  readonly onApprove: (mode: SessionMode) => Effect.Effect<void>;
  readonly onMode: (apply: ApplyMode) => Effect.Effect<void>;
  readonly record: (event: AgentEvent) => Effect.Effect<void>;
  // Keyed by server, and a Free turn is served fewer of them: the pipeline
  // is Pro, so its key is simply absent rather than pointing at a refusal.
  readonly tools: Readonly<Partial<Record<ToolServer, StdioTransport>>>;
  readonly turnId: string;
  // The composition this turn is about, by slug — the folder under src/videos
  // and the id the preview plays. Null when the row could not be read, which
  // costs the conventions their one concrete sentence and nothing else.
  readonly video: string | null;
}

// A turn never fails as an Effect: every way it can go wrong is folded into
// `failure` so the words reach the UI. Cancellation is fiber interruption,
// which each adapter turns into whatever its runtime calls a stop.
export interface AgentAdapter {
  readonly account: (cwd: string) => Effect.Effect<EnvironmentCheck>;
  readonly info: ProviderInfo;
  readonly turn: (
    params: PromptParams,
    services: TurnServices
  ) => Effect.Effect<PromptResult>;
}
