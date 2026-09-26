import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import type { EnvironmentCheck } from "@/shared/ipc";
import {
  ACCOUNT_TTL_MS,
  type AccountStore,
  fileStore,
  makeAccountCache,
} from "./account";

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect);

const made: string[] = [];

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

function row(detail: string, state: "ok" | "failed" = "ok"): EnvironmentCheck {
  return {
    detail,
    fix: null,
    id: "claude",
    state,
    title: "Claude Code is logged in",
  };
}

function memory(initial: Parameters<AccountStore["save"]>[0] = []) {
  const state = { rows: [...initial], saves: 0 };
  const store: AccountStore = {
    load: () => state.rows,
    save: (rows) =>
      Effect.sync(() => {
        state.rows = [...rows];
        state.saves += 1;
      }),
  };
  return { state, store };
}

describe("makeAccountCache", () => {
  it("probes once per provider and serves the cached row after", async () => {
    let asked = 0;
    const cache = await run(
      makeAccountCache(() => {
        asked += 1;
        return Effect.succeed(row(`probe ${asked}`));
      }, memory().store)
    );

    expect(await run(cache.row("claude", "/videos/promo"))).toEqual(
      row("probe 1")
    );
    expect(await run(cache.row("claude", "/videos/promo"))).toEqual(
      row("probe 1")
    );
    expect(asked).toBe(1);
  });

  it("probes again after a clear, which is what Recheck means", async () => {
    let asked = 0;
    const cache = await run(
      makeAccountCache(() => {
        asked += 1;
        return Effect.succeed(row(`probe ${asked}`));
      }, memory().store)
    );

    await run(cache.row("claude", "/videos/promo"));
    await run(cache.clear);

    expect(await run(cache.row("claude", "/videos/promo"))).toEqual(
      row("probe 2")
    );
    expect(asked).toBe(2);
  });

  it("shares one probe between callers who ask while it is running", async () => {
    let asked = 0;
    const gate = Effect.runSync(Deferred.make<void>());
    const cache = await run(
      makeAccountCache(() => {
        asked += 1;
        return Effect.as(Deferred.await(gate), row("shared"));
      }, memory().store)
    );

    const first = Effect.runFork(cache.row("claude", "/a"));
    const second = Effect.runFork(cache.row("claude", "/b"));
    await run(Deferred.succeed(gate, undefined));

    expect(await run(Fiber.join(first))).toEqual(row("shared"));
    expect(await run(Fiber.join(second))).toEqual(row("shared"));
    expect(asked).toBe(1);
  });

  it("keeps probing for everyone else when one caller is interrupted", async () => {
    let asked = 0;
    const gate = Effect.runSync(Deferred.make<void>());
    const cache = await run(
      makeAccountCache(() => {
        asked += 1;
        return Effect.as(Deferred.await(gate), row("survived"));
      }, memory().store)
    );

    const impatient = Effect.runFork(cache.row("claude", "/a"));
    await run(Fiber.interrupt(impatient));
    const patient = Effect.runFork(cache.row("claude", "/a"));
    await run(Deferred.succeed(gate, undefined));

    expect(await run(Fiber.join(patient))).toEqual(row("survived"));
    expect(await run(cache.row("claude", "/a"))).toEqual(row("survived"));
    expect(asked).toBe(1);
  });

  it("paints from the last good answer on a cold start and refreshes behind it", async () => {
    const { state, store } = memory([
      { at: 0, provider: "claude", row: row("from last run") },
    ]);
    const gate = Effect.runSync(Deferred.make<void>());
    let asked = 0;

    const answered = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.adjust(ACCOUNT_TTL_MS - 1);
        const cache = yield* makeAccountCache(() => {
          asked += 1;
          return Effect.as(Deferred.await(gate), row("fresh"));
        }, store);
        const first = yield* cache.row("claude", "/a");
        yield* Deferred.succeed(gate, undefined);
        yield* Effect.yieldNow;
        yield* Effect.sleep(0);
        const second = yield* cache.row("claude", "/a");
        return [first, second];
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(answered).toEqual([row("from last run"), row("fresh")]);
    expect(asked).toBe(1);
    expect(state.rows.map((one) => one.row)).toEqual([row("fresh")]);
  });

  it("waits for a real probe once the last answer is too old", async () => {
    const { store } = memory([
      { at: 0, provider: "claude", row: row("stale") },
    ]);

    const answered = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.adjust(ACCOUNT_TTL_MS + 1);
        const cache = yield* makeAccountCache(
          () => Effect.succeed(row("fresh")),
          store
        );
        return yield* cache.row("claude", "/a");
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(answered).toEqual(row("fresh"));
  });

  it("never paints a sign-in the last probe contradicted", async () => {
    const { state, store } = memory([
      { at: 0, provider: "claude", row: row("was fine") },
    ]);
    const cache = await run(
      makeAccountCache(() => Effect.succeed(row("signed out", "failed")), store)
    );

    await run(cache.clear);
    await run(cache.row("claude", "/a"));

    expect(state.rows).toEqual([]);
  });
});

describe("fileStore", () => {
  it("keeps what it saved across a restart and ignores a file it cannot read", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "remocn-accounts-"));
    made.push(dir);
    const file = path.join(dir, "accounts.json");
    const kept = [{ at: 12, provider: "codex" as const, row: row("saved") }];

    await run(fileStore(file).save(kept));
    expect(fileStore(file).load()).toEqual(kept);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(kept);

    writeFileSync(file, "{not json");
    expect(fileStore(file).load()).toEqual([]);
    expect(fileStore(null).load()).toEqual([]);
  });
});
