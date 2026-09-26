import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Data, Effect } from "effect";
import type { EnvironmentCheck } from "@/shared/ipc";
import {
  binaryOf,
  installCommand,
  type PackageManager,
  type ProjectManager,
  pmOf,
} from "./package-manager";
import { entryPointOf, remotionRootOf } from "./preview/project";

export class EnvironmentError extends Data.TaggedError("EnvironmentError")<{
  message: string;
}> {}

const NAMED_MISSING = 4;

export const TUNABLE_TEXT_FLOOR = [4, 0, 513] as const;

export const TUNABLE_TEXT_VERSION = "4.0.520";

const RANGE = /^[\^~]?(\d+)\.(\d+)\.(\d+)$/;

const GREATER_OR_EQUAL = ">=";

export interface Manifest {
  dependencies: readonly string[];
  remotion: string | null;
}

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

export function managerRow(
  project: ProjectManager,
  binary: string | null
): EnvironmentCheck {
  const named =
    project.lockfile === null
      ? `${project.manager}, since nothing in this project names a package manager`
      : `${project.manager}, named by ${path.basename(project.lockfile)}`;

  if (binary !== null) {
    return {
      detail: named,
      fix: null,
      id: "manager",
      state: "ok",
      title: "This project has a package manager",
    };
  }

  return {
    detail: `This project installs with ${installCommand(project.manager)} — ${project.lockfile === null ? "the studio's own default" : `its ${path.basename(project.lockfile)} says so`} — and ${project.manager} is not on this machine. The studio ships its own bun for itself, and will not install another project's dependencies with it: that would write a second lockfile and resolve to different versions.`,
    fix: fixFor(project.manager),
    id: "manager",
    state: "failed",
    title:
      project.manager === "npm"
        ? "Node.js (npm) is not installed"
        : `${project.manager} is not installed`,
  };
}

function fixFor(manager: PackageManager) {
  if (manager === "npm" || binaryOf("npm") === null) {
    return { type: "node" } as const;
  }

  return { command: `npm install -g ${manager}`, type: "command" } as const;
}

export function remotionRow(
  root: string,
  manifest: Manifest | null
): EnvironmentCheck {
  if (manifest === null) {
    return {
      detail: `There is no package.json in ${root}, so this is not a Remotion project yet.`,
      fix: null,
      id: "remotion",
      state: "failed",
      title: "This folder is not a Remotion project",
    };
  }

  if (manifest.remotion === null) {
    return {
      detail: `${path.join(root, "package.json")} does not depend on remotion. Ask Claude to set the project up, or open a folder that already is one.`,
      fix: null,
      id: "remotion",
      state: "failed",
      title: "This folder is not a Remotion project",
    };
  }

  const resolved = installedVersion(root, "remotion");
  const declared = resolved ?? versionOf(manifest.remotion);
  const found = resolved === null ? manifest.remotion : resolved.join(".");

  if (declared !== null && isBelow(declared, TUNABLE_TEXT_FLOOR)) {
    return {
      detail: `This project runs remotion ${found}. Remotion only started declaring typography and text on its elements in 4.0.513, so the properties pane cannot edit the text, weight, size or colour of anything here — those go to the agent in words instead.`,
      fix: {
        packages: upgradable(manifest),
        type: "upgrade",
        version: TUNABLE_TEXT_VERSION,
      },
      id: "remotion",
      state: "warn",
      title: `Text and type editing needs Remotion ${TUNABLE_TEXT_FLOOR.join(".")} or newer`,
    };
  }

  return {
    detail: `remotion ${manifest.remotion}`,
    fix: null,
    id: "remotion",
    state: "ok",
    title: "This folder is a Remotion project",
  };
}

