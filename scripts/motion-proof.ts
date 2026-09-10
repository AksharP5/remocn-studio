import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "bun";
import { cases } from "../templates/motion-proof/cases";

const root = resolve(import.meta.dir, "..");
const requested = process.argv.slice(2);
for (const id of requested) {
  if (!cases.some((item) => item.id === id)) {
    throw new Error(
      `Unknown proof case: ${id}. Available: ${cases.map((item) => item.id).join(", ")}`
    );
  }
}
const runId = new Date().toISOString().replaceAll(/[:.]/g, "-");
const output = join(root, "out", "motion-proof", runId);
const workspace = await mkdtemp(join(tmpdir(), "remocn-motion-proof-"));
await mkdir(join(workspace, "src"));
await mkdir(join(workspace, "tmp"));
await mkdir(join(workspace, "cache"));
await mkdir(output, { recursive: true });

const runtime = "templates/remotion/src/lib/studio-motion-v1";
const fixture = "templates/motion-proof";
await cp(join(root, runtime), join(workspace, "src/studio-motion-v1"), {
  recursive: true,
});
await cp(join(root, fixture, "public"), join(workspace, "public"), {
  recursive: true,
});
await cp(
  join(root, "templates/remotion/package.json"),
  join(workspace, "package.json")
);
await Promise.all(
  ["entry.tsx", "cases.ts", "render.ts"].map(async (name) => {
    const source = await readFile(join(root, fixture, name), "utf8");
    await writeFile(
      join(workspace, "src", name),
      source.replaceAll(
        "../remotion/src/lib/studio-motion-v1",
        "./studio-motion-v1"
      )
    );
  })
);

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesIn(join(directory, entry.name))
        : [join(directory, entry.name)]
    )
  );
  return nested.flat();
}
const files = [
  ...(await filesIn(runtime)),
  ...(await filesIn(fixture)),
  "templates/remotion/package.json",
  "scripts/motion-proof.ts",
].sort();
const sources = await Promise.all(
  files.map(async (path) => ({
    path,
    sha256: createHash("sha256")
      .update(await readFile(join(root, path)))
      .digest("hex"),
  }))
);
await writeFile(
  join(output, "source.json"),
  JSON.stringify({ runId, sources, workspace }, null, 2)
);

async function run(command: string[]) {
  const child = spawn(command, {
    cwd: workspace,
    env: {
      ...process.env,
      BUN_INSTALL_CACHE_DIR: join(workspace, "cache"),
      TMPDIR: join(workspace, "tmp"),
    },
    stderr: "inherit",
    stdout: "inherit",
  });
  const status = await child.exited;
  if (status !== 0) {
    throw new Error(
      `${command.join(" ")} failed (${status}). Proof workspace: ${workspace}`
    );
  }
}

console.log(`Motion proof: ${output}`);
await run(["bun", "install"]);
await cp(join(workspace, "bun.lock"), join(output, "bun.lock"));
await run([
  "bunx",
  "tsc",
  "--noEmit",
  "--jsx",
  "react-jsx",
  "--moduleResolution",
  "bundler",
  "--module",
  "esnext",
  "--target",
  "es2022",
  "--lib",
  "es2022,dom",
  "--strict",
  "--skipLibCheck",
  "src/entry.tsx",
  "src/render.ts",
]);
await run(["bun", "src/render.ts", output, ...requested]);
console.log(`Review rendered motion and event frames in ${output}`);
