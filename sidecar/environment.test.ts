// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { accountRow } from "./claude/account";
import {
  checksFor,
  dependencyRow,
  driftFrom,
  entryRow,
  managerRow,
  manifestOf,
  missingFrom,
  remotionRow,
  TUNABLE_TEXT_VERSION,
  upgradable,
  versionOf,
} from "./environment";

let folder = "";

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "remocn-env-"));
});

afterEach(async () => {
  await rm(folder, { force: true, recursive: true });
});

const write = (file: string, body: unknown) =>
  writeFile(path.join(folder, file), JSON.stringify(body));

describe("managerRow", () => {
  it("passes a manager that is on the machine", () => {
    expect(
      managerRow({ lockfile: null, manager: "bun", root: "/p" }, "/bin/bun")
    ).toMatchObject({
      fix: null,
      state: "ok",
    });
  });

  it("names the lockfile that chose the manager", () => {
    const row = managerRow(
      { lockfile: "/p/package-lock.json", manager: "npm", root: "/p" },
      "/usr/bin/npm"
    );

    expect(row.detail).toContain("package-lock.json");
  });

  it("offers Node itself when the project needs npm and npm is not there", () => {
    const row = managerRow(
      { lockfile: "/p/package-lock.json", manager: "npm", root: "/p" },
      null
    );

    expect(row).toMatchObject({
      fix: { type: "node" },
      state: "failed",
      title: "Node.js (npm) is not installed",
    });
  });

  it("refuses to install another project's dependencies with the shipped bun", () => {
    const row = managerRow(
      { lockfile: "/p/pnpm-lock.yaml", manager: "pnpm", root: "/p" },
      null
    );

    expect(row.state).toBe("failed");
    expect(row.detail).toContain("pnpm install");
  });
});

describe("manifestOf", () => {
  it("is null when there is no package.json", async () => {
    expect(await Effect.runPromise(manifestOf(folder))).toBeNull();
  });

  it("is null when package.json does not parse", async () => {
    await writeFile(path.join(folder, "package.json"), "{ not json");

    expect(await Effect.runPromise(manifestOf(folder))).toBeNull();
  });

  it("collects every dependency field and picks out remotion", async () => {
    await write("package.json", {
      dependencies: { react: "19.2.8", remotion: "4.0.360" },
      devDependencies: { typescript: "5" },
    });

    const manifest = await Effect.runPromise(manifestOf(folder));

    expect(manifest?.remotion).toBe("4.0.360");
    expect([...(manifest?.dependencies ?? [])].sort()).toEqual([
      "react",
      "remotion",
      "typescript",
    ]);
  });
});

describe("remotionRow", () => {
  it("explains a folder with no package.json", () => {
    const check = remotionRow(folder, null);

    expect(check.state).toBe("failed");
    expect(check.title).toBe("This folder is not a Remotion project");
  });

  it("explains a package.json that does not depend on remotion", () => {
    const check = remotionRow(folder, {
      dependencies: ["react"],
      remotion: null,
    });

    expect(check.state).toBe("failed");
    expect(check.detail).toContain("package.json");
  });

  it("passes a Remotion new enough to declare its own typography", () => {
    const check = remotionRow(folder, {
      dependencies: ["remotion"],
      remotion: "4.0.520",
    });

    expect(check).toMatchObject({ fix: null, state: "ok" });
  });

  it("passes a caret range at the floor itself", () => {
    const check = remotionRow(folder, {
      dependencies: ["remotion"],
      remotion: "^4.0.513",
    });

    expect(check.state).toBe("ok");
  });

  it("warns below the floor and offers the upgrade, without blocking", () => {
    const check = remotionRow(folder, {
      dependencies: ["@remotion/cli", "@remotion/player", "react", "remotion"],
      remotion: "4.0.481",
    });

    expect(check).toMatchObject({
      fix: {
        packages: ["@remotion/cli", "@remotion/player", "remotion"],
        type: "upgrade",
        version: TUNABLE_TEXT_VERSION,
      },
      state: "warn",
    });
    expect(check.detail).toContain("4.0.481");
  });

  it("reads what is installed rather than what the range allows", async () => {
    const home = path.join(folder, "node_modules", "remotion");
    await mkdir(home, { recursive: true });
    await writeFile(
      path.join(home, "package.json"),
      JSON.stringify({ name: "remotion", version: "4.0.520" })
    );

    const check = remotionRow(folder, {
      dependencies: ["remotion"],
      remotion: "^4.0.481",
    });

    expect(check).toMatchObject({ fix: null, state: "ok" });
  });

  it("warns on a caret range whose installed copy is still below the floor", async () => {
    const home = path.join(folder, "node_modules", "remotion");
    await mkdir(home, { recursive: true });
    await writeFile(
      path.join(home, "package.json"),
      JSON.stringify({ name: "remotion", version: "4.0.481" })
    );

    const check = remotionRow(folder, {
      dependencies: ["remotion"],
      remotion: "^4.0.500",
    });

    expect(check.state).toBe("warn");
    expect(check.detail).toContain("4.0.481");
  });

  it("stays ok on a range it cannot read rather than guessing", () => {
    const check = remotionRow(folder, {
      dependencies: ["remotion"],
      remotion: "workspace:*",
    });

    expect(check).toMatchObject({ fix: null, state: "ok" });
  });
});

