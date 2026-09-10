import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { installCommand, pmOf } from "../package-manager";
import type { WarmInternals } from "./session";

export class PreviewError extends Data.TaggedError("PreviewError")<{
  message: string;
}> {}

export const RENDER_PACKAGES = ["@remotion/bundler", "@remotion/renderer"];

export const CONFIG_FILES = ["remotion.config.ts", "remotion.config.js"];

export const ENTRY_CANDIDATES = [
  "src/index.ts",
  "src/index.tsx",
  "src/index.js",
  "src/index.mjs",
  "remotion/index.tsx",
  "remotion/index.ts",
  "remotion/index.js",
  "remotion/index.mjs",
  "src/remotion/index.tsx",
  "src/remotion/index.ts",
  "src/remotion/index.js",
  "src/remotion/index.mjs",
];

export type WebpackConfig = Record<string, unknown>;

export type WebpackOverride = (
  config: WebpackConfig
) => WebpackConfig | Promise<WebpackConfig>;

const missing = (root: string, specifier: string) =>
  new PreviewError({
    message: `${specifier} is not installed in ${root} — run ${installCommand(pmOf(root).manager)} in the project folder`,
  });

export function resolveFrom(
  root: string,
  specifier: string
): Effect.Effect<string, PreviewError> {
  return Effect.try({
    catch: () => missing(root, specifier),
    try: () =>
      createRequire(path.join(root, "package.json")).resolve(specifier),
  });
}

export function importFrom<A>(
  root: string,
  specifier: string
): Effect.Effect<A, PreviewError> {
  return Effect.flatMap(resolveFrom(root, specifier), (resolved) =>
    importFile<A>(resolved)
  );
}

/**
 * A package resolved through another package's own folder, for a dependency an
 * installer may or may not have hoisted to the project root.
 */
export function resolveNested<A>(
  root: string,
  through: string,
  specifier: string
): Effect.Effect<A, PreviewError> {
  return Effect.flatMap(
    resolveFrom(root, `${through}/package.json`),
    (manifest) =>
      Effect.flatMap(
        Effect.try({
          catch: () => missing(root, specifier),
          try: () => createRequire(manifest).resolve(specifier),
        }),
        (resolved) => importFile<A>(resolved)
      )
  );
}

export function importFile<A>(file: string): Effect.Effect<A, PreviewError> {
  return Effect.tryPromise({
    catch: (cause) => new PreviewError({ message: errorMessage(cause) }),
    try: () => import(pathToFileURL(file).href) as Promise<A>,
  });
}

export function packageVersionOf(
  root: string,
  specifier: string
): Effect.Effect<string, PreviewError> {
  return Effect.flatMap(
    resolveFrom(root, `${specifier}/package.json`).pipe(
      Effect.mapError(() => missing(root, specifier))
    ),
    (manifest) =>
      Effect.tryPromise({
        catch: (cause) =>
          new PreviewError({
            message: `could not read ${manifest}: ${errorMessage(cause)}`,
          }),
        try: async () => {
          const source = await readFile(manifest, "utf8");
          return String(JSON.parse(source).version ?? "");
        },
      })
  );
}

export function agreedVersionIn(
  root: string
): Effect.Effect<string, PreviewError> {
  return Effect.gen(function* () {
    const remotion = yield* packageVersionOf(root, "remotion");

    const installed = yield* Effect.forEach(RENDER_PACKAGES, (specifier) =>
      Effect.map(packageVersionOf(root, specifier), (version) => ({
        specifier,
        version,
      }))
    );

    const apart = installed.filter(({ version }) => version !== remotion);

    if (apart.length > 0) {
      const listed = apart
        .map(({ specifier, version }) => `${specifier} is ${version}`)
        .join(" and ");

      return yield* Effect.fail(
        new PreviewError({
          message: `remotion is ${remotion} in this project but ${listed}. An export renders with the project's own packages, so mismatched ones would not match the preview — run ${installCommand(pmOf(root).manager)} in the project folder to bring them in step.`,
        })
      );
    }

    return remotion;
  });
}

