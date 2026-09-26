import { type Duration, Effect, Ref, Semaphore } from "effect";
import type {
  AgentEvent,
  HistorySession,
  PromptParams,
  TranscriptEntry,
} from "@/shared/ipc";
import { appendUser, fold } from "@/shared/transcript";
import type { HistoryError, HistoryStore } from "./store";

const TITLE_LIMIT = 60;
const STREAMED_WRITE: Duration.Input = "250 millis";
const WHITESPACE = /\s+/g;

export interface Recorder {
  readonly event: (event: AgentEvent) => Effect.Effect<void>;
  readonly flush: Effect.Effect<void>;
  readonly session: HistorySession | null;
}

const INERT: Recorder = {
  event: () => Effect.void,
  flush: Effect.void,
  session: null,
};

function streamed(event: AgentEvent): boolean {
  return event.type === "text" || event.type === "thinking";
}

export function recording(
  store: HistoryStore,
  params: PromptParams,
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<Recorder> {
  const tolerate = <A>(effect: Effect.Effect<A, HistoryError>) =>
    effect.pipe(
      Effect.catch((error) =>
        log(`history: ${error.message}`).pipe(Effect.as(null))
      )
    );

  return Effect.gen(function* () {
    const session = yield* tolerate(
      store.open({
        id: params.historyId,
        mode: params.mode,
        projectId: params.projectId,
        provider: params.provider,
        title: titleOf(params),
        videoId: params.videoId,
      })
    );
    if (session === null) {
      return INERT;
    }

    const base = yield* tolerate(store.nextOrdinal(session.id));
    if (base === null) {
      return INERT;
    }

    const entries = yield* Ref.make<readonly TranscriptEntry[]>([]);
    const pending = new Set<number>();
    const lock = yield* Semaphore.make(1);
    let scheduled = false;

    const flush = lock.withPermits(1)(
      Effect.gen(function* () {
        const current = yield* Ref.get(entries);
        const indices = [...pending].sort((left, right) => left - right);
        pending.clear();

        yield* tolerate(
          Effect.forEach(
            indices,
            (index) =>
              store.write({
                entry: current[index],
                ordinal: base + index,
                sessionId: session.id,
              }),
            { discard: true }
          )
        );
      })
    );

    const later = Effect.suspend(() => {
      if (scheduled) {
        return Effect.void;
      }
      scheduled = true;
      return Effect.asVoid(
        Effect.forkDetach(
          Effect.sleep(STREAMED_WRITE).pipe(
            Effect.andThen(
              Effect.sync(() => {
                scheduled = false;
              })
            ),
            Effect.andThen(flush)
          )
        )
      );
    });

    const apply = (
      step: (current: readonly TranscriptEntry[]) => readonly TranscriptEntry[]
    ) =>
      Effect.gen(function* () {
        const previous = yield* Ref.get(entries);
        const next = step(previous);
        yield* Ref.set(entries, next);

        for (const index of changed(previous, next)) {
          pending.add(index);
        }
      });

    yield* apply((current) =>
      appendUser(current, {
        assets: params.assets,
        attachments: params.attachments,
        elements: params.elements,
        media: params.media,
        text: params.prompt,
      })
    );
    yield* flush;

    return {
      event: (event) => {
        if (event.type === "session") {
          return Effect.asVoid(
            tolerate(store.bind(session.id, event.sessionId))
          );
        }
        return Effect.andThen(
          apply((current) => fold(current, event)),
          streamed(event) ? later : flush
        );
      },
      flush,
      session,
    };
  });
}

function changed(
  previous: readonly TranscriptEntry[],
  next: readonly TranscriptEntry[]
): number[] {
  const indices: number[] = [];
  for (const [index, entry] of next.entries()) {
    if (entry !== previous[index]) {
      indices.push(index);
    }
  }
  return indices;
}

function titleOf(params: PromptParams): string {
  const flat = params.prompt.replace(WHITESPACE, " ").trim();

  if (flat.length === 0) {
    return params.attachments.at(0)?.name ?? "Untitled chat";
  }

  return flat.length <= TITLE_LIMIT
    ? flat
    : `${flat.slice(0, TITLE_LIMIT - 1).trimEnd()}…`;
}
