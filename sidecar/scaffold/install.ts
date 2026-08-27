import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Effect } from "effect";
import {
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

export function installDependencies(
  cwd: string,
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<void, ScaffoldError> {
  return runInstall(pmOf(remotionRootOf(cwd)), log);
}

export function installScaffold(
  cwd: string,
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<void, ScaffoldError> {
  const root = remotionRootOf(cwd);

  return runInstall({ lockfile: null, manager: DEFAULT_MANAGER, root }, log);
}

function runInstall(
  project: ProjectManager,
  log: (line: string) => Effect.Effect<void>
): Effect.Effect<void, ScaffoldError> {
  const { manager } = project;
  const binary = binaryOf(manager);

  if (binary === null) {
    return Effect.fail(new ScaffoldError({ message: notInstalled(manager) }));
  }

  return Effect.callback<void, ScaffoldError>((resume) => {
    const child = spawn(binary, [...INSTALL_ARGS], {
      cwd: project.root,
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
            message: reason(manager, code, signal, tail),
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
  manager: PackageManager,
  code: number | null,
  signal: NodeJS.Signals | null,
  tail: readonly string[]
): string {
  const how =
    signal === null ? `exited with code ${code}` : `was killed by ${signal}`;
  const said = tail.join("\n").trim();

  return said.length === 0
    ? `${installCommand(manager)} ${how}`
    : `${installCommand(manager)} ${how}:\n${said}`;
}
