import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  CONFIG_HOST_FLAG,
  CONFIG_ROOT_ENV,
  type ResolvedConfig,
  readRenderConfig,
} from "./config";
import { configFile, PreviewError } from "./project";

const RESOLVE_TIMEOUT_MS = 60_000;

const TALKATIVE = ["debug", "dir", "info", "log", "table"] as const;

type Answer =
  | { config: ResolvedConfig; ok: true }
  | { message: string; ok: false };

export const runConfigHost: Effect.Effect<void> = Effect.gen(function* () {
  const answer = process.stdout.write.bind(process.stdout);

  yield* Effect.sync(() => {
    process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) =>
      (process.stderr.write as (...args: unknown[]) => boolean)(
        chunk,
        ...rest
      )) as typeof process.stdout.write;

    const onto = console.error.bind(console);

    for (const name of TALKATIVE) {
      (console as unknown as Record<string, unknown>)[name] = onto;
    }
  });

  const root = process.env[CONFIG_ROOT_ENV] ?? process.cwd();

  const result: Answer = yield* readRenderConfig(root).pipe(
    Effect.map((config) => ({ config, ok: true }) as const),
    Effect.catch((error) =>
      Effect.succeed({ message: error.message, ok: false } as const)
    )
  );

  yield* Effect.sync(() => {
    answer(`${JSON.stringify(result)}\n`);
  });
});

export function resolveRenderConfig(
  root: string
): Effect.Effect<ResolvedConfig, PreviewError> {
  return Effect.callback<string, PreviewError>((resume) => {
    const child = spawn(process.execPath, [scriptPath(), CONFIG_HOST_FLAG], {
      cwd: root,
      env: { ...process.env, [CONFIG_ROOT_ENV]: root },
      stdio: ["ignore", "pipe", "inherit"],
    });

    let out = "";
    let settled = false;

    const settle = (outcome: Effect.Effect<string, PreviewError>) => {
      if (settled) {
        return;
      }
      settled = true;
      resume(outcome);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString("utf8");
    });

    child.on("error", (cause) => {
      settle(
        Effect.fail(
          new PreviewError({
            message: `the studio could not read this project's render settings: ${errorMessage(cause)}`,
          })
        )
      );
    });

    child.on("close", (code) => {
      settle(
        code === 0
          ? Effect.succeed(out)
          : Effect.fail(
              new PreviewError({
                message: `reading this project's render settings exited with code ${code ?? "unknown"}`,
              })
            )
      );
    });

    return Effect.sync(() => {
      child.kill("SIGKILL");
    });
  }).pipe(
    Effect.timeoutOrElse({
      duration: RESOLVE_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new PreviewError({
            message:
              "reading this project's remotion.config.ts took too long — the studio gave up on it",
          })
        ),
    }),
    Effect.flatMap(decode)
  );
}

function decode(out: string): Effect.Effect<ResolvedConfig, PreviewError> {
  const line = out
    .split("\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .at(-1);

  if (line === undefined) {
    return Effect.fail(
      new PreviewError({
        message:
          "reading this project's render settings answered with nothing at all",
      })
    );
  }

  return Effect.try({
    catch: () =>
      new PreviewError({
        message: `this project's render settings came back unreadable: ${line.slice(0, 200)}`,
      }),
    try: () => JSON.parse(line) as Answer,
  }).pipe(
    Effect.flatMap((answer) =>
      answer.ok
        ? Effect.succeed(answer.config)
        : Effect.fail(new PreviewError({ message: answer.message }))
    )
  );
}

export interface ConfigCache {
  readonly forget: () => void;
  readonly read: (
    root: string,
    fresh?: boolean
  ) => Effect.Effect<ResolvedConfig, PreviewError>;
}

export function fingerprintOf(root: string): string {
  const file = configFile(root);

  if (file === null) {
    return "none";
  }

  try {
    const stats = statSync(file);
    return `${file}:${stats.mtimeMs}:${stats.size}`;
  } catch {
    return "none";
  }
}

export function makeConfigCache(
  resolve: (
    root: string
  ) => Effect.Effect<ResolvedConfig, PreviewError> = resolveRenderConfig
): ConfigCache {
  let held: { config: ResolvedConfig; fingerprint: string } | null = null;

  return {
    forget: () => {
      held = null;
    },
    read: (root, fresh = false) =>
      Effect.suspend(() => {
        const fingerprint = fingerprintOf(root);

        if (!fresh && held !== null && held.fingerprint === fingerprint) {
          return Effect.succeed(held.config);
        }

        return resolve(root).pipe(
          Effect.tap((config) =>
            Effect.sync(() => {
              held = { config, fingerprint };
            })
          )
        );
      }),
  };
}

function scriptPath(): string {
  return process.argv[1] ?? "";
}
