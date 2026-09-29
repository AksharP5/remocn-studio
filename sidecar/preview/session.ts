import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { probeVideoFrame, type VideoFrameProbe } from "./choreography";
import {
  type FrameDesignAudit,
  finishDesignContrast,
  type MotionProbe,
  type OffthreadFootage,
  offthreadFootage,
  type PreparedDesignAudit,
  prepareDesignAudit,
  probeMotionTargets,
  restoreDesignAudit,
} from "./design";
import { type Measured, PreviewError, type RenderOptions } from "./project";
import { probeReadiness, type ReadinessFrame } from "./readiness-browser";

const FORWARDED = [
  "durationInFrames",
  "fps",
  "height",
  "width",
  "defaultCodec",
  "defaultOutName",
  "defaultVideoImageFormat",
  "defaultPixelFormat",
  "defaultProResProfile",
  "defaultSampleRate",
] as const;

interface Page {
  on?: (event: "error", listener: (error: unknown) => void) => unknown;
  setViewport: (viewport: {
    deviceScaleFactor: number;
    height: number;
    width: number;
  }) => Promise<unknown>;
}

interface Browser {
  close: (options: { silent: boolean }) => Promise<unknown>;
  newPage: (options: Record<string, unknown>) => Promise<Page>;
}

// The proxy `OffthreadVideo` fetches every frame through. `renderStill` starts
// one per capture and hands it its port; the warm session has to start its own,
// because a page told `proxyPort: 0` builds `http://localhost:0/proxy?…`, which
// Chrome refuses outright as `ERR_UNSAFE_PORT` — and the `delayRender()` the
// video holds then never clears, so the capture dies with a message about disk
// space that has nothing to do with anything.
export interface OffthreadServer {
  closeServer: (force: boolean) => Promise<unknown>;
  offthreadPort: number;
  sourceMap: () => unknown;
}

export interface WarmInternals {
  evaluate: (options: Record<string, unknown>) => Promise<unknown>;
  handleJavascriptException?: (options: {
    page: Page;
    frame: number | null;
    onError: (error: unknown) => void;
  }) => () => void;
  openBrowser: (
    browser: "chrome",
    options: Record<string, unknown>
  ) => Promise<Browser>;
  prepareServer: (options: Record<string, unknown>) => Promise<OffthreadServer>;
  seekToFrame: (options: Record<string, unknown>) => Promise<unknown>;
  serialize: (data: unknown) => string;
  setPropsAndEnv: (options: Record<string, unknown>) => Promise<unknown>;
  takeFrame: (options: Record<string, unknown>) => Promise<unknown>;
}

export interface Session {
  readonly audit: (
    frame: number,
    output: string,
    selectors?: readonly string[],
    readableOpacity?: number
  ) => Effect.Effect<FrameDesignAudit, PreviewError>;
  readonly capture: (
    frame: number,
    output: string
  ) => Effect.Effect<void, PreviewError>;
  readonly close: Effect.Effect<void>;
  readonly composition: string;
  readonly durationInFrames: number;
  readonly fps: number;
  readonly height: number;
  readonly probe: (
    frame: number,
    camera: string | null
  ) => Effect.Effect<VideoFrameProbe, PreviewError>;
  readonly width: number;
}

export interface SessionInput {
  composition: string;
  inputProps?: Record<string, unknown>;
  internals: WarmInternals;
  measured: Measured;
  options: RenderOptions;
  // The Remotion root, for the proxy's own temporary files — the same value
  // `renderStill` passes as `remotionRoot`.
  root: string;
  serveUrl: string;
  timeoutMs: number;
}

const failed = (cause: unknown) =>
  new PreviewError({ message: errorMessage(cause) });

export function openSession(
  input: SessionInput
): Effect.Effect<Session, PreviewError> {
  return Effect.tryPromise({
    catch: failed,
    try: async (signal) => {
      // Started before the browser, because its port has to be in the page's
      // environment from the first navigation. The arguments mirror the ones
      // `renderStill` passes through `makeOrReuseServer`; our serve URL is an
      // http one, so this branch serves `/proxy` and nothing else.
      const server = await input.internals.prepareServer({
        binariesDirectory: null,
        forceIPv4: false,
        indent: false,
        logLevel: "error",
        offthreadVideoCacheSizeInBytes: null,
        offthreadVideoThreads: 2,
        port: null,
        remotionRoot: input.root,
        sampleRate: 48_000,
        webpackConfigOrServeUrl: input.serveUrl,
      });

      try {
        return await warm(input, server, signal);
      } catch (cause) {
        // The proxy holds an http server and a temporary asset directory, so a
        // session that never opened must not leave one behind.
        await server.closeServer(true).catch(() => undefined);
        throw cause;
      }
    },
  }).pipe(
    Effect.map(({ browser, measured, page, server, assertHealthy }) =>
      sessionOf(input, browser, measured, page, server, assertHealthy)
    )
  );
}

