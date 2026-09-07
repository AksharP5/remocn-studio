import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  HistorySession,
  PromptParams,
  RecordedMessage,
  SessionMode,
  TranscriptEntry,
} from "@/shared/ipc";

export const listSessions: Effect.Effect<
  readonly HistorySession[],
  SidecarError
> = Effect.gen(function* () {
  const id = yield* newRequestId;

  return yield* requestSidecar({
    id,
    method: "history.sessions",
    params: null,
  });
});

export function loadTranscript(
  sessionId: string
): Effect.Effect<readonly TranscriptEntry[], SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "history.blocks",
      params: { sessionId },
    });
  });
}

export function saveSessionMode(
  sessionId: string,
  mode: SessionMode
): Effect.Effect<HistorySession, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "history.mode",
      params: { mode, sessionId },
    });
  });
}

/**
 * A message that starts no turn, put in the transcript anyway.
 *
 * A send that only wrote values into the code has nothing to ask the agent, so
 * there is no turn to run — and the message still happened, so the chat has to
 * show it. This is `agent.prompt`'s first two steps and nothing else.
 */
export function recordMessage(
  params: PromptParams
): Effect.Effect<RecordedMessage, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "history.record", params });
  });
}

export function removeSession(
  sessionId: string
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "history.remove",
      params: { sessionId },
    });

    return answer.removed;
  });
}
