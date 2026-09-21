import { beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import {
  expandTemplate,
  expandVideo,
  packageName,
  REGISTRY_TEMPLATE,
  sized,
  VIDEO_TEMPLATE,
} from "@/sidecar/scaffold/template";

const TEMPLATE = join(process.cwd(), "templates", "remotion");
const RANGE_PREFIX = /^[\^~>=]+/;
const VIDEO_MODULE = join(TEMPLATE, VIDEO_TEMPLATE, "index.tsx");
const LANDSCAPE = { height: 1080, width: 1920 };
const VERTICAL = { height: 1920, width: 1080 };

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function folder(name: string) {
  const parent = await mkdtemp(join(tmpdir(), "remocn-template-"));
  return join(parent, name);
}

describe("the vendored template", () => {
  // Root.tsx is the project's own file in every project, scaffolded or not —
  // the scan lives beside it, in a file the studio wrote and owns.
  it("registers no composition of its own, and leaves Root for the person", async () => {
    const root = await readFile(join(TEMPLATE, "src", "Root.tsx"), "utf8");

    expect(root).not.toContain("require.context");
    expect(root).not.toContain("<Composition");
  });

  it("wraps its entry point in the scan, the way an opened project is", async () => {
    const entry = await readFile(join(TEMPLATE, "src", "index.ts"), "utf8");

    expect(entry).toContain('from "./videos/registry"');
    expect(entry).toContain("registerRoot(withVideos(Root));");
  });

  it("keeps the registry out of the project tree until it is placed", async () => {
    const registry = await readFile(join(TEMPLATE, REGISTRY_TEMPLATE), "utf8");

    expect(registry).toContain("require.context");
    expect(registry).toContain("export function withVideos");
  });

  it("registers a root from an entry point the preview looks for", async () => {
    const entry = await readFile(join(TEMPLATE, "src", "index.ts"), "utf8");

    expect(entry).toContain("registerRoot");
  });

  it("declares the video's dimensions as literals the wizard can rewrite", async () => {
    const video = await readFile(VIDEO_MODULE, "utf8");

    expect(sized(video, VERTICAL)).toContain("width: 1080");
    expect(sized(video, VERTICAL)).toContain("height: 1920");
  });

  it("declares independent properties and binds existing semantic roots", async () => {
    const video = await readFile(VIDEO_MODULE, "utf8");
    const data = JSON.parse(
      await readFile(join(TEMPLATE, VIDEO_TEMPLATE, "studio.json"), "utf8")
    );
    expect(video).toContain("<StudioObjects document={document}>");
    expect(video).toContain("{...object.bind}");
    expect(data.objects.map((object: { id: string }) => object.id)).toEqual([
      "backdrop",
      "heading",
      "subtitle",
    ]);
    expect(data.objects[1].values.fontSize).not.toBe(
      data.objects[2].values.fontSize
    );
    expect(
      data.definitions[0].fields.some(
        (field: { id: string }) => field.id === "entryDuration"
      )
    ).toBe(true);
  });

  it("pins remotion and every @remotion package to one version", async () => {
    const manifest = JSON.parse(
      await readFile(join(TEMPLATE, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };

    const pinned = Object.entries(manifest.dependencies).filter(
      ([name]) => name === "remotion" || name.startsWith("@remotion/")
    );

    expect(pinned.length).toBeGreaterThan(1);
    expect(new Set(pinned.map(([, range]) => range)).size).toBe(1);
  });

  it("scaffolds on a Remotion that can express text and typography", async () => {
    const manifest = JSON.parse(
      await readFile(join(TEMPLATE, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };

    const [major, minor, patch] = manifest.dependencies.remotion
      .replace(RANGE_PREFIX, "")
      .split(".")
      .map(Number);

    expect([major, minor]).toEqual([4, 0]);
    expect(patch).toBeGreaterThanOrEqual(513);
  });

  it("moves its text on X, through translate rather than transform", async () => {
    const video = await readFile(VIDEO_MODULE, "utf8");

    expect(video).not.toContain("transform:");
    expect(video).toContain("px 0px`");
  });
});

describe("sized", () => {
  it("says which file drifted rather than silently keeping the old size", () => {
    expect(() => sized("export const meta = {};", LANDSCAPE)).toThrow(
      VIDEO_TEMPLATE
    );
  });
});

describe("expandTemplate", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("writes the template into a folder that does not exist yet", async () => {
    const target = await folder("launch-film");

    await run(expandTemplate(target));

    const manifest = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as { dependencies: Record<string, string>; name: string };

    expect(manifest.name).toBe("launch-film");
    expect(manifest.dependencies.remotion).toBeDefined();
    expect(
      await readFile(join(target, "src/lib/studio-motion-v1/timing.ts"), "utf8")
    ).toContain("export function sequence");
    expect(await readFile(join(target, "src", "index.ts"), "utf8")).toContain(
      "registerRoot(withVideos(Root));"
    );
  });

  it("leaves the template's own scaffolding out of the project", async () => {
    const target = await folder("promo");

    await run(expandTemplate(target));

    await expect(
      readFile(join(target, VIDEO_TEMPLATE, "index.tsx"), "utf8")
    ).rejects.toBeDefined();
    await expect(
      readFile(join(target, REGISTRY_TEMPLATE), "utf8")
    ).rejects.toBeDefined();
  });

  it("leaves a file that is already there alone", async () => {
    const target = await folder("promo");

    await run(expandTemplate(target));
    await writeFile(join(target, "src", "Root.tsx"), "// mine\n", "utf8");
    await run(expandTemplate(target));

    expect(await readFile(join(target, "src", "Root.tsx"), "utf8")).toBe(
      "// mine\n"
    );
  });

  it("says so rather than half-copying when there is no template", async () => {
    const kept = process.env[TEMPLATE_DIR_ENV] ?? TEMPLATE;
    Reflect.deleteProperty(process.env, TEMPLATE_DIR_ENV);

    const exit = await Effect.runPromiseExit(
      expandTemplate(await folder("nowhere"))
    );
    process.env[TEMPLATE_DIR_ENV] = kept;

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain(TEMPLATE_DIR_ENV);
    }
  });
});

describe("expandVideo", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("writes one folder under src/videos, sized and named", async () => {
    const target = await folder("reel");
    await run(expandTemplate(target));

    const written = await run(
      expandVideo(target, {
        name: "Интро",
        size: VERTICAL,
        slug: "intro",
      })
    );

    expect(written).toBe(join(target, "src", "videos", "intro"));

    const module = await readFile(join(written, "index.tsx"), "utf8");

    expect(module).toContain("width: 1080");
    expect(module).toContain("height: 1920");
    const data = JSON.parse(
      await readFile(join(written, "studio.json"), "utf8")
    );
    expect(data.video).toBe("intro");
    expect(data.objects[1].values.text).toBe("Интро");
    expect(module).not.toContain("__VIDEO_NAME__");
  });

  it("never overwrites a video the agent has already edited", async () => {
    const target = await folder("reel");
    await run(expandTemplate(target));

    const draft = { name: "Intro", size: LANDSCAPE, slug: "intro" };
    const written = await run(expandVideo(target, draft));
    await writeFile(join(written, "index.tsx"), "// mine\n", "utf8");
    await run(expandVideo(target, draft));

    expect(await readFile(join(written, "index.tsx"), "utf8")).toBe(
      "// mine\n"
    );
  });
});

describe("packageName", () => {
  it("turns a folder name into something npm accepts", () => {
    expect(packageName("/videos/Launch Film")).toBe("launch-film");
    expect(packageName("/videos/-- promo --")).toBe("promo");
    expect(packageName("/videos/漢字")).toBe("remotion-project");
  });
});
