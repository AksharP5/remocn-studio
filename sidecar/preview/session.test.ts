// @vitest-environment node

import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { openSession, type WarmInternals } from "./session";

const SERVE_URL = "http://127.0.0.1:51749/__remocn/render/index.html";

const MEASURED = {
  defaultCodec: "h264",
  durationInFrames: 120,
  fps: 30,
  height: 720,
  id: "Main",
  props: { title: "hello" },
  width: 1280,
};

const OPTIONS = {
  chromeMode: null,
  chromiumOptions: {},
  timeoutInMilliseconds: null,
};

const PROXY_PORT = 3007;

interface Journal {
  closed: number;
  contexts: unknown[];
  internals: WarmInternals;
  proxyPorts: unknown[];
  seeks: number[];
  serverClosed: number;
  steps: string[];
  taken: { height: number; output: string | null; width: number }[];
}

function fakes(
  overrides: {
    onOpenBrowser?: () => Promise<never>;
    onSeek?: () => Promise<unknown>;
    onTake?: (output: string | null) => Promise<unknown>;
  } = {}
): Journal {
  const journal: Journal = {
    closed: 0,
    contexts: [],
    internals: {} as WarmInternals,
    proxyPorts: [],
    seeks: [],
    serverClosed: 0,
    steps: [],
    taken: [],
  };

  const page = {
    setViewport: async () => {
      journal.steps.push("setViewport");
      await Promise.resolve();
    },
  };

  journal.internals = {
    evaluate: async (options) => {
      const named = (options.pageFunction as { name?: string }).name ?? "?";
      journal.steps.push(`evaluate:${named}`);
      if (named === "prepareDesignAudit") {
        return await Promise.resolve({
          value: { candidates: [], findings: [], fingerprint: "frame-state" },
        });
      }
      if (named === "finishDesignContrast") {
        return await Promise.resolve({ value: [] });
      }
      if (named === "probeMotionTargets") {
        return await Promise.resolve({
          value: [{ matches: 0, target: null }],
        });
      }
      return await Promise.resolve({ value: null });
    },
    openBrowser: async () => {
      journal.steps.push("openBrowser");
      if (overrides.onOpenBrowser !== undefined) {
        return await overrides.onOpenBrowser();
      }
      return await Promise.resolve({
        close: async () => {
          journal.closed += 1;
          await Promise.resolve();
        },
        newPage: async (options: Record<string, unknown>) => {
          journal.steps.push("newPage");
          journal.contexts.push(options.context);
          return await Promise.resolve(page);
        },
      });
    },
    prepareServer: async () => {
      journal.steps.push("prepareServer");
      return await Promise.resolve({
        closeServer: async () => {
          journal.serverClosed += 1;
          await Promise.resolve();
        },
        offthreadPort: PROXY_PORT,
        sourceMap: () => null,
      });
    },
    seekToFrame: async (options) => {
      journal.seeks.push(options.frame as number);
      if (overrides.onSeek !== undefined) {
        return await overrides.onSeek();
      }
      return await Promise.resolve(null);
    },
    serialize: (data) => JSON.stringify(data),
    setPropsAndEnv: async (options) => {
      journal.steps.push("setPropsAndEnv");
      journal.proxyPorts.push(options.proxyPort);
      await Promise.resolve();
    },
    takeFrame: async (options) => {
      const output = options.output as string | null;
      journal.taken.push({
        height: options.height as number,
        output,
        width: options.width as number,
      });
      if (overrides.onTake !== undefined) {
        return await overrides.onTake(output);
      }
      return await Promise.resolve(
        options.wantsBuffer === true ? Buffer.from("png") : undefined
      );
    },
  };

  return journal;
}

const open = (journal: Journal) =>
  openSession({
    composition: "Main",
    internals: journal.internals,
    measured: MEASURED,
    options: OPTIONS,
    root: "/Users/me/projects/my-video",
    serveUrl: SERVE_URL,
    timeoutMs: 30_000,
  });

