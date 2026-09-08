import { beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import {
  ensureRegistry,
  importOf,
  REGISTRY_FILE,
  wrapped,
} from "@/sidecar/scaffold/registry";

const TEMPLATE = join(process.cwd(), "templates", "remotion");
const SPECIFIER = "./videos/registry";

const CANONICAL = `import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
`;

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function project(entry = CANONICAL) {
  const root = await mkdtemp(join(tmpdir(), "remocn-registry-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "package.json"), "{}\n", "utf8");
  await writeFile(join(root, "src", "index.ts"), entry, "utf8");
  await writeFile(
    join(root, "src", "Root.tsx"),
    "export function Root() {\n  return null;\n}\n",
    "utf8"
  );
  return root;
}

describe("wrapped", () => {
  it("splices the scan into a canonical entry point", () => {
    const after = wrapped(CANONICAL, SPECIFIER);

    expect(after).toContain(`import { withVideos } from "${SPECIFIER}";`);
    expect(after).toContain("registerRoot(withVideos(Root));");
    expect(after).toContain('import { Root } from "./Root";');
  });

  it("answers null when the entry already registers the scan", () => {
    const once = wrapped(CANONICAL, SPECIFIER) ?? "";

    expect(wrapped(once, SPECIFIER)).toBeNull();
  });

  it("keeps whatever else the entry does", () => {
    const after = wrapped(
      `import "./styles.css";\n${CANONICAL}enableSomething();\n`,
      SPECIFIER
    );

    expect(after).toContain('import "./styles.css";');
    expect(after).toContain("enableSomething();");
  });

  // The entry point is the person's file: a half-understood edit to it would
  // break every composition in the project, not only the studio's videos.
  it("refuses a shape it cannot read rather than guessing", () => {
    expect(() =>
      wrapped(
        'import { registerRoot } from "remotion";\nregisterRoot(() => <Thing />);\n',
        SPECIFIER
      )
    ).toThrow("registerRoot(Root)");
  });

  it("refuses an entry with no imports to anchor to", () => {
    expect(() => wrapped("registerRoot(Root);\n", SPECIFIER)).toThrow(
      "entry point"
    );
  });
});

describe("importOf", () => {
  it("writes a relative specifier without the extension", () => {
    expect(importOf("/p/src/index.ts", `/p/src/videos/${REGISTRY_FILE}`)).toBe(
      "./videos/registry"
    );
  });

  it("climbs out when the entry is not under src", () => {
    expect(
      importOf("/p/remotion/index.ts", `/p/src/videos/${REGISTRY_FILE}`)
    ).toBe("../src/videos/registry");
  });
});

describe("ensureRegistry", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("places the scan and splices it into a project it never scaffolded", async () => {
    const root = await project();

    const answer = await run(ensureRegistry(root));

    expect(answer.wrapped).toBe(true);
    expect(answer.entry).toBe(join(root, "src", "index.ts"));

    const registry = await readFile(
      join(root, "src", "videos", REGISTRY_FILE),
      "utf8"
    );
    expect(registry).toContain("require.context");

    const entry = await readFile(answer.entry, "utf8");
    expect(entry).toContain('from "./videos/registry"');
    expect(entry).toContain("registerRoot(withVideos(Root));");
  });

  it("never touches the project's own Root", async () => {
    const root = await project();
    const before = await readFile(join(root, "src", "Root.tsx"), "utf8");

    await run(ensureRegistry(root));

    expect(await readFile(join(root, "src", "Root.tsx"), "utf8")).toBe(before);
  });

  it("is safe to run twice", async () => {
    const root = await project();

    await run(ensureRegistry(root));
    const once = await readFile(join(root, "src", "index.ts"), "utf8");
    const again = await run(ensureRegistry(root));

    expect(again.wrapped).toBe(false);
    expect(await readFile(join(root, "src", "index.ts"), "utf8")).toBe(once);
  });

  it("leaves a registry the project already has alone", async () => {
    const root = await project();
    await mkdir(join(root, "src", "videos"), { recursive: true });
    await writeFile(
      join(root, "src", "videos", REGISTRY_FILE),
      "// mine\n",
      "utf8"
    );

    await run(ensureRegistry(root));

    expect(
      await readFile(join(root, "src", "videos", REGISTRY_FILE), "utf8")
    ).toBe("// mine\n");
  });

  it("says which entry it could not read rather than rewriting it", async () => {
    const root = await project(
      'import { registerRoot } from "remotion";\nregisterRoot(() => null);\n'
    );

    const exit = await Effect.runPromiseExit(ensureRegistry(root));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("registerRoot(Root)");
    }
  });
});