export function installedVersion(
  root: string,
  name: string
): readonly [number, number, number] | null {
  let dir = root;

  for (;;) {
    const manifest = path.join(dir, "node_modules", name, "package.json");

    if (existsSync(manifest)) {
      try {
        const read: unknown = JSON.parse(readFileSync(manifest, "utf8"));
        const version =
          typeof read === "object" && read !== null && "version" in read
            ? read.version
            : null;

        return typeof version === "string" ? versionOf(version) : null;
      } catch {
        return null;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

export function versionOf(
  range: string
): readonly [number, number, number] | null {
  const trimmed = range.trim();
  const bare = trimmed.startsWith(GREATER_OR_EQUAL)
    ? trimmed.slice(GREATER_OR_EQUAL.length).trim()
    : trimmed;

  const found = RANGE.exec(bare);

  if (found === null) {
    return null;
  }

  return [Number(found[1]), Number(found[2]), Number(found[3])];
}

function isBelow(
  version: readonly [number, number, number],
  floor: readonly [number, number, number]
): boolean {
  const [major, minor, patch] = version;
  const [least, leastMinor, leastPatch] = floor;

  if (major !== least) {
    return major < least;
  }

  if (minor !== leastMinor) {
    return minor < leastMinor;
  }

  return patch < leastPatch;
}

export function upgradable(manifest: Manifest): readonly string[] {
  const scoped = manifest.dependencies
    .filter((name) => name.startsWith("@remotion/"))
    .sort();

  return [...scoped, "remotion"];
}

export function dependencyRow(
  missing: readonly string[],
  total: number,
  drifted: string | null,
  installable = true
): EnvironmentCheck {
  if (missing.length > 0) {
    const named = missing.slice(0, NAMED_MISSING).join(", ");
    const rest =
      missing.length > NAMED_MISSING
        ? ` and ${missing.length - NAMED_MISSING} more`
        : "";

    return {
      detail: `${missing.length} of ${total} declared packages are not in node_modules: ${named}${rest}.`,
      fix: installable ? { type: "install" } : null,
      id: "dependencies",
      state: "failed",
      title: "Dependencies are not installed",
    };
  }

  if (drifted !== null) {
    return {
      detail: drifted,
      fix: installable ? { type: "install" } : null,
      id: "dependencies",
      state: "warn",
      title: "package.json and the lockfile disagree",
    };
  }

  return {
    detail: `${total} declared packages resolve from node_modules.`,
    fix: null,
    id: "dependencies",
    state: "ok",
    title: "Dependencies are installed",
  };
}

export function entryRow(
  root: string,
  entry: string | null,
  reason: string
): EnvironmentCheck {
  if (entry === null) {
    return {
      detail: reason,
      fix: null,
      id: "entry",
      state: "failed",
      title: "No Remotion entry point",
    };
  }

  return {
    detail: path.relative(root, entry) || entry,
    fix: null,
    id: "entry",
    state: "ok",
    title: "A Remotion entry point is registered",
  };
}

export const PENDING_COMPOSITIONS: EnvironmentCheck = {
  detail: "Counted once the preview has compiled the project.",
  fix: null,
  id: "compositions",
  state: "pending",
  title: "Compositions",
};

export function manifestOf(
  root: string
): Effect.Effect<Manifest | null, never> {
  return Effect.tryPromise({
    catch: () => new EnvironmentError({ message: "no package.json" }),
    try: async () => {
      const source = await readFile(path.join(root, "package.json"), "utf8");
      const parsed = JSON.parse(source) as Record<
        string,
        Record<string, string> | undefined
      >;

      const names = new Set<string>();
      let remotion: string | null = null;

      for (const field of DEPENDENCY_FIELDS) {
        for (const [name, range] of Object.entries(parsed[field] ?? {})) {
          names.add(name);
          if (name === "remotion") {
            remotion = range;
          }
        }
      }

      return { dependencies: [...names], remotion } satisfies Manifest;
    },
  }).pipe(Effect.orElseSucceed(() => null));
}

export function isInstalled(root: string, name: string): boolean {
  let dir = root;

  for (;;) {
    if (existsSync(path.join(dir, "node_modules", name, "package.json"))) {
      return true;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return false;
    }

    dir = parent;
  }
}

export function missingFrom(
  root: string,
  dependencies: readonly string[]
): readonly string[] {
  return dependencies.filter((name) => !isInstalled(root, name));
}

const drifts = new Map<string, { drift: string | null; stamp: string }>();

function stampOf(files: readonly (string | null)[]): string | null {
  const parts: string[] = [];
  for (const file of files) {
    if (file === null) {
      continue;
    }
    try {
      const stats = statSync(file);
      parts.push(`${file}:${stats.mtimeMs}:${stats.size}`);
    } catch {
      return null;
    }
  }
  return parts.join("|");
}

export function lockfileDrift(
  project: ProjectManager
): Effect.Effect<string | null> {
  const binary = project.manager === "bun" ? binaryOf("bun") : null;

  if (binary === null) {
    return Effect.succeed(null);
  }

  const stamp = stampOf([
    path.join(project.root, "package.json"),
    project.lockfile,
  ]);
  const held = drifts.get(project.root);

  if (stamp !== null && held?.stamp === stamp) {
    return Effect.succeed(held.drift);
  }

  return runDrift(binary, project).pipe(
    Effect.tap((drift) =>
      Effect.sync(() => {
        if (stamp !== null) {
          drifts.set(project.root, { drift, stamp });
        }
      })
    )
  );
}

function runDrift(
  binary: string,
  project: ProjectManager
): Effect.Effect<string | null> {
  return Effect.callback<string | null>((resume) => {
    const child = spawn(binary, ["install", "--dry-run", "--frozen-lockfile"], {
      cwd: project.root,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let said = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      said += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      said += chunk.toString();
    });

    child.once("error", () => resume(Effect.succeed(null)));

    child.once("exit", (code) => {
      resume(Effect.succeed(driftFrom(code, said)));
    });

    return Effect.sync(() => {
      child.kill("SIGKILL");
    });
  });
}

export function driftFrom(code: number | null, said: string): string | null {
  if (code === 0) {
    return null;
  }

  const line = said
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row.startsWith("error:") && row.includes("lockfile"));

  if (line === undefined) {
    return null;
  }

  return `${line.slice("error:".length).trim()} Installing brings node_modules and the lockfile back in step with package.json.`;
}

export function checksFor(
  folder: string,
  account: EnvironmentCheck
): Effect.Effect<readonly EnvironmentCheck[]> {
  return Effect.map(projectChecks(folder), (rows) => [account, ...rows]);
}

export function projectChecks(
  folder: string
): Effect.Effect<readonly EnvironmentCheck[]> {
  return Effect.gen(function* () {
    const root = remotionRootOf(folder);
    const manifest = yield* manifestOf(root);

    const project = pmOf(root);
    const binary = binaryOf(project.manager);

    const head = [managerRow(project, binary), remotionRow(root, manifest)];

    if (manifest === null) {
      return [...head, PENDING_COMPOSITIONS];
    }

    const dependencies = yield* dependenciesRow(
      root,
      manifest,
      project,
      binary !== null
    );

    if (manifest.remotion === null) {
      return [...head, dependencies, PENDING_COMPOSITIONS];
    }

    const entry = yield* entryPointOf(root).pipe(
      Effect.map((file) => entryRow(root, file, "")),
      Effect.catch((error) =>
        Effect.succeed(entryRow(root, null, error.message))
      )
    );

    return [...head, dependencies, entry, PENDING_COMPOSITIONS];
  });
}

function dependenciesRow(
  root: string,
  manifest: Manifest,
  project: ProjectManager,
  installable: boolean
): Effect.Effect<EnvironmentCheck> {
  return Effect.gen(function* () {
    const missing = missingFrom(root, manifest.dependencies);

    if (missing.length > 0) {
      return dependencyRow(
        missing,
        manifest.dependencies.length,
        null,
        installable
      );
    }

    const drifted = yield* lockfileDrift(project);

    return dependencyRow(
      [],
      manifest.dependencies.length,
      drifted,
      installable
    );
  });
}
