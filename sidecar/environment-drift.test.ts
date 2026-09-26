import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";

const spawned: string[][] = [];
const real = { ...(await import("node:child_process")) };

mock.module("node:child_process", () => ({
  ...real,
  spawn: (command: string, args: string[], options: object) => {
    spawned.push(args);
    return real.spawn(command, args, options);
  },
}));

const { lockfileDrift } = await import("./environment");

let folder = "";

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "remocn-drift-"));
  spawned.length = 0;
});

afterEach(async () => {
  await rm(folder, { force: true, recursive: true });
});

const project = () => ({
  lockfile: path.join(folder, "bun.lock"),
  manager: "bun" as const,
  root: folder,
});

describe("lockfileDrift", () => {
  it("asks bun once while package.json and the lockfile stay as they are", async () => {
    await writeFile(path.join(folder, "package.json"), "{}");
    await writeFile(path.join(folder, "bun.lock"), "{}");

    const first = await Effect.runPromise(lockfileDrift(project()));
    const second = await Effect.runPromise(lockfileDrift(project()));

    expect(second).toBe(first);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toContain("--frozen-lockfile");
  });

  it("asks again once package.json has changed", async () => {
    await writeFile(path.join(folder, "package.json"), "{}");
    await writeFile(path.join(folder, "bun.lock"), "{}");

    await Effect.runPromise(lockfileDrift(project()));
    await writeFile(
      path.join(folder, "package.json"),
      JSON.stringify({ dependencies: { remotion: "4.0.520" } })
    );
    await Effect.runPromise(lockfileDrift(project()));

    expect(spawned).toHaveLength(2);
  });
});
