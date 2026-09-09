import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyBrand } from "@/shared/brand";
import {
  confirmBrandApplication,
  finishBrandApplication,
  prepareBrandApplication,
} from "./apply";
import {
  brandBrief,
  importBrandFile,
  readSnapshot,
  snapshotOf,
  writeSnapshot,
} from "./brand";
import { getConfig, readManifest, saveConfig } from "./config";

const roots: string[] = [];
async function project() {
  const path = await mkdtemp(join(tmpdir(), "remocn-brand-test-"));
  roots.push(path);
  await writeFile(join(path, "package.json"), "{}");
  return { id: crypto.randomUUID(), name: "Original", path };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

describe("project configuration", () => {
  it("reads legacy projects without creating a manifest, then saves a trimmed human name", async () => {
    const p = await project();
    expect((await getConfig(p)).brand).toBeNull();
    expect(await readManifest(p.path)).toBeNull();
    const saved = await saveConfig(p, {
      brand: null,
      expectedRevision: 0,
      name: "  Мой продукт — 2026  ",
      projectId: p.id,
    });
    expect(saved.name).toBe("Мой продукт — 2026");
    expect(saved.revision).toBe(1);
    expect((await readManifest(p.path))?.projectId).toBe(p.id);
    await expect(
      saveConfig(p, {
        brand: null,
        expectedRevision: 1,
        name: "  ",
        projectId: p.id,
      })
    ).rejects.toThrow();
  });
  it("accepts only one concurrent save at the same revision", async () => {
    const p = await project();
    const results = await Promise.allSettled(
      ["One", "Two"].map((name) =>
        saveConfig(p, {
          brand: null,
          expectedRevision: 0,
          name,
          projectId: p.id,
        })
      )
    );
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1);
    expect((await readManifest(p.path))?.revision).toBe(1);
  });
  it("refuses identity changes and symlinks outside managed storage", async () => {
    const p = await project();
    const outside = await project();
    await symlink(outside.path, join(p.path, ".remocn"));
    await expect(
      saveConfig(p, {
        brand: null,
        expectedRevision: 0,
        name: "New",
        projectId: p.id,
      })
    ).rejects.toThrow("leaves the project");
    expect(await readManifest(outside.path)).toBeNull();
    await expect(
      saveConfig(outside, {
        brand: null,
        expectedRevision: 0,
        name: "New",
        projectId: p.id,
      })
    ).rejects.toThrow("another project");
  });
  it("keeps original logo bytes and old video branding after replacement and clearing", async () => {
    const p = await project();
    const source = join(p.path, "logo.svg");
    const original =
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
    await writeFile(source, original);
    const logo = await importBrandFile(p.path, source);
    expect(await importBrandFile(p.path, source)).toEqual(logo);
    const brand = { ...emptyBrand(), logos: { mark: logo } };
    const config = await saveConfig(p, {
      brand,
      expectedRevision: 0,
      name: p.name,
      projectId: p.id,
    });
    await mkdir(join(p.path, "src/videos/one"), { recursive: true });
    await writeSnapshot(p.path, "one", snapshotOf(config));
    await writeFile(source, '<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect((await importBrandFile(p.path, source)).path).not.toBe(logo.path);
    await saveConfig(p, {
      brand: null,
      expectedRevision: 1,
      name: p.name,
      projectId: p.id,
    });
    expect((await readSnapshot(p.path, "one"))?.brand).toEqual(brand);
    expect(await readFile(join(p.path, logo.path), "utf8")).toBe(original);
    expect(await brandBrief(p.path, p.id, "legacy")).toBeNull();
    expect(await brandBrief(p.path, p.id, "one")).toContain(logo.path);
    await writeFile(join(p.path, logo.path), "corrupt");
    await expect(brandBrief(p.path, p.id, "one")).rejects.toThrow(
      "missing or changed"
    );
  });
  it("does not confirm failed work and requires review of a successful update", async () => {
    const p = await project();
    const config = await getConfig(p);
    const application = await prepareBrandApplication(p.path, "one", config);
    await finishBrandApplication(p.path, "one", application, false);
    await expect(
      confirmBrandApplication(p.path, "one", p.id, 0)
    ).rejects.toThrow("not ready");
    expect(await readSnapshot(p.path, "one")).toBeNull();
    await finishBrandApplication(p.path, "one", application, true);
    expect(await readSnapshot(p.path, "one")).toBeNull();
    await confirmBrandApplication(p.path, "one", p.id, 0);
    expect((await readSnapshot(p.path, "one"))?.projectId).toBe(p.id);
  });
});

it("keeps assets portable with a nested Remotion root", async () => {
  const p = await project();
  await mkdir(join(p.path, "apps/video"), { recursive: true });
  await writeFile(join(p.path, "apps/video/remotion.config.ts"), "export {};");
  await writeFile(
    join(p.path, "logo.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
  );
  const file = await importBrandFile(p.path, join(p.path, "logo.svg"));
  expect(file.path.startsWith("apps/video/public/brand/")).toBe(true);
  const brand = { ...emptyBrand(), logos: { mark: file } };
  const config = await saveConfig(p, {
    brand,
    expectedRevision: 0,
    name: p.name,
    projectId: p.id,
  });
  await writeSnapshot(p.path, "one", snapshotOf(config));
  expect((await readSnapshot(p.path, "one"))?.brand?.logos.mark?.path).toBe(
    file.path
  );
});
it("rejects fonts whose header is plausible but contents are corrupt", async () => {
  const p = await project();
  await writeFile(join(p.path, "broken.woff"), "wOFFcorrupt font bytes");
  await expect(
    importBrandFile(p.path, join(p.path, "broken.woff"))
  ).rejects.toThrow("could not be decoded");
});
