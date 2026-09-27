import { type Duration, Effect, Fiber } from "effect";
import { type AcpPeer, type AcpSpawn, spawnAcp } from "./connection";

export const ACP_IDLE: Duration.Input = "5 minutes";

type Handlers = Pick<AcpSpawn, "onNotification" | "onRequest">;

export interface SessionModes {
  availableModes?: readonly { id?: string; name?: string }[];
  currentModeId?: string;
}

export interface Held {
  readonly bind: (handlers: Handlers) => void;
  modes: SessionModes | undefined;
  readonly peer: AcpPeer;
  sessionId: string | null;
}

export interface Checkout {
  readonly fresh: boolean;
  readonly held: Held;
}

interface Pooled {
  alive: boolean;
  busy: boolean;
  handlers: Handlers;
  readonly held: Held;
  readonly shape: string;
  timer: Fiber.Fiber<void> | null;
}

const IDLE_HANDLERS: Handlers = {
  onNotification: () => undefined,
  onRequest: (method) =>
    Promise.reject(new Error(`no turn is running to answer ${method}`)),
};

export type Spawner = (options: AcpSpawn) => AcpPeer;

export function makeAcpPool(spawner: Spawner = spawnAcp) {
  const pool = new Map<string, Pooled>();

  const stopTimer = (pooled: Pooled) =>
    Effect.suspend(() => {
      const { timer } = pooled;
      pooled.timer = null;
      return timer === null ? Effect.void : Fiber.interrupt(timer);
    });

  const dispose = (chat: string) =>
    Effect.suspend(() => {
      const pooled = pool.get(chat);
      if (pooled === undefined) {
        return Effect.void;
      }
      pool.delete(chat);
      pooled.alive = false;
      return Effect.andThen(
        stopTimer(pooled),
        Effect.sync(() => pooled.held.peer.kill())
      );
    });

  const spawnFor = (
    chat: string,
    options: Omit<AcpSpawn, keyof Handlers>,
    shape: string
  ): Pooled => {
    const pooled: Pooled = {
      alive: true,
      busy: true,
      handlers: IDLE_HANDLERS,
      held: {
        bind: (handlers) => {
          pooled.handlers = handlers;
        },
        modes: undefined,
        peer: spawner({
          ...options,
          onNotification: (method, params) =>
            pooled.handlers.onNotification(method, params),
          onRequest: (method, params) =>
            pooled.handlers.onRequest(method, params),
        }),
        sessionId: null,
      },
      shape,
      timer: null,
    };
    pooled.held.peer.exited.then(() => {
      pooled.alive = false;
      if (pool.get(chat) === pooled) {
        pool.delete(chat);
      }
    });
    pool.set(chat, pooled);
    return pooled;
  };

  return {
    checkin: (chat: string, held: Held) =>
      Effect.suspend(() => {
        const pooled = pool.get(chat);
        if (pooled === undefined || pooled.held !== held || !pooled.alive) {
          return Effect.sync(() => held.peer.kill());
        }
        pooled.handlers = IDLE_HANDLERS;
        pooled.busy = false;
        return Effect.andThen(
          Effect.forkDetach(
            Effect.sleep(ACP_IDLE).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  pooled.timer = null;
                })
              ),
              Effect.andThen(dispose(chat))
            )
          ),
          (timer) =>
            Effect.sync(() => {
              pooled.timer = timer;
            })
        );
      }),

    checkout: (
      chat: string,
      options: Omit<AcpSpawn, keyof Handlers>,
      sessionId: string | null
    ): Effect.Effect<Checkout> =>
      Effect.gen(function* () {
        const shape = JSON.stringify([
          options.command,
          options.args,
          options.cwd,
        ]);
        const pooled = pool.get(chat);

        if (
          pooled?.alive &&
          !pooled.busy &&
          pooled.shape === shape &&
          sessionId !== null &&
          pooled.held.sessionId === sessionId
        ) {
          yield* stopTimer(pooled);
          pooled.busy = true;
          return { fresh: false, held: pooled.held } satisfies Checkout;
        }

        if (pooled !== undefined && !pooled.busy) {
          yield* dispose(chat);
        }
        return {
          fresh: true,
          held: spawnFor(chat, options, shape).held,
        } satisfies Checkout;
      }),

    discard: (chat: string, held: Held) =>
      Effect.andThen(
        pool.get(chat)?.held === held ? dispose(chat) : Effect.void,
        Effect.sync(() => held.peer.kill())
      ),

    dispose,

    disposeAll: Effect.suspend(() =>
      Effect.forEach([...pool.keys()], dispose, { discard: true })
    ),

    size: () => pool.size,
  };
}

export type AcpPool = ReturnType<typeof makeAcpPool>;

export const acpPool: AcpPool = makeAcpPool();
