// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { staticFiles } from "@/sidecar/preview/statics";

let root = "";

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "statics-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

function write(relative: string, body = "x") {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, body);
}

describe("staticFiles", () => {
  it("names files the way staticFile() takes them", () => {
    write("bg.png");
    write("library/clip one.mp4");
    write("nested/deep/logo.svg");

    expect(staticFiles(root).files).toEqual([
      "bg.png",
      "library/clip one.mp4",
      "nested/deep/logo.svg",
    ]);
  });

  it("leaves out what nobody puts in public/ on purpose", () => {
    write("bg.png");
    write(".DS_Store");
    write(".cache/thing.png");

    expect(staticFiles(root).files).toEqual(["bg.png"]);
  });

  it("says when it stopped rather than trimming in silence", () => {
    write("a.png");
    write("b.png");
    write("c.png");

    expect(staticFiles(root, 2)).toEqual({
      files: ["a.png", "b.png"],
      truncated: true,
    });
  });

  // A project with no `public/` is the ordinary state of a new one.
  it("is empty for a folder that is not there", () => {
    expect(staticFiles(path.join(root, "nothing"))).toEqual({
      files: [],
      truncated: false,
    });
  });

  it("follows a symlinked folder, which is how a monorepo shares assets", () => {
    write("shared/logo.png");
    symlinkSync(path.join(root, "shared"), path.join(root, "linked"));

    expect(staticFiles(root).files).toContain("linked/logo.png");
  });
});
