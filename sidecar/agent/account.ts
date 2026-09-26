import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Clock, Deferred, Effect, Exit, Schema } from "effect";
import { DATA_DIR_ENV, EnvironmentCheck } from "@/shared/ipc";
import { AgentProvider } from "@/shared/providers";
import { adapterFor } from "./registry";

export const ACCOUNT_TTL_MS = 24 * 60 * 60 * 1000;

export interface AccountCache {
  readonly clear: Effect.Effect<void>;
  readonly row: (
    provider: AgentProvider,
    cwd: string
  ) => Effect.Effect<EnvironmentCheck>;
}

type Probe = (
  provider: AgentProvider,
  cwd: string
) => Effect.Effect<EnvironmentCheck>;

const probeAdapter: Probe = (provider, cwd) =>
  adapterFor(provider).account(cwd);

const Kept = Schema.Struct({
  at: Schema.Number,
  provider: AgentProvider,
  row: EnvironmentCheck,
});

type Kept = (typeof Kept)["Type"];

const decodeKept = Schema.decodeExit(Schema.fromJsonString(Schema.Array(Kept)));

export interface AccountStore {
  readonly load: () => readonly Kept[];
  readonly save: (rows: readonly Kept[]) => Effect.Effect<void>;
}

function accountFile(): string | null {
  const dir = process.env[DATA_DIR_ENV];
  return dir === undefined ? null : path.join(dir, "accounts.json");
}

const NOWHERE: AccountStore = { load: () => [], save: () => Effect.void };

export function fileStore(file: string | null = accountFile()): AccountStore {
  if (file === null) {
    return NOWHERE;
  }
  return {
    load: () => {
      try {
        const decoded = decodeKept(readFileSync(file, "utf8"));
        return Exit.isSuccess(decoded) ? decoded.value : [];
      } catch {
        return [];
      }
    },
    save: (rows) =>
      Effect.tryPromise(async () => {
        const partial = `${file}.${process.pid}.tmp`;
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(partial, JSON.stringify(rows));
        await rename(partial, file);
      }).pipe(Effect.ignore),
  };
}

export function makeAccountCache(
  probe: Probe = probeAdapter,
  store: AccountStore = fileStore()
): Effect.Effect<AccountCache> {
  return Effect.sync(() => {
    const fresh = new Map<AgentProvider, EnvironmentCheck>();
    const kept = new Map<AgentProvider, Kept>(
      store.load().map((one) => [one.provider, one])
    );
    const running = new Map<
      AgentProvider,
      Deferred.Deferred<EnvironmentCheck>
    >();
    let generation = 0;

    const settle = (
      provider: AgentProvider,
      started: number,
      exit: Exit.Exit<EnvironmentCheck>
    ) =>
      Effect.gen(function* () {
        if (started !== generation) {
          return;
        }
        running.delete(provider);
        if (Exit.isFailure(exit)) {
          return;
        }
        const row = exit.value;
        fresh.set(provider, row);
        if (row.state === "ok") {
          kept.set(provider, {
            at: yield* Clock.currentTimeMillis,
            provider,
            row,
          });
        } else {
          kept.delete(provider);
        }
        yield* store.save([...kept.values()]);
      });

    const probing = (provider: AgentProvider, cwd: string) =>
      Effect.suspend(() => {
        const found = running.get(provider);
        if (found !== undefined) {
          return Effect.succeed(found);
        }
        const deferred = Deferred.makeUnsafe<EnvironmentCheck>();
        const started = generation;
        running.set(provider, deferred);
        return probe(provider, cwd).pipe(
          Effect.exit,
          Effect.tap((exit) => settle(provider, started, exit)),
          Effect.flatMap((exit) => Deferred.done(deferred, exit)),
          Effect.forkDetach,
          Effect.as(deferred)
        );
      });

    return {
      clear: Effect.sync(() => {
        generation += 1;
        fresh.clear();
        kept.clear();
        running.clear();
      }),
      row: (provider, cwd) =>
        Effect.suspend(() => {
          const known = fresh.get(provider);
          if (known !== undefined) {
            return Effect.succeed(known);
          }
          return Effect.flatMap(probing(provider, cwd), (deferred) =>
            Effect.flatMap(Clock.currentTimeMillis, (now) => {
              const last = kept.get(provider);
              return last !== undefined && now - last.at < ACCOUNT_TTL_MS
                ? Effect.succeed(last.row)
                : Deferred.await(deferred);
            })
          );
        }),
    } satisfies AccountCache;
  });
}
