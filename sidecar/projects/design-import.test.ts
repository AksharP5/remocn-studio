import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyBrand } from "@/shared/brand";
import {
  applyDesignImport,
  initialDesignSelection,
  selectionError,
} from "@/shared/design-import";
import { brandBrief, readSnapshot, snapshotOf, writeSnapshot } from "./brand";
import { getConfig, hashBytes, readManifest, saveConfig } from "./config";
import { importDesignMarkdown, parseDesignMarkdown } from "./design-import";

const markdown = `---
version: alpha
name: Daylight
colors:
  primary: "#abc"
  accent: "{colors.primary}"
  foreground: "rgb(255 0 0 / 50%)"
  background: "oklch(100% 0 0)"
typography:
  h1:
    fontFamily: Public Sans
    fontWeight: 600
---
## Layout
Use generous whitespace.
## Components
Keep buttons understated.
`;
const roots: string[] = [];
afterEach(() =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  )
);

describe("DESIGN.md", () => {
  it("resolves tokens and normalizes CSS colors without inferring font files", () => {
    const result = parseDesignMarkdown(markdown);
    expect(result.colors).toEqual({
      accent: "#aabbcc",
      background: "#ffffff",
      foreground: "#ff000080",
      primary: "#aabbcc",
    });
    expect(result.fonts).toEqual([
      { family: "Public Sans", token: "h1", weight: "600" },
    ]);
    expect(result.warnings.join(" ")).toContain(
      "Font names do not include font files"
    );
  });
  it("accepts prose-only documents and preserves unknown token guidance", () => {
    const result = parseDesignMarkdown("## Colors\nUse red, or perhaps blue.");
    expect(result.colors).toEqual({});
    expect(parseDesignMarkdown("---\n---\n## Layout\nQuiet").colors).toEqual(
      {}
    );
    expect(() => parseDesignMarkdown("---\n- one\n---\n")).toThrow("mapping");
    expect(() => parseDesignMarkdown("---\ncolors: red\n---\n")).toThrow(
      "mapping"
    );
    expect(result.warnings.join(" ")).toContain("No YAML tokens");
    expect(
      parseDesignMarkdown(
        "---\ncolors:\n  accent: 'var(--accent)'\n---\n"
      ).warnings.join(" ")
    ).toContain("skipped");
  });
  it("rejects duplicate keys, unknown/circular references and incomplete front matter", () => {
    expect(() =>
      parseDesignMarkdown("---\nname: one\nname: two\n---\n")
    ).toThrow("Invalid");
    expect(() =>
      parseDesignMarkdown(
        "---\ncolors:\n  a: '{colors.b}'\n  b: '{colors.a}'\n---\n"
      )
    ).toThrow("Circular");
    expect(() =>
      parseDesignMarkdown("---\ncolors:\n  a: '{colors.missing}'\n---\n")
    ).toThrow("Unknown");
    expect(() => parseDesignMarkdown("---\r\nname: unfinished")).toThrow(
      "closing"
    );
    expect(() => parseDesignMarkdown("x".repeat(256 * 1024 + 1))).toThrow(
      "256 KB"
    );
  });
  it("keeps current fields unless selected and rejects duplicate destination roles", () => {
    const data = {
      ...parseDesignMarkdown(markdown),
      document: {
        file: {
          hash: hashBytes(markdown),
          path: "public/brand/test/DESIGN.md",
        },
        markdown,
      },
    };
    const current = {
      ...emptyBrand(),
      colors: { accent: "#112233" },
      name: "Existing",
    };
    const selection = initialDesignSelection(data, current);
    expect(applyDesignImport(current, data, selection).colors.accent).toBe(
      "#112233"
    );
    expect(applyDesignImport(current, data, selection).name).toBe("Existing");
    selection.colors = selection.colors.map((entry) => ({
      ...entry,
      selected: true,
    }));
    selection.fonts = [{ role: "display", token: "h1" }];
    const applied = applyDesignImport(current, data, selection);
    expect(applied.colors.accent).toBe("#aabbcc");
    expect(applied.typography.display?.files).toEqual([]);
    expect(current.colors.accent).toBe("#112233");
    expect(applyDesignImport(applied, data, selection).provenance).toHaveLength(
      1
    );
    expect(
      selectionError({
        ...selection,
        colors: [
          { role: "accent", selected: true, token: "a" },
          { role: "accent", selected: true, token: "b" },
        ],
      })
    ).toContain("only once");
  });
  it("stages immutable source bytes, preserves draft cancellation and pins portable snapshots", async () => {
    const root = await mkdtemp(join(tmpdir(), "remocn-design-"));
    roots.push(root);
    const path = join(root, "project");
    await mkdir(path);
    await writeFile(join(path, "package.json"), "{}");
    const source = join(root, "DESIGN.md");
    await writeFile(source, `\uFEFF${markdown}`);
    const data = await importDesignMarkdown(path, source);
    expect(await readFile(join(path, data.document.file.path), "utf8")).toBe(
      data.document.markdown
    );
    expect(await readManifest(path)).toBeNull();
    const project = { id: "project-id", name: "Original", path };
    const brand = applyDesignImport(
      null,
      data,
      initialDesignSelection(data, null)
    );
    const config = await saveConfig(project, {
      brand,
      expectedRevision: 0,
      name: project.name,
      projectId: project.id,
    });
    await writeSnapshot(path, "one", snapshotOf(config));
    await writeFile(source, markdown.replace("Daylight", "Night"));
    const replacement = await importDesignMarkdown(path, source);
    expect(replacement.document.file.path).not.toBe(data.document.file.path);
    await saveConfig(project, {
      brand: null,
      expectedRevision: 1,
      name: project.name,
      projectId: project.id,
    });
    const moved = join(root, "moved");
    await rename(path, moved);
    expect((await getConfig({ ...project, path: moved })).brand).toBeNull();
    expect((await readSnapshot(moved, "one"))?.brand?.design?.markdown).toBe(
      data.document.markdown
    );
    expect(await brandBrief(moved, project.id, "one")).toContain(
      "generous whitespace"
    );
  });
});
