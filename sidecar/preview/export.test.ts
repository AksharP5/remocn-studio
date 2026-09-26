import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit, Fiber } from "effect";
import type { ExportEvent } from "@/shared/ipc";
import { EMPTY_CONFIG } from "./config";
import {
  CODEC,
  type Exporter,
  exporterOf,
  exportMedia,
  OUT_DIR,
  planFor,
  type RenderMediaOptions,
  type RenderPlan,
} from "./export";
import type { RenderContext } from "./failure";
import type { RenderOptions } from "./project";
import type { RenderBrowser, Renderer } from "./still";

const SERVE_URL = "http://127.0.0.1:51749/__remocn/render/index.html";

const NOTHING_CONFIGURED: RenderOptions = {
  chromeMode: null,
  chromiumOptions: {},
  timeoutInMilliseconds: null,
};

const made: string[] = [];

function root(): string {
  const created = mkdtempSync(path.join(tmpdir(), "remocn-export-"));
  made.push(created);
  return created;
}

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

interface Fake {
  cancels: number;
  rendered: RenderMediaOptions[];
  renderer: Exporter & Renderer;
  selected: string[];
}

function fake(
  overrides: Partial<{
    download: (report: (percent: number) => void) => void;
    duration: number;
    onRender: (options: RenderMediaOptions) => Promise<unknown>;
  }> = {}
): Fake {
  const state: Fake = {
    cancels: 0,
    rendered: [],
    renderer: {} as Exporter & Renderer,
    selected: [],
  };

  state.renderer = {
    ensureBrowser: async (options) => {
      const { onProgress } = options.onBrowserDownload();
      overrides.download?.((percent) => onProgress({ percent }));
      await Promise.resolve();
    },
    makeCancelSignal: () => {
      const waiting: (() => void)[] = [];

      return {
        cancel: () => {
          state.cancels += 1;
          for (const callback of waiting.splice(0)) {
            callback();
          }
        },
        cancelSignal: (callback: () => void) => waiting.push(callback),
      };
    },
    renderMedia: async (options) => {
      state.rendered.push(options);
      writeFileSync(options.outputLocation, "half a video");

      if (overrides.onRender !== undefined) {
        return await overrides.onRender(options);
      }

      writeFileSync(options.outputLocation, "a whole video");
      return await Promise.resolve(null);
    },
    renderStill: () => Promise.reject(new Error("not part of an export")),
    selectComposition: async (options) => {
      state.selected.push(options.id);

      return await Promise.resolve({
        durationInFrames: overrides.duration ?? 300,
        height: 1080,
        width: 1920,
      });
    },
  };

  return state;
}

const MEASURED = { durationInFrames: 300, height: 1080, width: 1920 };

function ship(
  renderer: Exporter & Renderer,
  target: string,
  options: {
    browser?: RenderBrowser;
    context?: RenderContext;
    onEvent?: (event: ExportEvent) => void;
    plan?: Partial<RenderPlan>;
    project?: RenderOptions;
  } = {}
) {
  return exportMedia({
    browser: options.browser ?? null,
    composition: "Main",
    ...(options.context === undefined ? {} : { context: options.context }),
    measured: MEASURED,
    onEvent: options.onEvent ?? (() => undefined),
    options: options.project ?? NOTHING_CONFIGURED,
    plan: {
      codec: CODEC,
      crf: null,
      extra: {},
      outputPath: path.join(target, OUT_DIR, "Main.mp4"),
      proResProfile: null,
      scale: 1,
      ...options.plan,
    },
    renderer,
    serveUrl: SERVE_URL,
  });
}

const hangsUntilCancelled = (options: RenderMediaOptions) =>
  new Promise<never>((_resolve, reject) => {
    (options.cancelSignal as (callback: () => void) => void)(() =>
      reject(new Error("Render cancelled"))
    );
  });

