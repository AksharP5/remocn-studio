import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Effect } from "effect";
import {
  addCommand,
  binaryOf,
  DEFAULT_MANAGER,
  INSTALL_ARGS,
  installCommand,
  type PackageManager,
  type ProjectManager,
  pmOf,
} from "../package-manager";
import { remotionRootOf } from "../preview/project";
import { ScaffoldError } from "./template";

const KILL_GRACE_MS = 2000;
const TAIL_LINES = 12;

export type Spawner = (
  binary: string,
  args: readonly string[],
  options: { cwd: string; stdio: ["ignore", "pipe", "pipe"] }
) => ChildProcess;

export interface Runner {
  readonly binary: (manager: PackageManager) => string | null;
  readonly spawn: Spawner;
}

export const NODE_RUNNER: Runner = { binary: binaryOf, spawn };

export function installDependencies(
  cwd: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
): Effect.Effect<void, ScaffoldError> {
  const project = pmOf(remotionRootOf(cwd));

  return runManager(
    project,
    [...INSTALL_ARGS],
    installCommand(project.manager),
    log,
    runner
  );
}

export function installScaffold(
  cwd: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
): Effect.Effect<void, ScaffoldError> {
  const root = remotionRootOf(cwd);

  return runManager(
    { lockfile: null, manager: DEFAULT_MANAGER, root },
    [...INSTALL_ARGS],
    installCommand(DEFAULT_MANAGER),
    log,
    runner
  );
}

export function upgradeArgs(
  manager: PackageManager,
  packages: readonly string[],
  version: string
): readonly string[] {
  const pinned = packages.map((name) => `${name}@${version}`);

  return manager === "npm" ? ["install", ...pinned] : ["add", ...pinned];
}

export function upgradeDependencies(
  cwd: string,
  packages: readonly string[],
  version: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
): Effect.Effect<void, ScaffoldError> {
  const project = pmOf(remotionRootOf(cwd));

  if (packages.length === 0) {
    return Effect.fail(
      new ScaffoldError({
        message: "there is nothing to upgrade in this project",
      })
    );
  }

  return runManager(
    project,
    upgradeArgs(project.manager, packages, version),
    addCommand(project.manager),
    log,
    runner,
    remotionRootOf(cwd)
  );
}

function runManager(
  project: ProjectManager,
  args: readonly string[],
  command: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner,
  within: string = project.root
): Effect.Effect<void, ScaffoldError> {
  const { manager } = project;
  const binary = runner.binary(manager);

  if (binary === null) {
    return Effect.fail(new ScaffoldError({ message: notInstalled(manager) }));
  }

  return Effect.callback<void, ScaffoldError>((resume) => {
    const child = runner.spawn(binary, args, {
      cwd: within,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const tail: string[] = [];

    const watch = (stream: NodeJS.ReadableStream | null) => {
      if (stream === null) {
        return;
      }
      const lines = createInterface({
        crlfDelay: Number.POSITIVE_INFINITY,
        input: stream,
      });
      lines.on("line", (line) => {
        tail.push(line);
        if (tail.length > TAIL_LINES) {
          tail.shift();
        }
        Effect.runSync(log(line));
      });
    };

    watch(child.stdout);
    watch(child.stderr);

    child.once("error", (cause) => {
      resume(Effect.fail(new ScaffoldError({ message: String(cause) })));
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resume(Effect.void);
        return;
      }
      resume(
        Effect.fail(
          new ScaffoldError({
            message: reason(command, code, signal, tail),
          })
        )
      );
    });

    return Effect.sync(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
      }
    });
  });
}

export function notInstalled(manager: PackageManager): string {
  return `this project's lockfile is ${manager}'s, and ${manager} is not installed on this machine — the studio will not install its dependencies with anything else`;
}

function reason(
  command: string,
  code: number | null,
  signal: NodeJS.Signals | null,
  tail: readonly string[]
): string {
  const how =
    signal === null ? `exited with code ${code}` : `was killed by ${signal}`;
  const said = tail.join("\n").trim();

  return said.length === 0
    ? `${command} ${how}`
    : `${command} ${how}:\n${said}`;
}