async function warm(
  input: SessionInput,
  server: OffthreadServer,
  signal: AbortSignal
) {
  const { internals, options } = input;
  const { chromeMode, chromiumOptions } = options;

  const browser = await internals.openBrowser("chrome", {
    ...(chromeMode === null ? {} : { chromeMode }),
    chromiumOptions,
    forceDeviceScaleFactor: 1,
    logLevel: "error",
  });

  const abort = () => {
    browser.close({ silent: true }).catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const page = await browser.newPage({
      // The page symbolicates its own logs and errors through this, and a null
      // one throws `this.sourceMapGetter is not a function` on every line the
      // bundle prints — 916 of them in this machine's log, which is how an
      // ERR_UNSAFE_PORT came to be buried. There was nothing to pass before,
      // because there was no server.
      context: server.sourceMap,
      indent: false,
      logLevel: "error",
      onBrowserLog: null,
      onLog: () => undefined,
      pageIndex: 0,
    });

    let pageError: unknown = null;
    page.on?.("error", (error) => {
      pageError = error;
    });
    input.internals.handleJavascriptException?.({
      frame: null,
      onError: (error) => {
        pageError = error;
      },
      page,
    });
    const assertHealthy = () => {
      if (pageError !== null) {
        throw pageError;
      }
    };
    await page.setViewport({
      deviceScaleFactor: 1,
      height: input.measured.height,
      width: input.measured.width,
    });

    await internals.setPropsAndEnv({
      audioEnabled: false,
      darkMode: chromiumOptions.darkMode === true,
      envVariables: {},
      indent: false,
      initialFrame: 0,
      initialMemoryAvailable: null,
      isMainTab: true,
      logLevel: "error",
      mediaCacheSizeInBytes: null,
      onServeUrlVisited: () => undefined,
      page,
      proxyPort: server.offthreadPort,
      retriesRemaining: 2,
      sampleRate: 48_000,
      serializedInputPropsWithCustomSchema: internals.serialize(
        input.inputProps ?? {}
      ),
      serveUrl: input.serveUrl,
      timeoutInMilliseconds: input.timeoutMs,
      videoEnabled: true,
    });

    await internals.evaluate({
      args: [
        input.composition,
        internals.serialize(input.measured.props ?? {}),
        ...FORWARDED.map((key) => input.measured[key] ?? null),
      ],
      frame: null,
      page,
      pageFunction: bundleMode,
      timeoutInMilliseconds: input.timeoutMs,
    });

    signal.throwIfAborted();
    assertHealthy();
    return { assertHealthy, browser, measured: input.measured, page, server };
  } catch (cause) {
    await browser.close({ silent: true }).catch(() => undefined);
    throw cause;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function sessionOf(
  input: SessionInput,
  browser: Browser,
  measured: Measured,
  page: Page,
  server: OffthreadServer,
  assertHealthy: () => void
): Session {
  const seek = async (frame: number) => {
    assertHealthy();
    await input.internals.seekToFrame({
      attempt: 0,
      composition: input.composition,
      frame,
      indent: false,
      logLevel: "error",
      page,
      timeoutInMilliseconds: input.timeoutMs,
    });
    assertHealthy();
  };

  const take = async (output: string | null, wantsBuffer: boolean) => {
    assertHealthy();
    const result = await input.internals.takeFrame({
      freePage: page,
      height: measured.height,
      imageFormat: "png",
      jpegQuality: 80,
      output,
      scale: 1,
      timeoutInMilliseconds: input.timeoutMs,
      wantsBuffer,
      width: measured.width,
    });
    assertHealthy();
    return result;
  };

  const evaluate = async <A>(
    pageFunction: (...args: never[]) => unknown,
    args: readonly unknown[]
  ): Promise<A> => {
    const result = await input.internals.evaluate({
      args,
      frame: null,
      page,
      pageFunction,
      timeoutInMilliseconds: input.timeoutMs,
    });
    return evaluated<A>(result);
  };

  return {
    audit: (
      frame: number,
      output: string,
      selectors = [],
      readableOpacity?: number
    ) =>
      Effect.tryPromise({
        catch: failed,
        try: async () => {
          let prepared = false;
          try {
            await seek(frame);
            const footage = await evaluate<OffthreadFootage[]>(
              offthreadFootage as (...args: never[]) => unknown,
              []
            );
            const motion =
              selectors.length === 0
                ? []
                : await evaluate<MotionProbe[]>(
                    probeMotionTargets as (...args: never[]) => unknown,
                    [selectors]
                  );
            prepared = true;
            const audit = await evaluate<PreparedDesignAudit>(
              prepareDesignAudit as (...args: never[]) => unknown,
              [frame]
            );
            const measurement = bytesOf(await take(null, true));
            const contrast = await evaluate<
              readonly FrameDesignAudit["findings"][number][]
            >(finishDesignContrast as (...args: never[]) => unknown, [
              measurement.toString("base64"),
              frame,
              audit.candidates,
            ]);
            await take(output, false);
            const details =
              readableOpacity === undefined
                ? undefined
                : await evaluate<ReadinessFrame>(
                    probeReadiness as (...args: never[]) => unknown,
                    [
                      bytesOf(await take(null, true)).toString("base64"),
                      readableOpacity,
                    ]
                  );
            return {
              ...(details ? { details } : {}),
              findings: [...audit.findings, ...contrast],
              fingerprint: audit.fingerprint,
              footage,
              motion,
            };
          } finally {
            if (prepared) {
              await evaluate<void>(
                restoreDesignAudit as (...args: never[]) => unknown,
                []
              ).catch(() => undefined);
            }
          }
        },
      }),
    capture: (frame: number, output: string) =>
      Effect.tryPromise({
        catch: failed,
        try: async () => {
          await seek(frame);
          await take(output, false);
        },
      }),
    // The proxy outlives nothing: the page that talks to it is going.
    close: Effect.ignore(
      Effect.tryPromise(() => browser.close({ silent: true }))
    ).pipe(
      Effect.andThen(
        Effect.ignore(Effect.tryPromise(() => server.closeServer(true)))
      )
    ),
    composition: input.composition,
    durationInFrames: Math.max(
      1,
      Math.round(countOf(measured.durationInFrames, 1))
    ),
    fps: countOf(measured.fps, 30),
    height: Math.round(measured.height),
    probe: (frame: number, camera: string | null) =>
      Effect.tryPromise({
        catch: failed,
        try: async () => {
          await seek(frame);
          return await evaluate<VideoFrameProbe>(
            probeVideoFrame as (...args: never[]) => unknown,
            [camera]
          );
        },
      }),
    width: Math.round(measured.width),
  };
}

function countOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function evaluated<A>(result: unknown): A {
  if (typeof result === "object" && result !== null && "value" in result) {
    return (result as { value: A }).value;
  }
  return result as A;
}

function bytesOf(result: unknown): Buffer {
  if (Buffer.isBuffer(result)) {
    return result;
  }
  if (result instanceof Uint8Array) {
    return Buffer.from(result);
  }
  throw new Error("the render browser did not return a PNG buffer");
}

function bundleMode(
  id: string,
  props: string,
  durationInFrames: number,
  fps: number,
  height: number,
  width: number,
  defaultCodec: unknown,
  defaultOutName: unknown,
  defaultVideoImageFormat: unknown,
  defaultPixelFormat: unknown,
  defaultProResProfile: unknown,
  defaultSampleRate: unknown
) {
  (
    window as unknown as { remotion_setBundleMode: (state: unknown) => void }
  ).remotion_setBundleMode({
    compositionDefaultCodec: defaultCodec,
    compositionDefaultOutName: defaultOutName,
    compositionDefaultPixelFormat: defaultPixelFormat,
    compositionDefaultProResProfile: defaultProResProfile,
    compositionDefaultSampleRate: defaultSampleRate,
    compositionDefaultVideoImageFormat: defaultVideoImageFormat,
    compositionDurationInFrames: durationInFrames,
    compositionFps: fps,
    compositionHeight: height,
    compositionName: id,
    compositionWidth: width,
    serializedResolvedPropsWithSchema: props,
    type: "composition",
  });
}
