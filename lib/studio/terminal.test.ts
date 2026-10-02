import { afterEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, write } from "bun";
import { linuxSetupCommand } from "@/lib/studio/terminal";

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { force: true, recursive: true }))
  );
});

async function fixture() {
  const folder = await mkdtemp(path.join(tmpdir(), "studio's data-$node-"));
  folders.push(folder);
  return folder;
}

async function probe(bin: string, answer: string) {
  await mkdir(bin, { recursive: true });
  const file = path.join(bin, "remocn-node-probe");
  await write(file, `#!/bin/sh\nprintf '%s' '${answer}'\n`);
  await chmod(file, 0o755);
}

async function run(command: string, inheritedPath: string) {
  const child = spawn(["/bin/sh", "-c", command], {
    env: { ...process.env, PATH: inheritedPath },
    stderr: "pipe",
    stdout: "pipe",
  });
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  return output;
}

describe("Linux provider setup commands", () => {
  it("quotes the data directory and gives every pipeline process the managed runtime", async () => {
    const data = await fixture();
    await probe(path.join(data, "node/bin"), "managed");

    expect(
      await run(
        linuxSetupCommand("printf ignored | remocn-node-probe", `${data}/`),
        "/usr/bin:/bin"
      )
    ).toBe("managed");
  });

  it("keeps existing command lookup working before managed Node is installed", async () => {
    const folder = await fixture();
    const fallback = path.join(folder, "existing/bin");
    await probe(fallback, "existing");

    expect(
      await run(
        linuxSetupCommand("remocn-node-probe", path.join(folder, "absent")),
        fallback
      )
    ).toBe("existing");
  });
});
