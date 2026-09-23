import path from "node:path";
import { Effect } from "effect";
import { PreviewError, type WebpackConfig } from "./project";

export const NATIVE_MANIFEST = "/__remocn/native";

interface Stats {
  hasErrors: () => boolean;
  toJson: (options: Record<string, boolean>) => { errors?: { message?: string }[] };
}

type Watch = { close: (done: () => void) => void };
type Compile = ((config: WebpackConfig) => {
  watch: (options: Record<string, unknown>, done: (error: Error | null, stats?: Stats) => void) => Watch;
}) & {
  DefinePlugin: new (definitions: Record<string, string>) => unknown;
  optimize: { LimitChunkCountPlugin: new (options: { maxChunks: number }) => unknown };
};

export interface NativeBundle {
  directory: string;
  base: string;
  prepare: Effect.Effect<number, PreviewError>;
}

export function nativeBundle(
  compile: Compile,
  configure: Effect.Effect<WebpackConfig, PreviewError>,
  options: { entry: string; projectEntry: string; directory: string; base: string; origin: string; assets: string; rebuilt: () => void }
) {
  return Effect.gen(function* () {
    const directory = options.directory;
    let watcher: Watch | null = null;
    let generation = 0;
    let result: Effect.Effect<number, PreviewError> | null = null;
    const waiting = new Set<(value: Effect.Effect<number, PreviewError>) => void>();

    const start = yield* Effect.cached(Effect.gen(function* () {
      const config = yield* configure;
      yield* Effect.try({
        try: () => {
          const configured = nativeConfig(config, options);
          configured.plugins = [...configured.plugins as unknown[],
            new compile.DefinePlugin({ __REMOCN_NATIVE_ASSETS__: JSON.stringify(options.assets) }),
            new compile.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
          ];
          watcher = compile(configured).watch({}, (error, stats) => {
            if (error || !stats || stats.hasErrors()) {
              const message = error?.message ?? stats?.toJson({ all: false, errors: true }).errors?.[0]?.message;
              process.stderr.write(`Canvas preview: ${message ?? "compilation failed"}\n`);
              result = Effect.fail(new PreviewError({
                message: "The canvas preview could not compile. Fix the project and retry.",
              }));
            } else {
              generation += 1;
              result = Effect.succeed(generation);
            }
            for (const receive of waiting) receive(result);
            waiting.clear();
            options.rebuilt();
          });
        },
        catch: (cause) => new PreviewError({ message: String(cause) }),
      });
    }));

    const prepare = Effect.andThen(start, Effect.callback<number, PreviewError>((resume) => {
      if (result !== null) resume(result);
      else waiting.add(resume);
      return Effect.sync(() => { waiting.delete(resume); });
    }));

    yield* Effect.addFinalizer(() => Effect.callback<void>((resume) => {
      if (watcher === null) resume(Effect.void);
      else watcher.close(() => resume(Effect.void));
    }));

    return { base: options.base, directory, prepare } satisfies NativeBundle;
  });
}

function nativeConfig(
  config: WebpackConfig,
  options: { entry: string; projectEntry: string; directory: string; base: string; origin: string }
): WebpackConfig {
  const resolve = (config.resolve ?? {}) as Record<string, unknown>;
  const alias = (resolve.alias ?? {}) as Record<string, unknown>;
  const modules = (config.module ?? {}) as Record<string, unknown>;
  const directory = path.dirname(options.entry);
  const remotion = alias.remotion;
  if (typeof remotion !== "string") {
    throw new Error("The canvas preview needs the project's Remotion module alias.");
  }
  const plugins = (config.plugins ?? []) as { constructor?: { name?: string } }[];
  if (plugins.some((plugin) => plugin.constructor?.name === "MiniCssExtractPlugin")) {
    throw new Error("The canvas lab needs style-loader. Extracted project styles are not supported yet.");
  }
  return {
    ...config,
    entry: [
      ...((Array.isArray(config.entry) ? config.entry : []) as unknown[]).filter((entry): entry is string => typeof entry === "string" && entry.includes("setup-sequence-stack-traces")),
      options.projectEntry, path.join(directory, "native-entry.tsx"),
    ],
    cache: false,
    experiments: { ...(config.experiments as object), lazyCompilation: false },
    output: {
      ...(config.output as object),
      path: options.directory,
      clean: true,
      publicPath: `${options.origin}${options.base}/`,
      filename: "bundle.js",
      chunkFilename: "[name].[contenthash].js",
      assetModuleFilename: "assets/[contenthash][ext]",
      uniqueName: `remocn-native-${path.basename(options.base)}`,
      chunkLoadingGlobal: `remocn_native_${path.basename(options.base).replaceAll("-", "_")}`,
      library: { name: "__remocnNativeBundle", type: "window" },
      crossOriginLoading: "anonymous",
    },
    plugins: plugins.filter((plugin) => ![
      "ReactFreshWebpackPlugin", "HotModuleReplacementPlugin", "ProgressPlugin",
    ].includes(plugin.constructor?.name ?? "")),
    module: { ...modules, rules: [
      ...nativeRules((modules.rules ?? []) as Rule[], path.join(directory, "native-style.ts")),
      { test: /[\\/]studio-objects-v5[\\/]index\.tsx$/, enforce: "pre", use: [{
        loader: path.join(directory, "managed-loader.cjs"),
        options: { transport: path.join(directory, "managed-transport.ts") },
      }] },
    ] },
    resolve: {
      ...resolve,
      alias: {
        "remotion$": path.join(directory, "native-remotion.ts"),
        "__remocn_project_remotion$": remotion,
        ...alias,
      },
    },
  };
}

interface Rule {
  rules?: Rule[];
  oneOf?: Rule[];
  use?: string | Loader | (string | Loader)[];
  [key: string]: unknown;
}
interface Loader { loader?: string; options?: Record<string, unknown> }

function nativeRules(rules: Rule[], insert: string): Rule[] {
  return rules.map((rule) => {
    if (!rule || typeof rule !== "object") return rule;
    const use = rule.use === undefined ? undefined : (Array.isArray(rule.use) ? rule.use : [rule.use]);
    return {
      ...rule,
      ...(rule.rules ? { rules: nativeRules(rule.rules, insert) } : {}),
      ...(rule.oneOf ? { oneOf: nativeRules(rule.oneOf, insert) } : {}),
      ...(use ? { use: use.filter((item) => !loaderName(item).includes("fast-refresh/loader"))
        .map((item) => {
          if (!loaderName(item).includes("style-loader")) return item;
          const held = typeof item === "string" ? { loader: item } : item;
          return { ...held, options: { ...held.options, esModule: true, insert } };
        }) } : {}),
    };
  });
}

function loaderName(loader: string | Loader): string {
  return (typeof loader === "string" ? loader : loader.loader ?? "").replaceAll("\\", "/");
}