describe("exportMedia", () => {
  it("renders an mp4 through the project's own renderMedia", async () => {
    const target = root();
    const state = fake();

    const exported = await Effect.runPromise(ship(state.renderer, target));

    expect(state.rendered).toHaveLength(1);
    expect(state.rendered[0].codec).toBe(CODEC);
    expect(state.rendered[0].serveUrl).toBe(SERVE_URL);
    expect(exported.path).toBe(path.join(target, OUT_DIR, "Main.mp4"));
    expect(readFileSync(exported.path, "utf8")).toBe("a whole video");
  });

  it("renders in the browser it is handed instead of opening its own", async () => {
    const browser: RenderBrowser = { close: () => Promise.resolve() };
    const shared = fake();
    const alone = fake();

    await Effect.runPromise(ship(shared.renderer, root(), { browser }));
    await Effect.runPromise(ship(alone.renderer, root()));

    expect(shared.rendered[0].puppeteerInstance).toBe(browser);
    expect("puppeteerInstance" in (alone.rendered[0] ?? {})).toBe(false);
  });

  it("reports the size of the file it wrote", async () => {
    const state = fake();

    const exported = await Effect.runPromise(ship(state.renderer, root()));

    expect(exported.bytes).toBe("a whole video".length);
  });

  it("renders to a partial file and only names it once the render finished", async () => {
    const target = root();
    const state = fake();

    const exported = await Effect.runPromise(ship(state.renderer, target));

    expect(state.rendered[0].outputLocation).not.toBe(exported.path);
    expect(readdirSync(path.join(target, OUT_DIR))).toEqual(["Main.mp4"]);
  });

  it("leaves no half-written file behind when the render fails", async () => {
    const target = root();
    const state = fake({
      onRender: () => Promise.reject(new Error("Cannot find module ./missing")),
    });

    const exit = await Effect.runPromiseExit(ship(state.renderer, target));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("Cannot find module ./missing");
    expect(readdirSync(path.join(target, OUT_DIR))).toEqual([]);
  });

  it("keeps an earlier export when a later one fails", async () => {
    const target = root();

    const exported = await Effect.runPromise(ship(fake().renderer, target));

    const failing = fake({
      onRender: () => Promise.reject(new Error("the scene threw")),
    });

    await Effect.runPromiseExit(ship(failing.renderer, target));

    expect(readFileSync(exported.path, "utf8")).toBe("a whole video");
    expect(readdirSync(path.join(target, OUT_DIR))).toEqual(["Main.mp4"]);
  });

  it("cancels the render and cleans up when it is interrupted", async () => {
    const target = root();
    const state = fake({ onRender: hangsUntilCancelled });

    const fiber = Effect.runFork(ship(state.renderer, target));

    await waitFor(() => state.rendered.length === 1);
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(state.cancels).toBe(1);
    expect(readdirSync(path.join(target, OUT_DIR))).toEqual([]);
    expect(existsSync(path.join(target, OUT_DIR, "Main.mp4"))).toBe(false);
  });

  it("says which stage of the job it is in, and provisions no browser of its own", async () => {
    const seen: ExportEvent[] = [];
    const state = fake({
      download: (report) => report(0.5),
    });

    await Effect.runPromise(
      ship(state.renderer, root(), { onEvent: (event) => seen.push(event) })
    );

    expect(
      seen.filter((event) => event.type === "stage").map((event) => event.stage)
    ).toEqual(["rendering", "finalizing"]);
    expect(seen.some((event) => event.type === "browser")).toBe(false);
  });

  it("folds Remotion's progress into frame counts and a percent", async () => {
    const seen: ExportEvent[] = [];
    const state = fake({
      onRender: (options) => {
        options.onStart({ frameCount: 200 });
        options.onProgress({
          encodedFrames: 40,
          progress: 0.255,
          renderedFrames: 60,
          stitchStage: "encoding",
        });
        options.onProgress({
          encodedFrames: 200,
          progress: 1,
          renderedFrames: 200,
          stitchStage: "muxing",
        });
        return Promise.resolve(null);
      },
    });

    await Effect.runPromise(
      ship(state.renderer, root(), { onEvent: (event) => seen.push(event) })
    );

    expect(seen.filter((event) => event.type === "progress")).toEqual([
      {
        encoded: 40,
        percent: 26,
        rendered: 60,
        stage: "encoding",
        total: 200,
        type: "progress",
      },
      {
        encoded: 200,
        percent: 100,
        rendered: 200,
        stage: "muxing",
        total: 200,
        type: "progress",
      },
    ]);
  });

  it("knows the frame count from the composition before the render starts", async () => {
    const seen: ExportEvent[] = [];
    const state = fake({
      onRender: (options) => {
        options.onProgress({
          encodedFrames: 0,
          progress: 0,
          renderedFrames: 3,
          stitchStage: "encoding",
        });
        return Promise.resolve(null);
      },
    });

    await Effect.runPromise(
      ship(state.renderer, root(), { onEvent: (event) => seen.push(event) })
    );

    expect(seen.filter((event) => event.type === "progress")).toEqual([
      {
        encoded: 0,
        percent: 0,
        rendered: 3,
        stage: "encoding",
        total: 300,
        type: "progress",
      },
    ]);
  });

  it("renders with the GL backend and timeout the project configured", async () => {
    const state = fake();

    await Effect.runPromise(
      ship(state.renderer, root(), {
        project: {
          chromeMode: "chrome-for-testing",
          chromiumOptions: { gl: "angle" },
          timeoutInMilliseconds: 90_000,
        },
      })
    );

    expect(state.rendered[0].chromiumOptions).toEqual({ gl: "angle" });
    expect(state.rendered[0].chromeMode).toBe("chrome-for-testing");
    expect(state.rendered[0].timeoutInMilliseconds).toBe(90_000);
  });

  it("renders from the measurement the job pinned, never its own", async () => {
    const target = root();
    const state = fake();

    await Effect.runPromise(ship(state.renderer, target));

    expect(state.selected).toEqual([]);
    expect(state.rendered[0].composition).toEqual(MEASURED);
  });

  it("names the file and the size the plan asked for", async () => {
    const target = root();
    const state = fake();
    const output = path.join(target, "elsewhere", "Intro-youtube.webm");

    const exported = await Effect.runPromise(
      ship(state.renderer, target, {
        plan: { codec: "vp9", outputPath: output, scale: 0.5 },
      })
    );

    expect(exported.path).toBe(output);
    expect(exported.width).toBe(960);
    expect(exported.height).toBe(540);
    expect(state.rendered[0].scale).toBe(0.5);
  });

  it("carries the project's own render settings through", async () => {
    const state = fake();

    await Effect.runPromise(
      ship(state.renderer, root(), {
        plan: { crf: 12, extra: { audioCodec: "aac", everyNthFrame: 1 } },
      })
    );

    expect(state.rendered[0]).toMatchObject({
      audioCodec: "aac",
      crf: 12,
      everyNthFrame: 1,
    });
  });

  it("no longer blames WebGL for every delayRender that never cleared", async () => {
    const state = fake({
      onRender: () =>
        Promise.reject(
          new Error(
            'A delayRender() "neon-aurora: compiling" was called but not cleared after 28000ms.'
          )
        ),
    });

    const exit = await Effect.runPromiseExit(
      ship(state.renderer, root(), {
        context: { gl: "angle", glSource: "studio", support: "webgl2" },
      })
    );

    expect(String(exit)).not.toContain("setChromiumOpenGlRenderer");
    expect(String(exit)).toContain("font");
  });

  it("says it when the browser really could not make a context", async () => {
    const state = fake({
      onRender: () =>
        Promise.reject(
          new Error(
            'A delayRender() "neon-aurora: compiling" was called but not cleared after 28000ms.'
          )
        ),
    });

    const exit = await Effect.runPromiseExit(
      ship(state.renderer, root(), {
        context: { gl: null, glSource: "default", support: "none" },
      })
    );

    expect(String(exit)).toContain("setChromiumOpenGlRenderer");
  });
});

