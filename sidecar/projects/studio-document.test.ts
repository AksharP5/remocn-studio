import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import {
  documentFixture,
  easingDocumentFixture,
  operationFixture,
} from "@/test/fixtures/studio-document";
import { readStudioDocument, writeStudioDocument } from "./studio-document";

let root: string;
let file: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-objects-"));
  file = join(root, "src/videos/intro/studio.json");
  await mkdir(join(root, "src/videos/intro"), { recursive: true });
  await writeFile(join(root, "package.json"), "{}");
  await writeFile(file, JSON.stringify(documentFixture));
});
afterEach(() => rm(root, { force: true, recursive: true }));

describe("managed document persistence", () => {
  it("persists receipts with values and accepts a retry after rereading the file", async () => {
    const first = await Effect.runPromise(
      writeStudioDocument(root, "intro", operationFixture())
    );
    const retry = await Effect.runPromise(
      writeStudioDocument(root, "intro", operationFixture())
    );
    expect(retry).toEqual(first);
    const read = await Effect.runPromise(readStudioDocument(root, "intro"));
    expect(read.document.objects[2].values.size).toBe(72);
    expect(read.document.operations).toHaveLength(1);
  });

  it("serializes independent edits and refuses the second conflicting write", async () => {
    await Promise.all([
      Effect.runPromise(writeStudioDocument(root, "intro", operationFixture())),
      Effect.runPromise(
        writeStudioDocument(
          root,
          "intro",
          operationFixture({ after: 90, id: "other", objectId: "first" })
        )
      ),
    ]);
    const contents = await readFile(file, "utf8");
    await expect(
      Effect.runPromise(
        writeStudioDocument(root, "intro", operationFixture({ id: "conflict" }))
      )
    ).rejects.toThrow("changed elsewhere");
    expect(await readFile(file, "utf8")).toBe(contents);
  });

  it("refuses malformed documents, traversal and symlink targets without changing them", async () => {
    await expect(
      Effect.runPromise(readStudioDocument(root, "../intro"))
    ).rejects.toThrow("Choose a Studio video");
    await writeFile(file, "{");
    await expect(
      Effect.runPromise(writeStudioDocument(root, "intro", operationFixture()))
    ).rejects.toThrow("not valid JSON");
    expect(await readFile(file, "utf8")).toBe("{");
    await rm(file);
    await symlink(join(root, "package.json"), file);
    await expect(
      Effect.runPromise(readStudioDocument(root, "intro"))
    ).rejects.toThrow();
  });
});

it("persists custom curves atomically and accepts a serialized retry", async () => {
  await writeFile(file, JSON.stringify(easingDocumentFixture));
  const operation = {
    after: [0.2, -0.5, 0.8, 1.5] as const,
    before: [0, 0, 0.58, 1] as const,
    definition: easingDocumentFixture.definitions[0],
    field: "entryEasing",
    id: "curve-save",
    objectId: "title",
  };
  await Effect.runPromise(writeStudioDocument(root, "intro", operation));
  const retried = await Effect.runPromise(
    writeStudioDocument(root, "intro", structuredClone(operation))
  );
  expect(retried.document.objects[0].values.entryEasing).toEqual(
    operation.after
  );
  expect(retried.document.operations).toHaveLength(1);
});
