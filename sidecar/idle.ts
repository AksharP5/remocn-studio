import { type Duration, Effect, FiberHandle, Ref, type Scope } from "effect";

export interface Idle {
  readonly hold: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
  readonly touch: Effect.Effect<void>;
}

export function makeIdle(
  after: Duration.Input,
  onIdle: Effect.Effect<void>
): Effect.Effect<Idle, never, Scope.Scope> {
  return Effect.gen(function* () {
    const timer = yield* FiberHandle.make<void>();
    const busy = yield* Ref.make(0);

    const arm = Effect.flatMap(Ref.get(busy), (count) =>
      count > 0
        ? Effect.void
        : Effect.asVoid(
            FiberHandle.run(
              timer,
              Effect.andThen(
                Effect.sleep(after),
                Effect.uninterruptible(onIdle)
              )
            )
          )
    );

    return {
      hold: (effect) =>
        Effect.acquireUseRelease(
          Effect.andThen(
            Ref.update(busy, (count) => count + 1),
            FiberHandle.clear(timer)
          ),
          () => effect,
          () =>
            Effect.andThen(
              Ref.update(busy, (count) => count - 1),
              arm
            )
        ),
      touch: arm,
    } satisfies Idle;
  });
}
