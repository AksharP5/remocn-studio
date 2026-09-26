import { Effect, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { StillEvent } from "@/shared/ipc";
import type { ConfiguredValue, ResolvedConfig } from "./config";
import type { GlSupport, RenderContext } from "./failure";
import type { RenderOptions } from "./project";
import type { WarmInternals } from "./session";
import {
  DELAY_RENDER_TIMEOUT_MS,
  type RenderBrowser,
  type Renderer,
  readyBrowser,
} from "./still";

export const SOFTWARE_GL = "swangle";

export const DESKTOP_GL = "angle";

const HARDWARE: Record<string, true> = {
  angle: true,
  "angle-egl": true,
  egl: true,
  vulkan: true,
};

export type GlSource = "config" | "studio";

export interface GlChoice {
  readonly gl: string | null;
  readonly source: GlSource;
}

export function glPolicy(config: ResolvedConfig, platform: string): GlChoice {
  const asked = config.chromium.gl;

  if (typeof asked === "string" && asked.length > 0) {
    return { gl: asked, source: "config" };
  }

  return {
    gl:
      platform === "darwin" || platform === "win32" ? DESKTOP_GL : SOFTWARE_GL,
    source: "studio",
  };
}

function configured(config: ResolvedConfig, name: string): unknown {
  const held: ConfiguredValue | undefined = config.options[name];
  return held === undefined ? null : held.value;
}

export function browserOptionsOf(
  config: ResolvedConfig,
  platform: string
): RenderOptions {
  const chosen = glPolicy(config, platform);
  const timeout = configured(config, "timeoutInMilliseconds");
  const executable = configured(config, "browserExecutable");
  const mode = configured(config, "chromeMode");

  return {
    browserExecutable: typeof executable === "string" ? executable : null,
    chromeMode: typeof mode === "string" ? mode : null,
    chromiumOptions: { ...config.chromium, gl: chosen.gl },
    timeoutInMilliseconds: typeof timeout === "number" ? timeout : null,
  };
}

export interface BrowserReading {
  readonly context: RenderContext;
  readonly note: string | null;
  readonly options: RenderOptions;
}

interface ProbePage {
  close?: () => Promise<unknown>;
}

interface ProbeBrowser {
  close: (options: { silent: boolean }) => Promise<unknown>;
  newPage: (options: Record<string, unknown>) => Promise<ProbePage>;
}

function support(): string {
  const canvas = document.createElement("canvas");

  try {
    if (canvas.getContext("webgl2") !== null) {
      return "webgl2";
    }
  } catch {
    return "none";
  }

  try {
    return canvas.getContext("webgl") === null ? "none" : "webgl1";
  } catch {
    return "none";
  }
}

export interface ProbeInput {
  readonly internals: WarmInternals;
  readonly options: RenderOptions;
  readonly timeoutMs: number;
}

export function probeGl(
  input: ProbeInput
): Effect.Effect<{ message: string | null; support: GlSupport }> {
  return Effect.tryPromise(async () => {
    const browser = (await input.internals.openBrowser("chrome", {
      ...(input.options.chromeMode === null
        ? {}
        : { chromeMode: input.options.chromeMode }),
      browserExecutable: input.options.browserExecutable ?? null,
      chromiumOptions: input.options.chromiumOptions,
      forceDeviceScaleFactor: 1,
      logLevel: "error",
    })) as unknown as ProbeBrowser;

    try {
      const page = await browser.newPage({
        context: () => null,
        indent: false,
        logLevel: "error",
        onBrowserLog: null,
        onLog: () => undefined,
        pageIndex: 0,
      });

      const answered = await input.internals.evaluate({
        args: [],
        frame: null,
        page,
        pageFunction: support,
        timeoutInMilliseconds: input.timeoutMs,
      });

      return read(answered);
    } finally {
      await browser.close({ silent: true }).catch(() => undefined);
    }
  }).pipe(
    Effect.map((found) => ({ message: null, support: found })),
    Effect.catch((cause) =>
      Effect.succeed({
        message: errorMessage(cause),
        support: "unknown" as GlSupport,
      })
    )
  );
}

function read(answered: unknown): GlSupport {
  const value =
    typeof answered === "object" && answered !== null && "value" in answered
      ? (answered as { value: unknown }).value
      : answered;

  return value === "webgl2" || value === "webgl1" || value === "none"
    ? value
    : "unknown";
}

export interface PrepareInput {
  readonly config: ResolvedConfig;
  readonly internals: WarmInternals | null;
  readonly onEvent: (event: StillEvent) => void;
  readonly platform: string;
  readonly probe?: (
    input: ProbeInput
  ) => Effect.Effect<{ message: string | null; support: GlSupport }>;
  readonly renderer: Pick<Renderer, "ensureBrowser">;
}

export function prepareBrowser(input: PrepareInput) {
  return Effect.gen(function* () {
    const chosen = glPolicy(input.config, input.platform);
    const options = browserOptionsOf(input.config, input.platform);

    yield* readyBrowser({
      onEvent: input.onEvent,
      options,
      renderer: input.renderer,
    });

    if (input.internals === null) {
      return {
        context: { gl: chosen.gl, glSource: chosen.source, support: "unknown" },
        note: null,
        options,
      } satisfies BrowserReading;
    }

    const probe = input.probe ?? probeGl;
    const timeoutMs = options.timeoutInMilliseconds ?? DELAY_RENDER_TIMEOUT_MS;
    const first = yield* probe({
      internals: input.internals,
      options,
      timeoutMs,
    });

    if (
      first.support !== "none" ||
      chosen.source === "config" ||
      chosen.gl === null ||
      HARDWARE[chosen.gl] !== true
    ) {
      return {
        context: {
          gl: chosen.gl,
          glSource: chosen.source,
          support: first.support,
        },
        note: null,
        options,
      } satisfies BrowserReading;
    }

    const software: RenderOptions = {
      ...options,
      chromiumOptions: { ...options.chromiumOptions, gl: SOFTWARE_GL },
    };

    const second = yield* probe({
      internals: input.internals,
      options: software,
      timeoutMs,
    });

    if (second.support === "none" || second.support === "unknown") {
      return {
        context: {
          gl: chosen.gl,
          glSource: chosen.source,
          support: first.support,
        },
        note: `neither ${chosen.gl} nor ${SOFTWARE_GL} could make a WebGL context in the render browser`,
        options,
      } satisfies BrowserReading;
    }

    return {
      context: {
        gl: SOFTWARE_GL,
        glSource: "studio",
        support: second.support,
      },
      note: `${chosen.gl} could not make a WebGL context here, so the render browser draws in software with ${SOFTWARE_GL}`,
      options: software,
    } satisfies BrowserReading;
  });
}

export function sharedBrowser(
  renderer: Pick<Renderer, "openBrowser">,
  options: RenderOptions,
  scale = 1
): Effect.Effect<RenderBrowser | null, never, Scope.Scope> {
  const open = renderer.openBrowser;

  if (open === undefined) {
    return Effect.succeed(null);
  }

  return Effect.acquireRelease(
    Effect.promise(() =>
      open("chrome", {
        ...(options.chromeMode === null
          ? {}
          : { chromeMode: options.chromeMode }),
        browserExecutable: options.browserExecutable ?? null,
        chromiumOptions: options.chromiumOptions,
        ...(scale === 1 ? {} : { forceDeviceScaleFactor: scale }),
        logLevel: "error",
      }).catch(() => null)
    ),
    (browser) =>
      browser === null
        ? Effect.void
        : Effect.promise(() =>
            browser.close({ silent: true }).catch(() => undefined)
          )
  );
}

export function signatureOf(options: RenderOptions): string {
  return JSON.stringify([
    options.browserExecutable ?? null,
    options.chromeMode,
    options.chromiumOptions,
  ]);
}
