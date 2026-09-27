import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { EMPTY_CONFIG, type ResolvedConfig } from "./config";
import { fingerprintOf, makeConfigCache } from "./config-host";

const made: string[] = [];

afterEach(() => {
  for (const created of made.splice(0)) {
    rmSync(created, { force: true, recursive: true });
  }
});

function project(config: string | null): string {
  const root = mkdtempSync(path.join(tmpdir(), "remocn-config-"));
  made.push(root);

  if (config !== null) {
    writeFileSync(path.join(root, "remotion.config.ts"), config);
  }

  return root;
}

function counting(answer: () => ResolvedConfig) {
  const state = { reads: 0 };

  return {
    resolve: (_root: string) =>
      Effect.sync(() => {
        state.reads += 1;
        return answer();
      }),
    state,
  };
}

describe("fingerprintOf", () => {
  it("moves when the config file does", () => {
    const root = project("export {}");
    const first = fingerprintOf(root);

    writeFileSync(
      path.join(root, "remotion.config.ts"),
      "// a longer config file than the first"
    );

    expect(fingerprintOf(root)).not.toBe(first);
  });

  it("says the same thing about a project with no config at all", () => {
    expect(fingerprintOf(project(null))).toBe("none");
  });

  it("moves when a local file the config imports does", () => {
    const root = project(
      'import { override } from "./webpack-override";\nexport {}'
    );
    writeFileSync(path.join(root, "webpack-override.ts"), "export {}");
    const first = fingerprintOf(root);

    writeFileSync(
      path.join(root, "webpack-override.ts"),
      "export const override = (config) => config;"
    );

    expect(fingerprintOf(root)).not.toBe(first);
  });

  it("moves when the project's package.json does, as an upgrade would", () => {
    const root = project("export {}");
    writeFileSync(path.join(root, "package.json"), "{}");
    const first = fingerprintOf(root);

    writeFileSync(
      path.join(root, "package.json"),
      '{"dependencies":{"remotion":"4.0.521"}}'
    );

    expect(fingerprintOf(root)).not.toBe(first);
  });

  it("ignores a package import, which the file walk cannot follow", () => {
    const root = project('import { Config } from "@remotion/cli/config";');

    expect(fingerprintOf(root).split("|")).toHaveLength(2);
  });
});

describe("makeConfigCache", () => {
  it("reads a project's settings once while nothing has changed", async () => {
    const root = project("export {}");
    const { resolve, state } = counting(() => EMPTY_CONFIG);
    const cache = makeConfigCache(resolve);

    await Effect.runPromise(cache.read(root));
    await Effect.runPromise(cache.read(root));

    expect(state.reads).toBe(1);
  });

  it("reads again once remotion.config.ts has been edited", async () => {
    const root = project("export {}");
    const { resolve, state } = counting(() => EMPTY_CONFIG);
    const cache = makeConfigCache(resolve);

    await Effect.runPromise(cache.read(root));
    writeFileSync(
      path.join(root, "remotion.config.ts"),
      "// edited since the last render"
    );
    await Effect.runPromise(cache.read(root));

    expect(state.reads).toBe(2);
  });

  it("always reads fresh when the caller insists", async () => {
    const root = project("export {}");
    const { resolve, state } = counting(() => EMPTY_CONFIG);
    const cache = makeConfigCache(resolve);

    await Effect.runPromise(cache.read(root));
    await Effect.runPromise(cache.read(root, true));

    expect(state.reads).toBe(2);
  });

  it("hands back what it read rather than re-deriving it", async () => {
    const root = project(null);
    const answer: ResolvedConfig = { ...EMPTY_CONFIG, version: "4.0.520" };
    const { resolve } = counting(() => answer);
    const cache = makeConfigCache(resolve);

    expect(await Effect.runPromise(cache.read(root))).toBe(answer);
  });

  it("forgets on demand", async () => {
    const root = project("export {}");
    const { resolve, state } = counting(() => EMPTY_CONFIG);
    const cache = makeConfigCache(resolve);

    await Effect.runPromise(cache.read(root));
    cache.forget();
    await Effect.runPromise(cache.read(root));

    expect(state.reads).toBe(2);
  });
});
