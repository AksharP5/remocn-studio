import { afterAll, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit, Fiber, FiberMap, Ref, Semaphore } from "effect";
import { TestClock } from "effect/testing";
import { BUILDING, type BuildState, compiled, started } from "./build-state";
import { decodeHostReply } from "./protocol";

const original = process.stdout.write;
const wire = mock((_chunk: string) => true);
process.stdout.write = wire as unknown as typeof process.stdout.write;

const { obey, settledBuild, STILL_COMPILING, unchangedSince } = await import(
  "./host"
);

process.stdout.write = original;

type Booted = Parameters<typeof obey>[0];

const root = mkdtempSync(path.join(tmpdir(), "remocn-host-commands-"));

afterAll(() => {
  rmSync(root, { force: true, recursive: true });
});

function replies() {
  return wire.mock.calls.flatMap(([chunk]) => {
    const decoded = decodeHostReply(String(chunk).trim());
    return Exit.isSuccess(decoded) ? [decoded.value] : [];
  });
}

function waitFor(done: () => boolean): Effect.Effect<void> {
  return Effect.suspend(() =>
    done() ? Effect.void : Effect.andThen(Effect.sleep(5), waitFor(done))
  );
}

const compiler = (wake: Effect.Effect<void> = Effect.void) => ({
  wake,
  watching: {
    close: () => undefined,
    resume: () => undefined,
    suspend: () => undefined,
  },
});

describe("the command loop", () => {
  it("answers a write and a status while a still waits on a build", async () => {
    wire.mockClear();

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const booted = {
            build: Ref.makeUnsafe<BuildState>(BUILDING),
            compiler: compiler(),
            idle: { hold: (effect: unknown) => effect, touch: Effect.void },
            lane: Semaphore.makeUnsafe(1),
            requests: yield* FiberMap.make<string>(),
            root,
            running: yield* FiberMap.make<string>(),
          } as unknown as Booted;

          yield* obey(
            booted,
            JSON.stringify({
              composition: "Main",
              frame: 3,
              id: "s",
              type: "still",
            })
          );
          yield* obey(
            booted,
            JSON.stringify({
              edits: [],
              id: "w",
              partial: false,
              type: "write",
            })
          );
          yield* obey(
            booted,
            JSON.stringify({
              id: "t",
              targets: [],
              type: "status",
              video: {
                durationInFrames: 30,
                fps: 30,
                height: 720,
                width: 1280,
              },
            })
          );

          const ids = replies().map((reply) => reply.id);
          expect(ids).toContain("w");
          expect(ids).toContain("t");
          expect(ids).not.toContain("s");
          expect(yield* FiberMap.size(booted.requests)).toBe(1);

          yield* obey(booted, JSON.stringify({ id: "s", type: "cancel" }));

          expect(yield* FiberMap.size(booted.requests)).toBe(0);
          expect(replies().map((reply) => reply.id)).not.toContain("s");
        })
      )
    );
  });

  it("runs stills one at a time, in the order they came", async () => {
    wire.mockClear();

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const build = Ref.makeUnsafe<BuildState>(BUILDING);
          const woken: string[] = [];
          const booted = {
            build,
            compiler: compiler(Effect.sync(() => woken.push("wake"))),
            idle: { hold: (effect: unknown) => effect, touch: Effect.void },
            lane: Semaphore.makeUnsafe(1),
            requests: yield* FiberMap.make<string>(),
            root,
            running: yield* FiberMap.make<string>(),
          } as unknown as Booted;

          yield* obey(
            booted,
            JSON.stringify({
              composition: "Main",
              frame: 0,
              id: "a",
              type: "still",
            })
          );
          yield* obey(
            booted,
            JSON.stringify({
              composition: "Main",
              frame: 1,
              id: "b",
              type: "still",
            })
          );
          yield* waitFor(() => woken.length > 0);

          expect(woken).toHaveLength(1);

          yield* obey(booted, JSON.stringify({ id: "a", type: "cancel" }));
          yield* waitFor(() => woken.length > 1);

          expect(woken).toHaveLength(2);

          yield* obey(booted, JSON.stringify({ id: "b", type: "cancel" }));
        })
      )
    );
  });
});

const booted = (state: BuildState) => ({
  build: Ref.makeUnsafe(state),
  compiler: compiler(),
});

const failed = (effect: Effect.Effect<unknown, { message: string }>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.flip,
      Effect.map((error) => error.message)
    )
  );

describe("a settled build", () => {
  it("waits out a rebuild rather than taking the build before it", async () => {
    const settled = compiled(BUILDING, { ok: true });
    const held = booted(started(settled));
    const after = compiled(started(settled), { ok: true });

    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const waiting = yield* Effect.forkChild(settledBuild(held));
        yield* TestClock.adjust("40 seconds");
        yield* Ref.set(held.build, after);
        yield* TestClock.adjust("1 second");
        return yield* Fiber.join(waiting);
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(state).toBe(after);
  });

  it("gives up on a rebuild that never ends with a sentence, not the old build", async () => {
    const settled = compiled(BUILDING, { ok: true });
    const held = booted(started(settled));

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const waiting = yield* Effect.forkChild(
          Effect.flip(settledBuild(held))
        );
        yield* TestClock.adjust("181 seconds");
        return yield* Fiber.join(waiting);
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(error.message).toBe(STILL_COMPILING);
  });

  it("refuses a pinned copy when a compile ran while it was taken", async () => {
    const settled = compiled(BUILDING, { ok: true });
    const build = Ref.makeUnsafe(settled);

    await Effect.runPromise(unchangedSince(build, settled));

    Effect.runSync(Ref.update(build, started));

    expect(await failed(unchangedSince(build, settled))).toBe(STILL_COMPILING);
  });
});
