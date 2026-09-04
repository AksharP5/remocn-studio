// @vitest-environment node
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_BYTES,
  readProjectDocument,
  videoDocuments,
} from "@/sidecar/documents";

let project = "";
let docs = "";

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "remocn-docs-"));
  docs = join(project, "src", "videos", "intro", "docs");
  mkdirSync(docs, { recursive: true });
});

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromiseExit(effect);

describe("videoDocuments", () => {
  it("lists the markdown a video's stages wrote, with its folder", async () => {
    writeFileSync(join(docs, "script.md"), "# Script");
    writeFileSync(join(docs, "analysis.md"), "# Analysis");
    writeFileSync(join(docs, "notes.txt"), "not a document");
    mkdirSync(join(docs, "drafts"));

    const exit = await run(videoDocuments(project, "intro"));

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.folder).toBe(docs);
      expect(exit.value.files.map((file) => file.name).sort()).toEqual([
        "analysis.md",
        "script.md",
      ]);
      for (const file of exit.value.files) {
        expect(file.modifiedAt).toBeGreaterThan(0);
        expect(file.path).toBe(join(docs, file.name));
      }
    }
  });

  // A pipeline that has not run yet is the ordinary state of a new video.
  it("answers an empty list and the folder when nothing has been written", async () => {
    const exit = await run(videoDocuments(project, "outro"));

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.files).toEqual([]);
      expect(exit.value.folder).toBe(
        join(project, "src", "videos", "outro", "docs")
      );
    }
  });
});

describe("readProjectDocument", () => {
  it("reads a document inside the project", async () => {
    const path = join(docs, "script.md");
    writeFileSync(path, "# Scene one\n");

    const exit = await run(readProjectDocument(project, path));

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.text).toBe("# Scene one\n");
      expect(exit.value.modifiedAt).toBeGreaterThan(0);
    }
  });

  it("refuses a path that climbs out of the project", async () => {
    const outside = mkdtempSync(join(tmpdir(), "remocn-elsewhere-"));
    writeFileSync(join(outside, "secret.md"), "not yours");

    const exit = await run(
      readProjectDocument(project, join(docs, "..", "..", "..", "..", "x.md"))
    );
    const elsewhere = await run(
      readProjectDocument(project, join(outside, "secret.md"))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(Exit.isFailure(elsewhere)).toBe(true);
  });

  // The gate resolves symlinks, so a link inside the folder pointing out of it
  // is refused exactly as an absolute path outside it is.
  it("refuses a symlink that leads out of the project", async () => {
    const outside = mkdtempSync(join(tmpdir(), "remocn-elsewhere-"));
    const target = join(outside, "secret.md");
    writeFileSync(target, "not yours");
    const link = join(docs, "link.md");
    symlinkSync(target, link);

    expect(Exit.isFailure(await run(readProjectDocument(project, link)))).toBe(
      true
    );
  });

  it("refuses a file too large to belong on stdio", async () => {
    const path = join(docs, "huge.md");
    writeFileSync(path, "x".repeat(MAX_DOCUMENT_BYTES + 1));

    const exit = await run(readProjectDocument(project, path));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  // An mp4 opened by accident must not go down the frame channel as text.
  it("refuses something that is not text", async () => {
    const path = join(docs, "clip.mp4");
    writeFileSync(path, Buffer.from([0x00, 0x01, 0x00, 0x02]));

    const exit = await run(readProjectDocument(project, path));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a folder", async () => {
    expect(Exit.isFailure(await run(readProjectDocument(project, docs)))).toBe(
      true
    );
  });

  it("refuses a file that is not there", async () => {
    const exit = await run(
      readProjectDocument(project, join(docs, "missing.md"))
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