describe("openSession", () => {
  it("sizes the page before it navigates, as renderStill does", async () => {
    const journal = fakes();

    await Effect.runPromise(open(journal));

    expect(journal.steps).toEqual([
      "prepareServer",
      "openBrowser",
      "newPage",
      "setViewport",
      "setPropsAndEnv",
      "evaluate:bundleMode",
    ]);
  });

  // `OffthreadVideo` builds every frame request from `window.remotion_proxyPort`,
  // so the placeholder 0 this used to pass produced `http://localhost:0/proxy?…`
  // — which Chrome refuses as ERR_UNSAFE_PORT. The `delayRender()` the video
  // holds then never clears and the capture dies complaining about disk space.
  it("gives the page the proxy port a video can actually fetch through", async () => {
    const journal = fakes();

    await Effect.runPromise(open(journal));

    expect(journal.proxyPorts).toEqual([PROXY_PORT]);
  });

  it("starts the proxy before the page navigates, or the port is not in its environment", async () => {
    const journal = fakes();

    await Effect.runPromise(open(journal));

    expect(journal.steps.indexOf("prepareServer")).toBeLessThan(
      journal.steps.indexOf("setPropsAndEnv")
    );
  });

  // The page symbolicates its own logs through this getter, and the null we
  // used to pass threw `this.sourceMapGetter is not a function` on every line
  // the bundle printed — which is how the ERR_UNSAFE_PORT this fixes came to be
  // buried in 916 lines of the same TypeError.
  it("gives the page a source map to symbolicate its own logs with", async () => {
    const journal = fakes();

    await Effect.runPromise(open(journal));

    expect(journal.contexts.map((context) => typeof context)).toEqual([
      "function",
    ]);
  });

  it("closes the proxy with the session", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.close);

    expect({ browser: journal.closed, server: journal.serverClosed }).toEqual({
      browser: 1,
      server: 1,
    });
  });

  // The proxy holds an http server and a temporary asset directory, so a
  // session that never opened must not leave one listening.
  it("takes the proxy down when the page never opened", async () => {
    const journal = fakes({
      onOpenBrowser: () => Promise.reject(new Error("no chrome here")),
    });

    const exit = await Effect.runPromiseExit(open(journal));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(journal.serverClosed).toBe(1);
  });

  it("reports the composition it was opened for and its size", async () => {
    const session = await Effect.runPromise(open(fakes()));

    expect({
      composition: session.composition,
      height: session.height,
      width: session.width,
    }).toEqual({ composition: "Main", height: 720, width: 1280 });
  });

  it("navigates once, however many frames are captured", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.capture(10, "/tmp/a.png"));
    await Effect.runPromise(session.capture(25, "/tmp/b.png"));
    await Effect.runPromise(session.capture(40, "/tmp/c.png"));

    expect(journal.steps.filter((step) => step === "setPropsAndEnv")).toEqual([
      "setPropsAndEnv",
    ]);
    expect(journal.seeks).toEqual([10, 25, 40]);
    expect(journal.taken.map((shot) => shot.output)).toEqual([
      "/tmp/a.png",
      "/tmp/b.png",
      "/tmp/c.png",
    ]);
  });

  it("takes the frame at the composition's own resolution", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.capture(10, "/tmp/a.png"));

    expect(journal.taken[0]).toEqual({
      height: 720,
      output: "/tmp/a.png",
      width: 1280,
    });
  });

  it("audits and restores a frame before writing its visible snapshot", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    const audit = await Effect.runPromise(session.audit(20, "/tmp/design.png"));

    expect(audit).toEqual({
      findings: [],
      fingerprint: "frame-state",
      motion: [],
    });
    expect(journal.seeks).toEqual([20]);
    expect(journal.taken.map(({ output }) => output)).toEqual([
      null,
      "/tmp/design.png",
    ]);
    expect(journal.steps.slice(-3)).toEqual([
      "evaluate:prepareDesignAudit",
      "evaluate:finishDesignContrast",
      "evaluate:restoreDesignAudit",
    ]);
  });

  it("probes motion targets on the untouched frame, before the audit hides text", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    const audit = await Effect.runPromise(
      session.audit(20, "/tmp/design.png", ["[data-design-id='orb']"])
    );

    expect(audit.motion).toEqual([{ matches: 0, target: null }]);
    expect(journal.steps.slice(-4)).toEqual([
      "evaluate:probeMotionTargets",
      "evaluate:prepareDesignAudit",
      "evaluate:finishDesignContrast",
      "evaluate:restoreDesignAudit",
    ]);
  });

  it("restores hidden text when the measurement capture fails", async () => {
    const journal = fakes({
      onTake: (output) =>
        output === null
          ? Promise.reject(new Error("measurement failed"))
          : Promise.resolve(),
    });
    const session = await Effect.runPromise(open(journal));

    const exit = await Effect.runPromiseExit(
      session.audit(20, "/tmp/design.png")
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(journal.steps.at(-1)).toBe("evaluate:restoreDesignAudit");
  });

  it("reports a seek that failed rather than writing nothing", async () => {
    const journal = fakes({
      onSeek: () => Promise.reject(new Error("Timed out seeking")),
    });
    const session = await Effect.runPromise(open(journal));

    const exit = await Effect.runPromiseExit(session.capture(10, "/tmp/a.png"));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(String(exit)).toContain("Timed out seeking");
    expect(journal.taken).toEqual([]);
  });

  it("closes the browser it opened", async () => {
    const journal = fakes();
    const session = await Effect.runPromise(open(journal));

    await Effect.runPromise(session.close);

    expect(journal.closed).toBe(1);
  });
});
