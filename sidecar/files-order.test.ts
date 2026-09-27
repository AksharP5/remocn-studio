import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const readdirSync = fs.readdirSync;

mock.module("node:fs", () => ({
  ...fs,
  readdirSync: (...args: Parameters<typeof readdirSync>) =>
    [...(readdirSync(...args) as unknown[])].reverse(),
}));

const { walkProject } = await import("./files");

let root = "";

beforeAll(() => {
  root = fs.mkdtempSync(join(tmpdir(), "remocn-files-order-"));
  for (const relative of ["package.json", "public/logo.png", "src/Root.tsx"]) {
    const full = join(root, relative);
    fs.mkdirSync(join(full, ".."), { recursive: true });
    fs.writeFileSync(full, "");
  }
});

afterAll(() => {
  fs.rmSync(root, { force: true, recursive: true });
});

describe("walkProject on a file system that lists entries in any order", () => {
  it("stops at the same files, in name order", () => {
    expect(walkProject(root, 2)).toEqual({
      files: ["package.json", "public/logo.png"],
      truncated: true,
    });
  });
});
