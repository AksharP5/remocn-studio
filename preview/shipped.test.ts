import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PREVIEW = "../preview/";
const SOURCE_FILE = /\.(ts|tsx|cjs)$/;

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

  // preview/ is compiled by the *project's* webpack (CLAUDE.md), so a relative
  // import that reaches outside preview/ needs its own resource entry too, or
  // a clean install fails to compile it the same way 0.8.0 failed on a preview
  // file itself. geometry.ts and geometry-target.ts reach into
  // shared/studio-geometry.ts today; this stays true for whatever they, or a
  // later preview file, reach for next.
  it("packages every file outside preview/ that preview code imports", () => {
    const root = path.resolve(import.meta.dir, "..");
    const config = JSON.parse(
      readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8")
    ) as { bundle: { resources: Record<string, string> } };
    const resourceKeys = new Set(Object.keys(config.bundle.resources));

    const previewDir = path.join(root, "preview");
    const files = readdirSync(previewDir).filter(
      (name) => !name.includes(".test.") && SOURCE_FILE.test(name)
    );
    const specifierPattern = /(?:from|require\()\s*["'](\.\.\/[^"']+)["']/g;
    const external = new Set<string>();
    for (const file of files) {
      const source = readFileSync(path.join(previewDir, file), "utf8");
      for (const match of source.matchAll(specifierPattern)) {
        external.add(match[1]);
      }
    }

    expect(external.size).toBeGreaterThan(0);
    for (const specifier of external) {
      const resolved = path.normalize(path.join("preview", specifier));
      const candidates = ["", ".ts", ".tsx", ".cjs"].map(
        (extension) => `../${resolved}${extension}`
      );
      const shippedAs = candidates.find((candidate) =>
        resourceKeys.has(candidate)
      );
      expect(
        shippedAs,
        `${specifier} is imported by a preview/ file but has no resources entry in tauri.conf.json`
      ).toBeDefined();
    }
  });
});
