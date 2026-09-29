import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import {
  CHANGED_SINCE,
  CHANGED_WHILE_DELETING,
  makeRemovals,
  NO_LONGER_UNDOABLE,
  REMOVED_HEADING,
} from "./removals";

const BEFORE = "<Frame>\n  <Badge />\n</Frame>\n";
const AFTER = "<Frame>\n</Frame>\n";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "removals-"));
  file = join(root, "Scene.tsx");
  await writeFile(file, BEFORE);
});
afterEach(() => rm(root, { force: true, recursive: true }));

const removed = (overrides: { file?: string; before?: string } = {}) => ({
  after: AFTER,
  before: overrides.before ?? BEFORE,
  file: overrides.file ?? file,
  line: 2,
});

async function message(effect: Effect.Effect<unknown, { message: string }>) {
  const exit = await Effect.runPromiseExit(effect);
  return Exit.isFailure(exit) ? String(exit.cause) : "succeeded";
}

describe("code removals", () => {
  it("writes the removal and restores the previous text once", async () => {
    const store = makeRemovals();
    const written = await Effect.runPromise(
      store.commit(root, removed(), "Badge")
    );
    expect(written).toMatchObject({ file, line: 2 });
    expect(await readFile(file, "utf8")).toBe(AFTER);
    await Effect.runPromise(store.restore(root, written.removal));
    expect(await readFile(file, "utf8")).toBe(BEFORE);
    expect(await message(store.restore(root, written.removal))).toContain(
      NO_LONGER_UNDOABLE
    );
  });

  it("refuses to write over a file that changed after the host read it", async () => {
    const store = makeRemovals();
    await writeFile(file, `${BEFORE}// edited\n`);
    expect(await message(store.commit(root, removed(), "Badge"))).toContain(
      CHANGED_WHILE_DELETING
    );
    expect(await readFile(file, "utf8")).toBe(`${BEFORE}// edited\n`);
  });

  it("refuses to undo over a file that changed since", async () => {
    const store = makeRemovals();
    const written = await Effect.runPromise(
      store.commit(root, removed(), "Badge")
    );
    await writeFile(file, `${AFTER}// agent\n`);
    expect(await message(store.restore(root, written.removal))).toContain(
      CHANGED_SINCE
    );
    expect(await readFile(file, "utf8")).toBe(`${AFTER}// agent\n`);
  });

  it("refuses a file outside the project, and another project's removal", async () => {
    const store = makeRemovals();
    const elsewhere = await mkdtemp(join(tmpdir(), "elsewhere-"));
    const outside = join(elsewhere, "Scene.tsx");
    await writeFile(outside, BEFORE);
    try {
      expect(
        await message(store.commit(root, removed({ file: outside }), "Badge"))
      ).toContain("outside the project folder");
      expect(await readFile(outside, "utf8")).toBe(BEFORE);
      const written = await Effect.runPromise(
        store.commit(root, removed(), "Badge")
      );
      expect(
        await message(store.restore(elsewhere, written.removal))
      ).toContain(NO_LONGER_UNDOABLE);
    } finally {
      await rm(elsewhere, { force: true, recursive: true });
    }
  });

  it("tells the next turn in the project once, and forgets an undone removal", async () => {
    const store = makeRemovals();
    const kept = await Effect.runPromise(
      store.commit(root, removed(), "Badge")
    );
    expect(store.brief(root)).toBe(
      `${REMOVED_HEADING}\n- <Badge> at Scene.tsx:2`
    );
    expect(store.brief(root)).toBeNull();
    await Effect.runPromise(store.restore(root, kept.removal));
    const undone = await Effect.runPromise(
      store.commit(root, removed(), "Badge")
    );
    await Effect.runPromise(store.restore(root, undone.removal));
    expect(store.brief(root)).toBeNull();
  });

  it("still reports a removal whose undo was refused", async () => {
    const store = makeRemovals();
    const written = await Effect.runPromise(
      store.commit(root, removed(), "Badge")
    );
    await writeFile(file, `${AFTER}// agent\n`);
    await Effect.runPromiseExit(store.restore(root, written.removal));
    expect(store.brief(root)).toContain("<Badge> at Scene.tsx:2");
  });
});
