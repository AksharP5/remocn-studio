import type { WebpackConfig } from "./project";

// The flags handed to Remotion's `webpackConfig`, apart from the values the
// host resolves per project. They live here so the one that costs disk is
// pinned by a test.
//
// `enableCaching` is off. Remotion turns it into a webpack filesystem cache,
// and webpack puts that cache beside the nearest `package.json` — inside the
// person's own project, at `node_modules/.cache/webpack`. Measured across four
// projects: 9 GB, and nothing ever pruned it. It was also corrupt on nearly
// every run, because stopping the preview kills the host mid-write and a pack
// file truncated that way answers `Unexpected end of stream` for ever after —
// 1066 such lines in one day's log. And it bought nothing: a full compile of
// remocn-demo costs ~7 s with or without it, which is why hosts are not kept
// warm in the first place. If a cache is ever wanted back it belongs under the
// app's own data directory, where it would be ours to prune.
export const BUNDLE_FLAGS = {
  askAIEnabled: false,
  bufferStateDelayInMilliseconds: 300,
  enableCaching: false,
  environment: "development",
  experimentalClientSideRenderingEnabled: false,
  keyboardShortcutsEnabled: false,
  maxTimelineTracks: 15,
} as const;

const WATCH_ONLY_PLUGINS = new Set([
  "HotModuleReplacementPlugin",
  "ProgressPlugin",
  "ReactFreshWebpackPlugin",
]);

const REFRESH = /fast-refresh[\\/](loader|runtime)/;

interface Rule {
  oneOf?: Rule[];
  rules?: Rule[];
  use?: unknown;
  [key: string]: unknown;
}

function loaderOf(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }
  if (typeof item === "object" && item !== null && "loader" in item) {
    return String((item as { loader: unknown }).loader);
  }
  return "";
}

function withoutRefresh(rules: Rule[]): Rule[] {
  return rules.map((rule) => {
    if (!rule || typeof rule !== "object") {
      return rule;
    }
    return {
      ...rule,
      ...(rule.rules ? { rules: withoutRefresh(rule.rules) } : {}),
      ...(rule.oneOf ? { oneOf: withoutRefresh(rule.oneOf) } : {}),
      ...(Array.isArray(rule.use)
        ? {
            use: rule.use.filter(
              (item: unknown) => !REFRESH.test(loaderOf(item))
            ),
          }
        : {}),
    };
  });
}

export function renderOnly(config: WebpackConfig): WebpackConfig {
  const plugins = (config.plugins ?? []) as {
    constructor?: { name?: string };
  }[];
  const modules = (config.module ?? {}) as Record<string, unknown>;

  return {
    ...config,
    entry: Array.isArray(config.entry)
      ? (config.entry as unknown[]).filter(
          (entry) => !(typeof entry === "string" && REFRESH.test(entry))
        )
      : config.entry,
    module: {
      ...modules,
      rules: withoutRefresh((modules.rules ?? []) as Rule[]),
    },
    output: { ...(config.output as object), clean: true },
    plugins: plugins.filter(
      (plugin) => !WATCH_ONLY_PLUGINS.has(plugin.constructor?.name ?? "")
    ),
  };
}

export function isHotUpdate(name: string): boolean {
  return name.includes(".hot-update.");
}
