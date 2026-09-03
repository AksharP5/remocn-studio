// @vitest-environment node
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { causeMessage } from "@/lib/error-message";
import type { PackageManager } from "@/sidecar/package-manager";
import {
  installDependencies,
  type Runner,
  type Spawner,
  upgradeArgs,
  upgradeDependencies,
} from "@/sidecar/scaffold/install";

interface Call {
  args: readonly string[];
  binary: string;
  cwd: string;
}

const LOCKFILES: Record<PackageManager, string> = {
  bun: "bun.lock",
  npm: "package-lock.json",
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
};

const REMOTION = ["@remotion/cli", "remotion"];

let folder = "";

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "remocn-install-"));
});

afterEach(async () => {
  await rm(folder, { force: true, recursive: true });
});

function spawner(calls: Call[], code: number): Spawner {
  const fake: Spawner = (binary, args, options) => {
    calls.push({ args: [...args], binary, cwd: options.cwd });

    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      kill: () => true,
      signalCode: null,
      stderr: null,
      stdout: null,
    });

    queueMicrotask(() => child.emit("exit", code, null));

    return child as unknown as ReturnType<Spawner>;
  };

  return fake;
}

function runner(
  calls: Call[],
  code = 0,
  binary: string | null = "/bin/manager"
): Runner {
  return { binary: () => binary, spawn: spawner(calls, code) };
}

async function project(manager: PackageManager) {
  await writeFile(
    path.join(folder, "package.json"),
    JSON.stringify({ name: "video" })
  );
  await writeFile(path.join(folder, LOCKFILES[manager]), "");
}

const lines = () => Effect.void;

describe("upgradeArgs", () => {
  it("pins every package with the version the fix names", () => {
    expect(upgradeArgs("bun", REMOTION, "4.0.520")).toEqual([
      "add",
      "@remotion/cli@4.0.520",
      "remotion@4.0.520",
    ]);
  });

  it("speaks each manager's own word for adding a package", () => {
    expect(upgradeArgs("npm", ["remotion"], "4.0.520")[0]).toBe("install");
    expect(upgradeArgs("pnpm", ["remotion"], "4.0.520")[0]).toBe("add");
    expect(upgradeArgs("yarn", ["remotion"], "4.0.520")[0]).toBe("add");
  });
});

describe("upgradeDependencies", () => {
  it("runs the manager the project's lockfile names, in its directory", async () => {
    await project("pnpm");
    const calls: Call[] = [];

    await Effect.runPromise(
      upgradeDependencies(folder, REMOTION, "4.0.520", lines, runner(calls))
    );

    expect(calls).toEqual([
      {
        args: ["add", "@remotion/cli@4.0.520", "remotion@4.0.520"],
        binary: "/bin/manager",
        cwd: folder,
      },
    ]);
  });

  it("adds in the manifest the checklist reads, not at the workspace root", async () => {
    await writeFile(
      path.join(folder, "package.json"),
      JSON.stringify({ name: "workspace", workspaces: ["videos/*"] })
    );
    await writeFile(path.join(folder, LOCKFILES.pnpm), "");

    const member = path.join(folder, "videos", "intro");
    await mkdir(member, { recursive: true });
    await writeFile(
      path.join(member, "package.json"),
      JSON.stringify({ dependencies: { remotion: "4.0.481" }, name: "intro" })
    );

    const calls: Call[] = [];

    await Effect.runPromise(
      upgradeDependencies(member, REMOTION, "4.0.520", lines, runner(calls))
    );

    expect(calls[0]?.cwd).toBe(member);
  });

  it("uses npm's install for a project whose lockfile is npm's", async () => {
    await project("npm");
    const calls: Call[] = [];

    await Effect.runPromise(
      upgradeDependencies(folder, ["remotion"], "4.0.520", lines, runner(calls))
    );

    expect(calls[0]?.args).toEqual(["install", "remotion@4.0.520"]);
  });

  it("says the manager is missing rather than substituting another", async () => {
    await project("yarn");

    const exit = await Effect.runPromiseExit(
      upgradeDependencies(
        folder,
        ["remotion"],
        "4.0.520",
        lines,
        runner([], 0, null)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("yarn");
    }
  });

  it("names the command that failed, not the one it did not run", async () => {
    await project("bun");
    const calls: Call[] = [];

    const exit = await Effect.runPromiseExit(
      upgradeDependencies(
        folder,
        ["remotion"],
        "4.0.520",
        lines,
        runner(calls, 1)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("bun add");
    }
  });

  it("refuses an empty list rather than running a bare add", async () => {
    await project("bun");
    const calls: Call[] = [];

    const exit = await Effect.runPromiseExit(
      upgradeDependencies(folder, [], "4.0.520", lines, runner(calls))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe("installDependencies", () => {
  it("still runs a plain install, in the lockfile's own directory", async () => {
    await project("npm");
    const calls: Call[] = [];

    await Effect.runPromise(installDependencies(folder, lines, runner(calls)));

    expect(calls).toEqual([
      { args: ["install"], binary: "/bin/manager", cwd: folder },
    ]);
  });
});
