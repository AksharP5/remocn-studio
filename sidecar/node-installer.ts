import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { file as bunFile, spawn as bunSpawn, CryptoHasher } from "bun";
import { Data, Effect, Semaphore } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { NodeDownload } from "@/shared/ipc";
import { activateManagedNode, managedNodeDir } from "./node-runtime";

export class NodeInstallError extends Data.TaggedError("NodeInstallError")<{
  message: string;
}> {}

export const RELEASE_INDEX = "https://nodejs.org/dist/index.json";

const SEMVER = /^v\d+\.\d+\.\d+$/;
const WHITESPACE = /\s+/;
const INSTALL = Semaphore.makeUnsafe(1);

interface Release {
  lts: string | false;
  version: string;
}

export function newestLts(releases: readonly unknown[]): string | null {
  for (const entry of releases) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const release = entry as Partial<Release>;

    if (
      typeof release.version === "string" &&
      typeof release.lts === "string" &&
      SEMVER.test(release.version)
    ) {
      return release.version;
    }
  }

  return null;
}

export function installerName(
  version: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string {
  if (!SEMVER.test(version)) {
    throw new Error("nodejs.org returned an invalid release version");
  }
  if (platform === "darwin") {
    return `node-${version}.pkg`;
  }
  if (platform === "linux" && (arch === "x64" || arch === "arm64")) {
    return `node-${version}-linux-${arch}.tar.xz`;
  }
  throw new Error(
    `Node.js installation is not supported on ${platform}/${arch}`
  );
}

export function installerUrl(
  version: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string {
  return `https://nodejs.org/dist/${version}/${installerName(version, platform, arch)}`;
}

export const latestLts: Effect.Effect<string, NodeInstallError> =
  Effect.tryPromise({
    catch: (cause) =>
      new NodeInstallError({
        message: `could not reach nodejs.org: ${errorMessage(cause)}`,
      }),
    try: async () => {
      const answer = await fetch(RELEASE_INDEX);

      if (!answer.ok) {
        throw new Error(`nodejs.org answered ${answer.status}`);
      }

      return (await answer.json()) as unknown[];
    },
  }).pipe(
    Effect.flatMap((releases) => {
      const version = newestLts(releases);

      return version === null
        ? Effect.fail(
            new NodeInstallError({
              message: "nodejs.org lists no LTS release right now",
            })
          )
        : Effect.succeed(version);
    })
  );

export function downloadInstaller(
  version: string,
  onProgress: (event: NodeDownload) => Effect.Effect<void>
): Effect.Effect<string, NodeInstallError> {
  return Effect.callback<string, NodeInstallError>((resume) => {
    const controller = new AbortController();

    const run = async () => {
      const folder = await mkdtemp(path.join(tmpdir(), "remocn-studio-node-"));
      const file = path.join(folder, installerName(version));

      const answer = await fetch(installerUrl(version), {
        signal: controller.signal,
      });

      if (!(answer.ok && answer.body)) {
        throw new Error(`nodejs.org answered ${answer.status}`);
      }

      const declared = answer.headers.get("content-length");
      const total = declared === null ? null : Number.parseInt(declared, 10);
      let received = 0;

      const body = Readable.fromWeb(
        answer.body as unknown as Parameters<typeof Readable.fromWeb>[0]
      );

      body.on("data", (chunk: Buffer) => {
        received += chunk.length;
        Effect.runSync(
          onProgress({
            received,
            total: total === null || Number.isNaN(total) ? null : total,
            type: "progress",
          })
        );
      });

      await pipeline(body, createWriteStream(file));

      return file;
    };

    run().then(
      (file) => resume(Effect.succeed(file)),
      (cause) =>
        resume(
          Effect.fail(new NodeInstallError({ message: errorMessage(cause) }))
        )
    );

    return Effect.sync(() => controller.abort());
  });
}

export function openInstaller(
  file: string
): Effect.Effect<boolean, NodeInstallError> {
  return Effect.callback<boolean, NodeInstallError>((resume) => {
    const child = spawn("/usr/bin/open", [file], { stdio: "ignore" });

    child.once("error", (cause) =>
      resume(
        Effect.fail(
          new NodeInstallError({
            message: `could not open ${file}: ${errorMessage(cause)}`,
          })
        )
      )
    );

    child.once("exit", (code) => resume(Effect.succeed(code === 0)));

    return Effect.sync(() => child.kill());
  });
}

export function installNode(
  onProgress: (event: NodeDownload) => Effect.Effect<void>
): Effect.Effect<{ opened: boolean; version: string }, NodeInstallError> {
  return INSTALL.withPermits(1)(
    Effect.gen(function* () {
      const version = yield* latestLts;
      const file = yield* downloadInstaller(version, onProgress);
      const opened = yield* process.platform === "linux"
        ? installLinuxRuntime(file, version).pipe(
            Effect.ensuring(
              Effect.promise(() =>
                rm(path.dirname(file), { force: true, recursive: true })
              )
            )
          )
        : openInstaller(file);

      return { opened, version };
    })
  );
}

export function installLinuxRuntime(
  file: string,
  version: string
): Effect.Effect<boolean, NodeInstallError> {
  return Effect.tryPromise({
    catch: (cause) => new NodeInstallError({ message: errorMessage(cause) }),
    try: async () => {
      const destination = managedNodeDir();
      if (destination === null) {
        throw new Error(
          "The studio's application data directory is unavailable"
        );
      }

      const answer = await fetch(
        `https://nodejs.org/dist/${version}/SHASUMS256.txt`
      );
      if (!answer.ok) {
        throw new Error(
          `Node.js checksums could not be downloaded (${answer.status})`
        );
      }
      const name = installerName(version, "linux");
      const checksums = (await answer.text()).split("\n");
      const expected = checksums
        .map((line) => line.trim().split(WHITESPACE))
        .find((entry) => entry[1] === name)?.[0];
      const actual = CryptoHasher.hash(
        "sha256",
        await bunFile(file).arrayBuffer(),
        "hex"
      );
      if (expected !== actual) {
        throw new Error(
          "The Node.js download failed checksum verification. Try again."
        );
      }

      await mkdir(path.dirname(destination), { recursive: true });
      const staging = await mkdtemp(`${destination}-`);
      try {
        const unpack = bunSpawn(
          ["tar", "-xJf", file, "--strip-components=1", "-C", staging],
          { stderr: "pipe", stdout: "ignore" }
        );
        const stderr = await new Response(unpack.stderr).text();
        if ((await unpack.exited) !== 0) {
          throw new Error(`Node.js could not be unpacked: ${stderr.trim()}`);
        }
        const probe = bunSpawn([path.join(staging, "bin/node"), "--version"], {
          stderr: "pipe",
          stdout: "pipe",
        });
        const installed = (await new Response(probe.stdout).text()).trim();
        if ((await probe.exited) !== 0 || installed !== version) {
          throw new Error("The downloaded Node.js runtime could not start");
        }

        const previous = `${destination}.previous`;
        await rm(previous, { force: true, recursive: true });
        const hasPrevious = existsSync(destination);
        if (hasPrevious) {
          await rename(destination, previous);
        }
        await rename(staging, destination).catch(async (cause: unknown) => {
          if (hasPrevious) {
            await rename(previous, destination);
          }
          throw cause;
        });
        activateManagedNode();
        await rm(previous, { force: true, recursive: true });
        return true;
      } finally {
        await rm(staging, { force: true, recursive: true });
      }
    },
  });
}
