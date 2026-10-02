import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { watch } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CryptoHasher, spawnSync } from "bun";
import { Deferred, Effect, Fiber } from "effect";
import { DATA_DIR_ENV } from "@/shared/ipc";
import { NativeAbortController } from "@/test/register-dom";
import {
  downloadInstaller,
  installerUrl,
  installLinuxRuntime,
  installNode,
  latestLts,
  newestLts,
} from "./node-installer";
import { activateManagedNode } from "./node-runtime";
import { binaryOf } from "./package-manager";

const domAbortController = globalThis.AbortController;
beforeEach(() => {
  globalThis.AbortController = NativeAbortController;
});
afterEach(() => {
  globalThis.AbortController = domAbortController;
});

describe("newestLts", () => {
  it("takes the first LTS entry, which is the newest", () => {
    expect(
      newestLts([
        { lts: false, version: "v25.1.0" },
        { lts: "Jod", version: "v22.14.0" },
        { lts: "Iron", version: "v20.18.1" },
      ])
    ).toBe("v22.14.0");
  });

  it("is null when nothing on the index is LTS", () => {
    expect(newestLts([{ lts: false, version: "v25.1.0" }])).toBeNull();
  });

  it("refuses an entry whose version is not a version", () => {
    expect(newestLts([{ lts: "Jod", version: "latest" }])).toBeNull();
  });

  it("survives an index entry of an unexpected shape", () => {
    expect(newestLts([null, 7, { lts: "Jod", version: "v22.14.0" }])).toBe(
      "v22.14.0"
    );
  });
});

describe("installerUrl", () => {
  it("names the universal macOS installer for a version", () => {
    expect(installerUrl("v22.14.0", "darwin")).toBe(
      "https://nodejs.org/dist/v22.14.0/node-v22.14.0.pkg"
    );
  });

  it("selects the official Linux archive for the machine", () => {
    expect(installerUrl("v22.14.0", "linux", "x64")).toBe(
      "https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz"
    );
    expect(installerUrl("v22.14.0", "linux", "arm64")).toContain(
      "linux-arm64.tar.xz"
    );
    expect(() => installerUrl("../oops", "linux")).toThrow("invalid release");
    expect(() => installerUrl("v22.14.0", "linux", "ia32")).toThrow(
      "not supported"
    );
  });
});

describe("installer download cleanup", () => {
  const beforeTmp = process.env.TMPDIR;
  let folder = "";
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(async () => {
    folder = await mkdtemp(path.join(tmpdir(), "remocn-download-test-"));
    process.env.TMPDIR = folder;
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    if (beforeTmp === undefined) {
      Reflect.deleteProperty(process.env, "TMPDIR");
    } else {
      process.env.TMPDIR = beforeTmp;
    }
    await rm(folder, { force: true, recursive: true });
  });

  it("removes the download directory after an HTTP failure", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      Effect.runPromise(
        Effect.scoped(downloadInstaller("v22.14.0", () => Effect.void))
      )
    ).rejects.toThrow("503");
    expect(await readdir(folder)).toEqual([]);
  });

  it("reports an invalid release index as an installation error", async () => {
    fetchSpy.mockResolvedValue(Response.json({ error: "unavailable" }));
    await expect(Effect.runPromise(latestLts)).rejects.toThrow(
      "invalid release index"
    );
  });

  it("waits for a cancelled stream to close and removes its partial file", async () => {
    const started = Deferred.makeUnsafe<void>();
    fetchSpy.mockImplementation(
      Object.assign(
        (
          _url: Parameters<typeof fetch>[0],
          options?: Parameters<typeof fetch>[1]
        ) =>
          Promise.resolve(
            new Response(
              new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.enqueue(new Uint8Array(64));
                  options?.signal?.addEventListener("abort", () => {
                    controller.error(new DOMException("Aborted", "AbortError"));
                  });
                },
              })
            )
          ),
        { preconnect: fetch.preconnect }
      )
    );
    const fiber = Effect.runFork(
      Effect.scoped(
        downloadInstaller("v22.14.0", () =>
          Deferred.succeed(started, undefined).pipe(Effect.asVoid)
        )
      )
    );
    await Effect.runPromise(Deferred.await(started));
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(await readdir(folder)).toEqual([]);
  });
});

