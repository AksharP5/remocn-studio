import { describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import {
  browserOptionsOf,
  DESKTOP_GL,
  glPolicy,
  prepareBrowser,
  SOFTWARE_GL,
  sharedBrowser,
  signatureOf,
} from "./browser";
import { EMPTY_CONFIG, type ResolvedConfig } from "./config";
import type { GlSupport } from "./failure";
import type { WarmInternals } from "./session";

const configured = (patch: Partial<ResolvedConfig>): ResolvedConfig => ({
  ...EMPTY_CONFIG,
  ...patch,
});

const INTERNALS = {} as WarmInternals;

const renderer = () => {
  const seen: unknown[] = [];

  return {
    ensureBrowser: (options: unknown) => {
      seen.push(options);
      return Promise.resolve(null);
    },
    seen,
  };
};

function probing(answers: readonly GlSupport[]) {
  const asked: (string | undefined)[] = [];
  let index = 0;

  return {
    asked,
    probe: (input: {
      options: { chromiumOptions: Record<string, unknown> };
    }) => {
      asked.push(input.options.chromiumOptions.gl as string | undefined);
      const answer = answers[index] ?? "unknown";
      index += 1;
      return Effect.succeed({ message: null, support: answer });
    },
  };
}

describe("glPolicy", () => {
  it("keeps the project's own choice", () => {
    const config = configured({ chromium: { gl: "swiftshader" } });

    expect(glPolicy(config, "darwin")).toEqual({
      gl: "swiftshader",
      source: "config",
    });
  });

  it("chooses angle on a desktop when the project said nothing", () => {
    expect(glPolicy(EMPTY_CONFIG, "darwin")).toEqual({
      gl: DESKTOP_GL,
      source: "studio",
    });
    expect(glPolicy(EMPTY_CONFIG, "win32").gl).toBe(DESKTOP_GL);
  });

  it("draws in software where there is no desktop GPU to assume", () => {
    expect(glPolicy(EMPTY_CONFIG, "linux").gl).toBe(SOFTWARE_GL);
  });

  it("reads a null from the config as nothing configured", () => {
    const config = configured({ chromium: { gl: null } });

    expect(glPolicy(config, "darwin").source).toBe("studio");
  });
});

describe("browserOptionsOf", () => {
  it("carries the project's browser settings and the chosen backend", () => {
    const config = configured({
      chromium: { darkMode: true, gl: null, headless: true },
      options: {
        browserExecutable: { source: "config", value: "/tmp/chrome" },
        chromeMode: { source: "config", value: "chrome-for-testing" },
        timeoutInMilliseconds: { source: "config", value: 90_000 },
      },
    });

    expect(browserOptionsOf(config, "darwin")).toEqual({
      browserExecutable: "/tmp/chrome",
      chromeMode: "chrome-for-testing",
      chromiumOptions: { darkMode: true, gl: DESKTOP_GL, headless: true },
      timeoutInMilliseconds: 90_000,
    });
  });

  it("answers nulls for a project that configured nothing", () => {
    expect(browserOptionsOf(EMPTY_CONFIG, "darwin")).toEqual({
      browserExecutable: null,
      chromeMode: null,
      chromiumOptions: { gl: DESKTOP_GL },
      timeoutInMilliseconds: null,
    });
  });
});

describe("prepareBrowser", () => {
  it("keeps angle when the browser really can make a context", async () => {
    const { asked, probe } = probing(["webgl2"]);

    const reading = await Effect.runPromise(
      prepareBrowser({
        config: EMPTY_CONFIG,
        internals: INTERNALS,
        onEvent: () => undefined,
        platform: "darwin",
        probe,
        renderer: renderer(),
      })
    );

    expect(asked).toEqual([DESKTOP_GL]);
    expect(reading.context).toEqual({
      gl: DESKTOP_GL,
      glSource: "studio",
      support: "webgl2",
    });
    expect(reading.note).toBeNull();
  });

  it("falls back to software when the studio's own choice cannot", async () => {
    const { asked, probe } = probing(["none", "webgl2"]);

    const reading = await Effect.runPromise(
      prepareBrowser({
        config: EMPTY_CONFIG,
        internals: INTERNALS,
        onEvent: () => undefined,
        platform: "darwin",
        probe,
        renderer: renderer(),
      })
    );

    expect(asked).toEqual([DESKTOP_GL, SOFTWARE_GL]);
    expect(reading.options.chromiumOptions.gl).toBe(SOFTWARE_GL);
    expect(reading.context.support).toBe("webgl2");
    expect(reading.note).toContain(SOFTWARE_GL);
  });

  it("never substitutes for a backend the project chose", async () => {
    const { asked, probe } = probing(["none"]);

    const reading = await Effect.runPromise(
      prepareBrowser({
        config: configured({ chromium: { gl: "vulkan" } }),
        internals: INTERNALS,
        onEvent: () => undefined,
        platform: "darwin",
        probe,
        renderer: renderer(),
      })
    );

    expect(asked).toEqual(["vulkan"]);
    expect(reading.options.chromiumOptions.gl).toBe("vulkan");
    expect(reading.context.glSource).toBe("config");
    expect(reading.note).toBeNull();
  });

  it("says so when neither backend can draw", async () => {
    const { probe } = probing(["none", "none"]);

    const reading = await Effect.runPromise(
      prepareBrowser({
        config: EMPTY_CONFIG,
        internals: INTERNALS,
        onEvent: () => undefined,
        platform: "darwin",
        probe,
        renderer: renderer(),
      })
    );

    expect(reading.options.chromiumOptions.gl).toBe(DESKTOP_GL);
    expect(reading.context.support).toBe("none");
    expect(reading.note).toContain("neither");
  });

  it("does not probe a Remotion that cannot open a page for it", async () => {
    const { asked, probe } = probing(["webgl2"]);

    const reading = await Effect.runPromise(
      prepareBrowser({
        config: EMPTY_CONFIG,
        internals: null,
        onEvent: () => undefined,
        platform: "darwin",
        probe,
        renderer: renderer(),
      })
    );

    expect(asked).toEqual([]);
    expect(reading.context.support).toBe("unknown");
  });

  it("provisions the browser before it asks the browser anything", async () => {
    const made = renderer();
    const { probe } = probing(["webgl2"]);

    await Effect.runPromise(
      prepareBrowser({
        config: EMPTY_CONFIG,
        internals: INTERNALS,
        onEvent: () => undefined,
        platform: "darwin",
        probe,
        renderer: made,
      })
    );

    expect(made.seen.length).toBe(1);
  });
});

describe("signatureOf", () => {
  it("changes with the backend and nothing else", () => {
    const base = browserOptionsOf(EMPTY_CONFIG, "darwin");
    const same = browserOptionsOf(EMPTY_CONFIG, "win32");
    const other = browserOptionsOf(EMPTY_CONFIG, "linux");

    expect(signatureOf(base)).toBe(signatureOf(same));
    expect(signatureOf(base)).not.toBe(signatureOf(other));
  });
});

describe("sharedBrowser", () => {
  const options = browserOptionsOf(EMPTY_CONFIG, "darwin");

  function opener() {
    const state = { closed: 0, opened: [] as Record<string, unknown>[] };

    return {
      openBrowser: (_browser: "chrome", given: Record<string, unknown>) => {
        state.opened.push(given);
        return Promise.resolve({
          close: () => {
            state.closed += 1;
            return Promise.resolve();
          },
        });
      },
      state,
    };
  }

  it("opens one browser with the policy's own options", async () => {
    const made = opener();

    await Effect.runPromise(
      Effect.scoped(sharedBrowser(made, options).pipe(Effect.asVoid))
    );

    expect(made.state.opened).toHaveLength(1);
    expect(made.state.opened[0]?.chromiumOptions).toEqual(
      options.chromiumOptions
    );
    expect(made.state.opened[0]?.browserExecutable).toBeNull();
    expect(made.state.opened[0]).not.toHaveProperty("forceDeviceScaleFactor");
  });

  it("opens at the export's scale, as the renderer's own browser would", async () => {
    const made = opener();

    await Effect.runPromise(
      Effect.scoped(sharedBrowser(made, options, 1.5).pipe(Effect.asVoid))
    );

    expect(made.state.opened[0]?.forceDeviceScaleFactor).toBe(1.5);
  });

  it("closes it when the render ends, whether or not it failed", async () => {
    const made = opener();

    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.andThen(sharedBrowser(made, options), Effect.fail("encoder"))
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(made.state.closed).toBe(1);
  });

  it("hands back nothing when this renderer cannot open a browser", async () => {
    const browser = await Effect.runPromise(
      Effect.scoped(sharedBrowser({}, options))
    );
    const failing = await Effect.runPromise(
      Effect.scoped(
        sharedBrowser(
          { openBrowser: () => Promise.reject(new Error("no chrome")) },
          options
        )
      )
    );

    expect(browser).toBeNull();
    expect(failing).toBeNull();
  });
});