describe("planFor", () => {
  const config = {
    ...EMPTY_CONFIG,
    accepts: {
      composition: [],
      media: ["crf", "proResProfile", "audioCodec", "scale"],
      still: [],
    },
    options: {
      audioCodec: { source: "config", value: "aac" },
      crf: { source: "config", value: 30 },
      proResProfile: { source: "config", value: "hq" },
      scale: { source: "config", value: 0.5 },
    },
  };

  it("lets the project's own CRF through when the person asked for its default", () => {
    const { plan } = planFor({
      config,
      outputPath: "/tmp/Main.mp4",
      settings: {
        format: "mp4",
        preset: "custom",
        quality: "project",
        resolution: "source",
      },
      size: { height: 1080, width: 1920 },
    });

    expect(plan.crf).toBeNull();
    expect(plan.extra.crf).toBe(30);
  });

  it("takes the project's CRF off once a quality is picked", () => {
    const { plan } = planFor({
      config,
      outputPath: "/tmp/Main.mp4",
      settings: {
        format: "mp4",
        preset: "custom",
        quality: "high",
        resolution: "source",
      },
      size: { height: 1080, width: 1920 },
    });

    expect(plan.crf).toBe(12);
    expect(plan.extra.crf).toBeUndefined();
  });

  it("never sends a ProRes profile to an H.264 export", () => {
    const { dropped, plan } = planFor({
      config,
      outputPath: "/tmp/Main.mp4",
      settings: {
        format: "mp4",
        preset: "custom",
        quality: "project",
        resolution: "source",
      },
      size: { height: 1080, width: 1920 },
    });

    expect(plan.extra.proResProfile).toBeUndefined();
    expect(dropped.map((one) => one.name)).toContain("proResProfile");
  });

  it("takes the scale from the resolution rather than from the config", () => {
    const { plan } = planFor({
      config,
      outputPath: "/tmp/Main.mp4",
      settings: {
        format: "mp4",
        preset: "custom",
        quality: "project",
        resolution: "720",
      },
      size: { height: 1080, width: 1920 },
    });

    expect(plan.scale).toBeCloseTo(720 / 1080, 10);
    expect(plan.extra.scale).toBeUndefined();
  });
});

describe("exporterOf", () => {
  it("takes a renderer that can encode a video", async () => {
    const state = fake();

    const found = await Effect.runPromise(exporterOf(state.renderer));

    expect(found).toBe(state.renderer);
  });

  it("refuses a Remotion too old to expose renderMedia", async () => {
    const { makeCancelSignal, renderMedia, ...rest } = fake().renderer;

    const exit = await Effect.runPromiseExit(exporterOf(rest as Renderer));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("does not expose renderMedia");
  });
});

function waitFor(done: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (done()) {
        resolve();
        return;
      }
      setTimeout(tick, 5);
    };

    tick();
  });
}