export function remotionRootOf(folder: string): string {
  const nested = nestedRemotionRoots(folder);
  if (nested.length === 1) {
    return nested[0];
  }
  if (nested.length > 1) {
    throw new PreviewError({
      message:
        "Multiple Remotion projects found. Open the specific Remotion project folder.",
    });
  }
  let dir = folder;

  for (;;) {
    if (existsSync(path.join(dir, "package.json"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return folder;
    }

    dir = parent;
  }
}

export function configFile(root: string): string | null {
  const found = CONFIG_FILES.map((name) => path.join(root, name)).find((file) =>
    existsSync(file)
  );
  return found ?? null;
}

export function webpackOverrideOf(
  root: string
): Effect.Effect<WebpackOverride, PreviewError> {
  return Effect.gen(function* () {
    yield* loadConfig(root);

    const config = yield* importFrom<{
      ConfigInternals: { getWebpackOverrideFn: () => WebpackOverride };
    }>(root, "@remotion/cli/config");

    return config.ConfigInternals.getWebpackOverrideFn();
  });
}

function loadConfig(root: string): Effect.Effect<void, PreviewError> {
  const file = configFile(root);
  return file === null ? Effect.void : Effect.asVoid(importFile(file));
}

export interface RenderOptions {
  browserExecutable?: string | null;
  chromeMode: string | null;
  chromiumOptions: Record<string, unknown>;
  timeoutInMilliseconds: number | null;
}

export type Measured = Record<string, unknown> & {
  height: number;
  width: number;
};

const WARM_MODULES = {
  evaluate: ["puppeteer-evaluate", "puppeteerEvaluateWithCatch"],
  handleJavascriptException: [
    "error-handling/handle-javascript-exception",
    "handleJavascriptException",
  ],
  // The offthread-video proxy the warm page's `proxyPort` points at. Without
  // it there is no port to give, and a page told `0` cannot play a video at
  // all — so a Remotion that has moved this export falls back to the slower
  // per-capture `renderStill`, which prepares its own.
  prepareServer: ["prepare-server", "prepareServer"],
  seekToFrame: ["seek-to-frame", "seekToFrame"],
  setPropsAndEnv: ["set-props-and-env", "setPropsAndEnv"],
  takeFrame: ["take-frame", "takeFrame"],
} as const;

export function warmInternalsOf(
  root: string
): Effect.Effect<WarmInternals | null, PreviewError> {
  return Effect.gen(function* () {
    const manifest = yield* resolveFrom(
      root,
      "@remotion/renderer/package.json"
    );
    const dist = path.join(path.dirname(manifest), "dist");

    const found: Record<string, unknown> = {};

    for (const [key, [file, name]] of Object.entries(WARM_MODULES)) {
      const module = yield* importFile<Record<string, unknown>>(
        path.join(dist, `${file}.js`)
      ).pipe(Effect.catch(() => Effect.succeed({})));

      const exported = exportOf(module, name);

      if (typeof exported !== "function") {
        yield* Effect.void;
        return null;
      }

      found[key] = exported;
    }

    const renderer = yield* importFrom<Record<string, unknown>>(
      root,
      "@remotion/renderer"
    );
    const openBrowser = exportOf(renderer, "openBrowser");

    const noReact = yield* importFrom<Record<string, unknown>>(
      root,
      "remotion/no-react"
    );
    const internals = exportOf(noReact, "NoReactInternals") as
      | {
          serializeJSONWithSpecialTypes: (input: {
            data: unknown;
            indent: undefined;
            staticBase: null;
          }) => { serializedString: string };
        }
      | undefined;

    if (
      typeof openBrowser !== "function" ||
      typeof internals?.serializeJSONWithSpecialTypes !== "function"
    ) {
      return null;
    }

    return {
      ...(found as unknown as Omit<WarmInternals, "openBrowser" | "serialize">),
      openBrowser: openBrowser as WarmInternals["openBrowser"],
      serialize: (data: unknown) =>
        internals.serializeJSONWithSpecialTypes({
          data,
          indent: undefined,
          staticBase: null,
        }).serializedString,
    };
  });
}

function exportOf(module: Record<string, unknown>, name: string): unknown {
  const found = module as { default?: Record<string, unknown> };
  return module[name] ?? found.default?.[name];
}

export function entryPointOf(
  root: string
): Effect.Effect<string, PreviewError> {
  return fromRemotion(root).pipe(
    Effect.catch(() => Effect.succeed(fromCandidates(root))),
    Effect.flatMap((file) =>
      file === null
        ? Effect.fail(
            new PreviewError({
              message: `no Remotion entry point in ${root} — expected one of ${ENTRY_CANDIDATES.join(", ")}, or setEntryPoint() in remotion.config.ts`,
            })
          )
        : Effect.succeed(file)
    )
  );
}

function fromRemotion(
  root: string
): Effect.Effect<string | null, PreviewError> {
  return Effect.gen(function* () {
    const manifest = yield* resolveFrom(root, "@remotion/cli/package.json");
    const module = yield* importFile<{
      findEntryPoint: (input: {
        allowDirectory: boolean;
        args: string[];
        logLevel: string;
        remotionRoot: string;
      }) => { file: string | null };
    }>(path.join(path.dirname(manifest), "dist/entry-point.js"));

    return module.findEntryPoint({
      allowDirectory: false,
      args: [],
      logLevel: "error",
      remotionRoot: root,
    }).file;
  });
}

function fromCandidates(root: string): string | null {
  const found = ENTRY_CANDIDATES.map((candidate) =>
    path.join(root, candidate)
  ).find((file) => existsSync(file));
  return found ?? null;
}

// A unique nested config identifies an imported/monorepo Remotion app. Never
// follow symlinks or scan dependency trees; ambiguous roots require selection.
function nestedRemotionRoots(folder: string, depth = 0): string[] {
  if (CONFIG_FILES.some((name) => existsSync(path.join(folder, name)))) {
    return [folder];
  }
  if (depth >= 3 || !existsSync(folder)) {
    return [];
  }
  return readdirSync(folder, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "node_modules" &&
        !entry.name.startsWith(".") &&
        entry.name !== "public" &&
        entry.name !== "out"
    )
    .flatMap((entry) =>
      nestedRemotionRoots(path.join(folder, entry.name), depth + 1)
    );
}