describe("versionOf", () => {
  it("reads a plain version and the ranges a manifest usually carries", () => {
    expect(versionOf("4.0.481")).toEqual([4, 0, 481]);
    expect(versionOf("^4.0.513")).toEqual([4, 0, 513]);
    expect(versionOf("~4.0.520")).toEqual([4, 0, 520]);
    expect(versionOf(">= 4.0.520")).toEqual([4, 0, 520]);
  });

  it("gives up rather than guessing at anything else", () => {
    expect(versionOf("*")).toBeNull();
    expect(versionOf("4.x")).toBeNull();
    expect(versionOf("workspace:*")).toBeNull();
    expect(versionOf("npm:remotion@4.0.520")).toBeNull();
  });
});

describe("upgradable", () => {
  it("names every @remotion package the manifest declares, plus remotion", () => {
    expect(
      upgradable({
        dependencies: [
          "react",
          "@remotion/zod-types",
          "@remotion/bundler",
          "remotion",
        ],
        remotion: "4.0.481",
      })
    ).toEqual(["@remotion/bundler", "@remotion/zod-types", "remotion"]);
  });
});

describe("missingFrom", () => {
  const install = async (where: string, name: string) => {
    await mkdir(path.join(where, "node_modules", name), { recursive: true });
    await writeFile(
      path.join(where, "node_modules", name, "package.json"),
      JSON.stringify({ name, version: "1.0.0" })
    );
  };

  it("names what is not in node_modules", () => {
    expect([...missingFrom(folder, ["remotion", "react"])].sort()).toEqual([
      "react",
      "remotion",
    ]);
  });

  it("counts a package that is actually there", async () => {
    await install(folder, "remotion");

    expect(missingFrom(folder, ["remotion"])).toEqual([]);
  });

  it("handles a scoped name", async () => {
    await install(folder, "@remotion/bundler");

    expect(missingFrom(folder, ["@remotion/bundler"])).toEqual([]);
  });

  it("accepts a copy hoisted to a workspace root above the project", async () => {
    const workspace = path.join(folder, "packages/video");
    await mkdir(workspace, { recursive: true });
    await install(folder, "remotion");

    expect(missingFrom(workspace, ["remotion"])).toEqual([]);
  });

  it("does not count a package only a sibling cache can resolve, the way bun's global cache does", async () => {
    await install(path.join(folder, "cache"), "typescript");

    expect(missingFrom(folder, ["typescript"])).toEqual(["typescript"]);
  });

  it("does not count a folder with no package.json in it", async () => {
    await mkdir(path.join(folder, "node_modules/hollow"), { recursive: true });

    expect(missingFrom(folder, ["hollow"])).toEqual(["hollow"]);
  });
});

describe("dependencyRow", () => {
  it("offers the install button and counts what is missing", () => {
    const check = dependencyRow(["a", "b"], 10, null);

    expect(check.state).toBe("failed");
    expect(check.fix).toEqual({ type: "install" });
    expect(check.detail).toContain("2 of 10");
  });

  it("names at most four and says how many more", () => {
    const check = dependencyRow(["a", "b", "c", "d", "e", "f"], 6, null);

    expect(check.detail).toContain("and 2 more");
  });

  it("warns rather than fails when only the lockfile drifted", () => {
    const check = dependencyRow([], 10, "lockfile had changes");

    expect(check.state).toBe("warn");
    expect(check.fix).toEqual({ type: "install" });
  });

  it("passes when everything resolves and nothing drifted", () => {
    expect(dependencyRow([], 10, null).state).toBe("ok");
  });
});

describe("driftFrom", () => {
  it("is silent when bun is happy", () => {
    expect(driftFrom(0, "bun install v1.3.2")).toBeNull();
  });

  it("reports a frozen lockfile that had changes", () => {
    const drift = driftFrom(
      1,
      "bun install v1.3.2\nerror: lockfile had changes, but lockfile is frozen\n"
    );

    expect(drift).toContain("lockfile had changes");
  });

  it("does not accuse the lockfile when bun failed for another reason", () => {
    expect(
      driftFrom(1, "error: failed to resolve nanoid@5.0.9 (network error)")
    ).toBeNull();
  });

  it("does not accuse the lockfile when bun said nothing at all", () => {
    expect(driftFrom(1, "")).toBeNull();
  });
});

describe("checksFor", () => {
  const account = accountRow({ subscriptionType: "Claude Max" });

  const idsOf = async () => {
    const checks = await Effect.runPromise(checksFor(folder, account));
    return checks.map((check) => check.id);
  };

  it("says a folder is not a Remotion project once, not three times", async () => {
    expect(await idsOf()).toEqual([
      "claude",
      "manager",
      "remotion",
      "compositions",
    ]);
  });

  it("still checks dependencies of a JS project that is not Remotion", async () => {
    await write("package.json", { dependencies: { react: "19.2.8" } });

    expect(await idsOf()).toEqual([
      "claude",
      "manager",
      "remotion",
      "dependencies",
      "compositions",
    ]);
  });

  it("asks for an entry point only once remotion is declared", async () => {
    await write("package.json", { dependencies: { remotion: "4.0.360" } });

    expect(await idsOf()).toContain("entry");
  });

  it("passes the account row through untouched", async () => {
    const checks = await Effect.runPromise(checksFor(folder, account));

    expect(checks[0]).toBe(account);
  });
});

describe("entryRow", () => {
  it("shows the entry relative to the Remotion root", () => {
    const check = entryRow(folder, path.join(folder, "src/index.ts"), "");

    expect(check).toMatchObject({ detail: "src/index.ts", state: "ok" });
  });

  it("carries the reason there is none", () => {
    const check = entryRow(folder, null, "no Remotion entry point");

    expect(check.state).toBe("failed");
    expect(check.detail).toBe("no Remotion entry point");
  });
});
