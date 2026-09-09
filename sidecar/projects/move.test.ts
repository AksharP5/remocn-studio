import { afterEach, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { projectActivity } from "./activity";
import { cancelProjectMove, moveProjectFiles, prepareMove } from "./move";

const roots: string[] = [];
async function folders() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "remocn-move-test-"))
  );
  roots.push(root);
  const source = join(root, "project");
  const parent = join(root, "target");
  await mkdir(source);
  await mkdir(parent);
  await writeFile(join(source, ".hidden"), "original");
  return {
    destination: join(parent, "project"),
    journal: join(root, "journal"),
    parent,
    root,
    source,
  };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
describe("project move", () => {
  it("rejects occupied, same, nested and missing paths before changing files", async () => {
    const f = await folders();
    await expect(prepareMove(f.source, f.root)).rejects.toThrow("outside");
    await expect(prepareMove(f.source, f.source)).rejects.toThrow("outside");
    await mkdir(f.destination);
    await expect(prepareMove(f.source, f.parent)).rejects.toThrow(
      "already exists"
    );
    await expect(
      prepareMove(join(f.root, "missing"), f.parent)
    ).rejects.toThrow("missing");
    expect(await readFile(join(f.source, ".hidden"), "utf8")).toBe("original");
  });
  it("moves hidden files and preserves external symlinks without copying their target", async () => {
    const f = await folders();
    await writeFile(join(f.root, "external"), "external bytes");
    await symlink(join(f.root, "external"), join(f.source, "link"));
    let switched = "";
    const result = await moveProjectFiles(
      "p",
      f.source,
      f.parent,
      f.journal,
      (path) => {
        switched = path;
        return Promise.resolve();
      },
      () => undefined
    );
    expect(result).toBe(f.destination);
    expect(switched).toBe(f.destination);
    expect(await readFile(join(result, ".hidden"), "utf8")).toBe("original");
    expect(await readlink(join(result, "link"))).toBe(join(f.root, "external"));
    await expect(readFile(join(f.source, ".hidden"))).rejects.toThrow();
  });
  it("verifies a cross-volume copy before switching and deleting the original", async () => {
    const f = await folders();
    await mkdir(join(f.source, ".git"));
    await writeFile(join(f.source, ".git", "HEAD"), "ref: refs/heads/main");
    let originalPresentAtSwitch = false;
    await moveProjectFiles(
      "p",
      f.source,
      f.parent,
      f.journal,
      async () => {
        originalPresentAtSwitch =
          (await readFile(join(f.source, ".hidden"), "utf8")) === "original";
      },
      () => undefined,
      () =>
        Promise.reject(
          Object.assign(new Error("cross-device"), { code: "EXDEV" })
        )
    );
    expect(originalPresentAtSwitch).toBe(true);
    expect(await readFile(join(f.destination, ".git", "HEAD"), "utf8")).toBe(
      "ref: refs/heads/main"
    );
    await expect(readFile(join(f.source, ".hidden"))).rejects.toThrow();
  });
  it("keeps the journal and destination when updating the index fails", async () => {
    const f = await folders();
    await expect(
      moveProjectFiles(
        "p",
        f.source,
        f.parent,
        f.journal,
        () => Promise.reject(new Error("database unavailable")),
        () => undefined
      )
    ).rejects.toThrow(f.destination);
    const journal = JSON.parse(
      await readFile(join(f.journal, "p.json"), "utf8")
    );
    expect(journal.phase).toBe("files-moved");
    expect(await readFile(join(f.destination, ".hidden"), "utf8")).toBe(
      "original"
    );
  });
  it("refuses linked worktrees before moving anything", async () => {
    const f = await folders();
    await writeFile(
      join(f.source, ".git"),
      "gitdir: /another/project/.git/worktrees/a"
    );
    await expect(prepareMove(f.source, f.parent)).rejects.toThrow("worktrees");
  });
  it("holds an exclusive move lock and releases it after failure", async () => {
    const collision = projectActivity(
      "p",
      true,
      projectActivity("p", false, Effect.void)
    );
    await expect(Effect.runPromise(collision)).rejects.toThrow(
      "active operation"
    );
    await Effect.runPromise(projectActivity("p", true, Effect.void));
    await expect(
      Effect.runPromise(
        projectActivity("p", false, projectActivity("p", true, Effect.void))
      )
    ).rejects.toThrow("active operation");
  });
});

it("cancels a cross-volume copy before switching and keeps the original", async () => {
  const f = await folders();
  let switched = false;
  await expect(
    moveProjectFiles(
      "cancel-test",
      f.source,
      f.parent,
      f.journal,
      () => {
        switched = true;
        return Promise.resolve();
      },
      (phase) => {
        if (phase.startsWith("Verifying")) {
          cancelProjectMove("cancel-test");
        }
      },
      () =>
        Promise.reject(
          Object.assign(new Error("cross volume"), { code: "EXDEV" })
        )
    )
  ).rejects.toThrow("cancelled");
  expect(switched).toBe(false);
  expect(await readFile(join(f.source, ".hidden"), "utf8")).toBe("original");
  expect(
    await import("node:fs/promises").then(({ readdir }) => readdir(f.parent))
  ).toEqual([]);
});
