import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PREVIEW = "../preview/";

// The packaged app compiles the preview from `Resources/preview`, and Tauri
// copies only the files its config names one by one. 0.8.0 named fourteen of
// sixteen — `assets.ts` and `stack.ts` were new — so every project's preview
// failed to compile on a clean install while a development build, reading the
// folder itself, never noticed. The list has to keep up with the folder.
describe("the preview runtime that ships", () => {
  it("names every file in the preview folder", () => {
    const root = path.resolve(import.meta.dir, "..");
    const config = JSON.parse(
      readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8")
    ) as { bundle: { resources: Record<string, string> } };

    const shipped = Object.keys(config.bundle.resources)
      .filter((source) => source.startsWith(PREVIEW))
      .map((source) => source.slice(PREVIEW.length))
      .sort();
    const sources = readdirSync(path.join(root, "preview"))
      .filter((name) => !name.includes(".test."))
      .sort();

    expect(shipped).toEqual(sources);
  });
});
