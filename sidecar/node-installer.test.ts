import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CryptoHasher, spawnSync } from "bun";
import { Effect } from "effect";
import { DATA_DIR_ENV } from "@/shared/ipc";
import { installerUrl, installLinuxRuntime, newestLts } from "./node-installer";
import { activateManagedNode } from "./node-runtime";
import { binaryOf } from "./package-manager";

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

describe.skipIf(process.platform !== "linux")(
  "Linux runtime installation",
  () => {
    const beforePath = process.env.PATH;
    const beforeData = process.env[DATA_DIR_ENV];
    let folder = "";
    let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | null =
      null;

    afterEach(async () => {
      fetchSpy?.mockRestore();
      process.env.PATH = beforePath;
      if (beforeData === undefined) {
        Reflect.deleteProperty(process.env, DATA_DIR_ENV);
      } else {
        process.env[DATA_DIR_ENV] = beforeData;
      }
      if (folder !== "") {
        await rm(folder, { force: true, recursive: true });
      }
    });

    async function archive(checksumMatches: boolean) {
      folder = await mkdtemp(path.join(tmpdir(), "remocn-node-test-"));
      process.env[DATA_DIR_ENV] = path.join(folder, "data");
      const bin = path.join(folder, "node-v22.14.0-linux-x64/bin");
      await mkdir(bin, { recursive: true });
      await writeFile(path.join(bin, "node"), "#!/bin/sh\necho v22.14.0\n", {
        mode: 0o755,
      });
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
      expect(
        await Effect.runPromise(installLinuxRuntime(file, "v22.14.0"))
      ).toBe(true);
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
  }
);
