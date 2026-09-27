import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import type { AcpPeer, AcpSpawn } from "./connection";
import { makeAcpPool } from "./pool";

interface Spawned {
  exit: () => void;
  killed: number;
  options: AcpSpawn;
}

function spawner() {
  const spawned: Spawned[] = [];

  const spawn = (options: AcpSpawn): AcpPeer => {
    const exited = Promise.withResolvers<void>();
    const record: Spawned = {
      exit: () => exited.resolve(),
      killed: 0,
      options,
    };
    spawned.push(record);
    return {
      exited: exited.promise,
      kill: () => {
        record.killed += 1;
        exited.resolve();
      },
      notify: () => undefined,
      request: () => Promise.resolve(undefined as never),
    };
  };

  return { spawn, spawned };
}

const shape = (args: readonly string[] = ["--acp"]) => ({
  args,
  command: "copilot",
  cwd: "/videos/promo",
  log: () => undefined,
});

const run = <A>(effect: Effect.Effect<A>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestClock.layer())));

describe("makeAcpPool", () => {
  it("keeps one agent per chat across turns and speaks to the current turn", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);
    const heard: string[] = [];

    const reused = await run(
      Effect.gen(function* () {
        const first = yield* pool.checkout("chat-1", shape(), null);
        first.held.sessionId = "acp-session";
        first.held.bind({
          onNotification: () => heard.push("first"),
          onRequest: () => Promise.resolve(null),
        });
        yield* pool.checkin("chat-1", first.held);

        const second = yield* pool.checkout("chat-1", shape(), "acp-session");
        second.held.bind({
          onNotification: () => heard.push("second"),
          onRequest: () => Promise.resolve(null),
        });
        made.spawned[0]?.options.onNotification("session/update", {});
        return second;
      })
    );

    expect(made.spawned).toHaveLength(1);
    expect(reused.fresh).toBe(false);
    expect(heard).toEqual(["second"]);
  });

  it("refuses what the agent asks between turns", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    await run(
      Effect.gen(function* () {
        const first = yield* pool.checkout("chat-1", shape(), null);
        first.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", first.held);
      })
    );

    const asked = made.spawned[0]?.options.onRequest(
      "session/request_permission",
      {}
    );

    await expect(asked).rejects.toThrow("no turn is running");
  });

  it("starts a new agent when the model, the folder or the session changed", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    await run(
      Effect.gen(function* () {
        const first = yield* pool.checkout("chat-1", shape(), null);
        first.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", first.held);

        const other = yield* pool.checkout(
          "chat-1",
          shape(["--acp", "--model", "gpt-5"]),
          "acp-session"
        );
        other.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", other.held);

        yield* pool.checkout(
          "chat-1",
          shape(["--acp", "--model", "gpt-5"]),
          "elsewhere"
        );
      })
    );

    expect(made.spawned).toHaveLength(3);
    expect(made.spawned[0]?.killed).toBe(1);
    expect(made.spawned[1]?.killed).toBe(1);
    expect(made.spawned[2]?.killed).toBe(0);
  });

  it("never hands out an agent a stopping turn still holds, and lets that turn discard only its own", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    const [stopping, next] = await run(
      Effect.gen(function* () {
        const warm = yield* pool.checkout("chat-1", shape(), null);
        warm.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", warm.held);

        const first = yield* pool.checkout("chat-1", shape(), "acp-session");
        const second = yield* pool.checkout("chat-1", shape(), "acp-session");
        yield* pool.discard("chat-1", first.held);
        return [first, second] as const;
      })
    );

    expect(stopping.fresh).toBe(false);
    expect(next.fresh).toBe(true);
    expect(next.held).not.toBe(stopping.held);
    expect(made.spawned).toHaveLength(2);
    expect(made.spawned[0]?.killed).toBe(1);
    expect(made.spawned[1]?.killed).toBe(0);
    expect(pool.size()).toBe(1);
  });

  it("does not kill the running turn's agent when a turn with other settings starts beside it", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    await run(
      Effect.gen(function* () {
        const first = yield* pool.checkout("chat-1", shape(), null);
        const second = yield* pool.checkout(
          "chat-1",
          shape(["--acp", "--model", "gpt-5"]),
          null
        );
        expect(made.spawned[0]?.killed).toBe(0);

        yield* pool.discard("chat-1", first.held);
        expect(made.spawned[1]?.killed).toBe(0);

        second.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", second.held);
      })
    );

    expect(made.spawned[0]?.killed).toBe(1);
    expect(made.spawned[1]?.killed).toBe(0);
    expect(pool.size()).toBe(1);
  });

  it("lets an agent go after five idle minutes, and never under a turn", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    const seen = await run(
      Effect.gen(function* () {
        const first = yield* pool.checkout("chat-1", shape(), null);
        first.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", first.held);
        yield* TestClock.adjust("4 minutes");
        yield* pool.checkout("chat-1", shape(), "acp-session");
        yield* TestClock.adjust("10 minutes");
        const during = made.spawned[0]?.killed ?? -1;
        yield* pool.checkin("chat-1", first.held);
        yield* TestClock.adjust("5 minutes");
        return [during, made.spawned[0]?.killed ?? -1, pool.size()];
      })
    );

    expect(seen).toEqual([0, 1, 0]);
  });

  it("closes a chat's agent when the chat is deleted, and all of them at quit", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    await run(
      Effect.gen(function* () {
        yield* pool.checkout("chat-1", shape(), null);
        yield* pool.checkout("chat-2", shape(), null);
        yield* pool.dispose("chat-1");
        const left = pool.size();
        yield* pool.disposeAll;
        expect(left).toBe(1);
      })
    );

    expect(made.spawned.map((one) => one.killed)).toEqual([1, 1]);
    expect(pool.size()).toBe(0);
  });

  it("forgets an agent that exited on its own", async () => {
    const made = spawner();
    const pool = makeAcpPool(made.spawn);

    const second = await run(
      Effect.gen(function* () {
        const first = yield* pool.checkout("chat-1", shape(), null);
        first.held.sessionId = "acp-session";
        yield* pool.checkin("chat-1", first.held);
        made.spawned[0]?.exit();
        yield* Effect.promise(() => Promise.resolve());
        return yield* pool.checkout("chat-1", shape(), "acp-session");
      })
    );

    expect(second.fresh).toBe(true);
    expect(made.spawned).toHaveLength(2);
  });
});