describe.skipIf(process.platform !== "linux")(
  "Linux runtime installation",
  () => {
    const beforeHome = process.env.HOME;
    const beforePath = process.env.PATH;
    const beforeData = process.env[DATA_DIR_ENV];
    let folder = "";
    let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | null =
      null;

    afterEach(async () => {
      fetchSpy?.mockRestore();
      process.env.PATH = beforePath;
      if (beforeHome === undefined) {
        Reflect.deleteProperty(process.env, "HOME");
      } else {
        process.env.HOME = beforeHome;
      }
      if (beforeData === undefined) {
        Reflect.deleteProperty(process.env, DATA_DIR_ENV);
      } else {
        process.env[DATA_DIR_ENV] = beforeData;
      }
      if (folder !== "") {
        await rm(folder, { force: true, recursive: true });
      }
    });

    async function archive(
      checksumMatches: boolean,
      probe?: (root: string) => string
    ) {
      folder = await mkdtemp(path.join(tmpdir(), "remocn-node-test-"));
      process.env[DATA_DIR_ENV] = path.join(folder, "data");
      const bin = path.join(folder, "node-v22.14.0-linux-x64/bin");
      await mkdir(bin, { recursive: true });
      await writeFile(
        path.join(bin, "node"),
        probe?.(folder) ?? "#!/bin/sh\necho v22.14.0\n",
        { mode: 0o755 }
      );
      await writeFile(path.join(bin, "npm"), "#!/bin/sh\nexit 0\n", {
        mode: 0o755,
      });
      const file = path.join(folder, "node.tar.xz");
      const packed = spawnSync([
        "tar",
        "-cJf",
        file,
        "-C",
        folder,
        "node-v22.14.0-linux-x64",
      ]);
      expect(packed.exitCode).toBe(0);
      const hash = CryptoHasher.hash("sha256", await readFile(file), "hex");
      const checksum = checksumMatches ? hash : "0".repeat(64);
      fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          `${checksum}  node-v22.14.0-linux-${process.arch}.tar.xz\n`
        )
      );
      return file;
    }

    it("installs and discovers npm immediately and on restart", async () => {
      const file = await archive(true);
      process.env.HOME = path.join(folder, "home");
      const shim = path.join(process.env.HOME, ".volta/bin");
      await mkdir(shim, { recursive: true });
      await writeFile(path.join(shim, "npm"), "#!/bin/sh\nexit 1\n", {
        mode: 0o755,
      });
      fetchSpy
        ?.mockResolvedValueOnce(
          Response.json([{ lts: "Jod", version: "v22.14.0" }])
        )
        .mockResolvedValueOnce(new Response(await readFile(file)));
      const downloads = path.join(folder, "downloads");
      await mkdir(downloads);
      const beforeTmp = process.env.TMPDIR;
      process.env.TMPDIR = downloads;
      try {
        expect(await Effect.runPromise(installNode(() => Effect.void))).toEqual(
          {
            opened: true,
            version: "v22.14.0",
          }
        );
      } finally {
        if (beforeTmp === undefined) {
          Reflect.deleteProperty(process.env, "TMPDIR");
        } else {
          process.env.TMPDIR = beforeTmp;
        }
      }
      expect(await readdir(downloads)).toEqual([]);
      const npm = path.join(folder, "data/node/bin/npm");
      expect(binaryOf("npm")).toBe(npm);
      process.env.PATH = beforePath;
      activateManagedNode();
      expect(binaryOf("npm")).toBe(npm);
    });

    it("keeps the existing runtime when verification fails", async () => {
      const file = await archive(false);
      const node = path.join(folder, "data/node/bin/node");
      await mkdir(path.dirname(node), { recursive: true });
      await writeFile(node, "existing runtime");
      await expect(
        Effect.runPromise(installLinuxRuntime(file, "v22.14.0"))
      ).rejects.toThrow("checksum");
      expect(await readFile(node, "utf8")).toBe("existing runtime");
    });

    it("repairs an incomplete managed install", async () => {
      const file = await archive(true);
      await mkdir(path.join(folder, "data/node/bin"), { recursive: true });
      expect(
        await Effect.runPromise(installLinuxRuntime(file, "v22.14.0"))
      ).toBe(true);
      expect(binaryOf("npm")).toBe(path.join(folder, "data/node/bin/npm"));
    });

    it("aborts checksum verification before replacing the existing runtime", async () => {
      const file = await archive(true);
      const node = path.join(folder, "data/node/bin/node");
      await mkdir(path.dirname(node), { recursive: true });
      await writeFile(node, "existing runtime");
      const started = Deferred.makeUnsafe<void>();
      let signal: AbortSignal | null | undefined;
      const response = Promise.withResolvers<Response>();
      fetchSpy?.mockImplementation(
        Object.assign(
          (
            _url: Parameters<typeof fetch>[0],
            options?: Parameters<typeof fetch>[1]
          ) => {
            signal = options?.signal;
            signal?.addEventListener("abort", () => {
              response.reject(new DOMException("Aborted", "AbortError"));
            });
            Effect.runSync(Deferred.succeed(started, undefined));
            return response.promise;
          },
          { preconnect: fetch.preconnect }
        )
      );
      const fiber = Effect.runFork(installLinuxRuntime(file, "v22.14.0"));
      await Effect.runPromise(Deferred.await(started));
      await Effect.runPromise(Fiber.interrupt(fiber));
      response.reject(new DOMException("Aborted", "AbortError"));
      expect(signal?.aborted).toBe(true);
      expect(await readFile(node, "utf8")).toBe("existing runtime");
    });

    it("stops a running verification process and removes staging before returning", async () => {
      const file = await archive(
        true,
        (root) =>
          `#!/bin/sh\nprintf ready > '${root.replaceAll("'", "'\\''")}/data/probe-started'\nexec sleep 120\n`
      );
      const data = path.join(folder, "data");
      const node = path.join(data, "node/bin/node");
      await mkdir(path.dirname(node), { recursive: true });
      await writeFile(node, "existing runtime");
      const started = Promise.withResolvers<void>();
      const watcher = watch(data, (_event, filename) => {
        if (filename === "probe-started") {
          started.resolve();
        }
      });
      const fiber = Effect.runFork(installLinuxRuntime(file, "v22.14.0"));
      try {
        await started.promise;
        await Effect.runPromise(Fiber.interrupt(fiber));
        expect(await readFile(node, "utf8")).toBe("existing runtime");
        expect((await readdir(data)).sort()).toEqual(["node", "probe-started"]);
      } finally {
        watcher.close();
        await Effect.runPromise(Fiber.interrupt(fiber));
      }
    });
  }
);
