// biome-ignore-all lint/style/useErrorCause: Effect Schema errors take cause in their field record, not a second ErrorOptions argument.
// biome-ignore-all lint/performance/noAwaitInLoops: Sequential file IO bounds memory and preserves verification order.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { ProjectSettingsError } from "@/shared/project-config";
import { atomicJson } from "./config";

async function exists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
async function inventory(
  root: string,
  directory = "",
  signal?: AbortSignal
): Promise<string[]> {
  signal?.throwIfAborted();
  const entries: string[] = [];
  const names = (await readdir(join(root, directory))).sort();
  for (const name of names) {
    signal?.throwIfAborted();
    const path = join(directory, name);
    const stat = await lstat(join(root, path));
    if (stat.isSymbolicLink()) {
      entries.push(`link:${path}:${await readlink(join(root, path))}`);
    } else if (stat.isDirectory()) {
      entries.push(`dir:${path}`, ...(await inventory(root, path, signal)));
    } else if (stat.isFile()) {
      entries.push(
        `file:${path}:${stat.mode}:${await fileHash(join(root, path))}`
      );
    } else {
      throw new ProjectSettingsError({
        code: "invalid-file",
        message: `Cannot move special file: ${path}`,
      });
    }
  }
  return entries;
}

export async function prepareMove(
  source: string,
  parent: string
): Promise<{ source: string; destination: string }> {
  if (!(await exists(source))) {
    throw new ProjectSettingsError({
      code: "missing-source",
      message: "The source folder is missing. Use Locate folder.",
    });
  }
  const actual = await realpath(source);
  const destination = join(await realpath(parent), basename(actual));
  const rel = relative(actual, destination);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..")) {
    throw new ProjectSettingsError({
      code: "invalid-destination",
      message: "Choose a destination outside the current project.",
    });
  }
  if (await exists(destination)) {
    throw new ProjectSettingsError({
      code: "invalid-destination",
      message: `The destination already exists: ${destination}`,
    });
  }
  if (
    ((await exists(join(source, ".git"))) &&
      !(await lstat(join(source, ".git"))).isDirectory()) ||
    (await exists(join(source, ".git", "worktrees"))) ||
    (await exists(join(source, ".gitmodules")))
  ) {
    throw new ProjectSettingsError({
      code: "invalid-destination",
      message:
        "Move linked Git worktrees and submodules with Git before locating the project here.",
    });
  }
  return { destination, source: actual };
}

// The journal lives outside both directories. A crash never erases the evidence
// needed to reconnect the existing identity to the successfully moved folder.
async function transferProjectFiles(
  projectId: string,
  source: string,
  parent: string,
  journalRoot: string,
  switchPath: (destination: string) => Promise<void>,
  progress: (phase: string) => void,
  transferRename: (source: string, target: string) => Promise<void>,
  signal: AbortSignal
): Promise<string> {
  const { destination, source: sourcePath } = await prepareMove(source, parent);
  await mkdir(journalRoot, { recursive: true });
  const journal = `${projectId}.json`;
  const record = (phase: string) =>
    atomicJson(journalRoot, journal, {
      destination,
      phase,
      projectId,
      source: sourcePath,
    });
  signal.throwIfAborted();
  await record("prepared");
  progress("Moving project files…");
  let copied = false;
  try {
    await transferRename(sourcePath, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }
    const staging = `${destination}.remocn-moving-${projectId}`;
    if (await exists(staging)) {
      throw new ProjectSettingsError({
        cause: error,
        code: "move-recovery",
        message: `A previous copy needs recovery: ${staging}`,
      });
    }
    progress("Copying project files…");
    try {
      const before = await inventory(sourcePath, "", signal);
      await cp(sourcePath, staging, {
        dereference: false,
        errorOnExist: true,
        filter: () => {
          signal.throwIfAborted();
          return true;
        },
        force: false,
        preserveTimestamps: true,
        recursive: true,
        verbatimSymlinks: true,
      });
      progress("Verifying copied files…");
      if (
        JSON.stringify(before) !==
          JSON.stringify(await inventory(staging, "", signal)) ||
        JSON.stringify(before) !==
          JSON.stringify(await inventory(sourcePath, "", signal))
      ) {
        throw new ProjectSettingsError({
          cause: error,
          code: "move-recovery",
          message: `The copy could not be verified. Original: ${source}. Partial copy: ${staging}`,
        });
      }
      signal.throwIfAborted();
    } catch (cause) {
      if (signal.aborted) {
        await rm(staging, { force: true, recursive: true });
        await rm(join(journalRoot, journal), { force: true });
      }
      throw cause;
    }
    await rename(staging, destination);
    copied = true;
  }
  await record("files-moved");
  try {
    progress("Updating project location…");
    await switchPath(destination);
    await record("switched");
  } catch (cause) {
    throw new ProjectSettingsError({
      cause,
      code: "move-recovery",
      message: `Files are at ${destination}; original location: ${source}. Use Locate folder to restore the link. ${String(cause)}`,
    });
  }
  if (copied) {
    await rm(sourcePath, { recursive: true });
  }
  await rm(join(journalRoot, journal));
  return destination;
}

async function fileHash(path: string) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) {
    hash.update(bytes);
  }
  return hash.digest("hex");
}

const moves = new Map<string, AbortController>();
export function cancelProjectMove(projectId: string) {
  moves.get(projectId)?.abort(
    new ProjectSettingsError({
      code: "cancelled",
      message: "Move cancelled. The original project folder is unchanged.",
    })
  );
}
export async function moveProjectFiles(
  projectId: string,
  source: string,
  parent: string,
  journalRoot: string,
  switchPath: (destination: string) => Promise<void>,
  progress: (phase: string) => void,
  transferRename: (source: string, target: string) => Promise<void> = rename
): Promise<string> {
  const controller = new AbortController();
  moves.set(projectId, controller);
  try {
    return await transferProjectFiles(
      projectId,
      source,
      parent,
      journalRoot,
      switchPath,
      progress,
      transferRename,
      controller.signal
    );
  } finally {
    moves.delete(projectId);
  }
}
