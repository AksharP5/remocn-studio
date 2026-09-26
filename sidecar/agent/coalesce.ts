import { type Duration, Effect, Semaphore } from "effect";
import type { AgentEvent } from "@/shared/ipc";

type Streamed = Extract<AgentEvent, { type: "text" | "thinking" }>;

export interface Coalescing {
  readonly emit: (event: AgentEvent) => Effect.Effect<void>;
  readonly flush: Effect.Effect<void>;
}

function isStreamed(event: AgentEvent): event is Streamed {
  return event.type === "text" || event.type === "thinking";
}

export function coalescing(
  emit: (event: AgentEvent) => Effect.Effect<void>,
  window: Duration.Input
): Effect.Effect<Coalescing> {
  return Effect.sync(() => {
    const lock = Semaphore.makeUnsafe(1);
    let held: Streamed | null = null;
    let scheduled = false;

    const release = Effect.suspend(() => {
      const out = held;
      held = null;
      return out === null ? Effect.void : emit(out);
    });

    const flush = lock.withPermits(1)(release);

    const later = Effect.suspend(() => {
      if (scheduled) {
        return Effect.void;
      }
      scheduled = true;
      return Effect.asVoid(
        Effect.forkDetach(
          Effect.sleep(window).pipe(
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

    return {
      emit: (event) =>
        lock.withPermits(1)(
          Effect.gen(function* () {
            if (!isStreamed(event)) {
              yield* release;
              yield* emit(event);
              return;
            }
            if (held !== null && held.type === event.type) {
              held = { text: held.text + event.text, type: held.type };
              return;
            }
            yield* release;
            held = event;
            yield* later;
          })
        ),
      flush,
    } satisfies Coalescing;
  });
}
