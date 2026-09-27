import { describe, expect, it } from "bun:test";
import { Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import { makeIdle } from "./idle";

const run = <A>(effect: Effect.Effect<A, never, never>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestClock.layer())));

describe("makeIdle", () => {
  it("does nothing until it has been used", async () => {
    const closed = await run(
      Effect.scoped(
        Effect.gen(function* () {
          const count = yield* Ref.make(0);
          yield* makeIdle(
            "90 seconds",
            Ref.update(count, (n) => n + 1)
          );
          yield* TestClock.adjust("10 minutes");
          return yield* Ref.get(count);
        })
      )
    );

    expect(closed).toBe(0);
  });

  it("closes once the last use has been idle for the whole wait", async () => {
    const seen = await run(
      Effect.scoped(
        Effect.gen(function* () {
          const count = yield* Ref.make(0);
          const idle = yield* makeIdle(
            "90 seconds",
            Ref.update(count, (n) => n + 1)
          );

          yield* idle.hold(Effect.void);
          yield* TestClock.adjust("89 seconds");
          const early = yield* Ref.get(count);
          yield* TestClock.adjust("2 seconds");
          const late = yield* Ref.get(count);
          return [early, late];
        })
      )
    );

    expect(seen).toEqual([0, 1]);
  });

  it("never closes under a use that is still running", async () => {
    const seen = await run(
      Effect.scoped(
        Effect.gen(function* () {
          const count = yield* Ref.make(0);
          const idle = yield* makeIdle(
            "90 seconds",
            Ref.update(count, (n) => n + 1)
          );

          yield* idle.hold(Effect.void);
          yield* TestClock.adjust("60 seconds");
          const long = yield* Effect.forkChild(
            idle.hold(Effect.sleep("5 minutes"))
          );
          yield* TestClock.adjust("4 minutes");
          const during = yield* Ref.get(count);
          yield* TestClock.adjust("1 minute");
          yield* Fiber.join(long);
          yield* TestClock.adjust("89 seconds");
          const before = yield* Ref.get(count);
          yield* TestClock.adjust("1 second");
          const after = yield* Ref.get(count);
          return [during, before, after];
        })
      )
    );

    expect(seen).toEqual([0, 0, 1]);
  });

  it("restarts the wait on every touch", async () => {
    const seen = await run(
      Effect.scoped(
        Effect.gen(function* () {
          const count = yield* Ref.make(0);
          const idle = yield* makeIdle(
            "90 seconds",
            Ref.update(count, (n) => n + 1)
          );

          yield* idle.touch;
          yield* TestClock.adjust("80 seconds");
          yield* idle.touch;
          yield* TestClock.adjust("80 seconds");
          const first = yield* Ref.get(count);
          yield* TestClock.adjust("10 seconds");
          return [first, yield* Ref.get(count)];
        })
      )
    );

    expect(seen).toEqual([0, 1]);
  });
});
