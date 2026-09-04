import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { DocumentText, VideoDocuments } from "@/shared/ipc";
import { docsFolderOf } from "@/shared/pipeline";
import { escapee } from "./contained";
import { FilesError } from "./files";

// Far past any stage document and far short of anything the stdio frames
// should carry: a project's own mp4 opened by accident is the case this
// exists for.
export const MAX_DOCUMENT_BYTES = 1_000_000;

const MARKDOWN = /\.md$/i;

export function videoDocuments(
  projectPath: string,
  slug: string
): Effect.Effect<VideoDocuments, FilesError> {
  const folder = join(projectPath, docsFolderOf(slug));

  return Effect.promise(async () => {
    const names = await markdownIn(folder);

    const files = await Promise.all(
      names.map(async (name) => {
        const path = join(folder, name);
        return { modifiedAt: await modifiedAt(path), name, path };
      })
    );

    return { files, folder };
  });
}

export function readProjectDocument(
  projectPath: string,
  path: string
): Effect.Effect<DocumentText, FilesError> {
  return Effect.tryPromise({
    catch: (cause) => new FilesError({ message: errorMessage(cause) }),
    try: async () => {
      const escaped = await escapee(projectPath, [], [path]);
      if (escaped !== null) {
        throw new Error(
          `${path} is outside this project, so the studio will not open it.`
        );
      }

      const stats = await stat(path);
      if (!stats.isFile()) {
        throw new Error(`${path} is not a file.`);
      }

      if (stats.size > MAX_DOCUMENT_BYTES) {
        throw new Error(
          `${path} is ${Math.round(stats.size / 1000)} kB — too large to open here.`
        );
      }

      const bytes = await readFile(path);
      // A NUL is the one byte a text file never holds, and it is what an mp4
      // or a font opened by mistake is full of. Checking the content rather
      // than trusting the extension is what makes the size cap the second
      // line of defence instead of the only one.
      if (bytes.includes(0)) {
        throw new Error(`${path} is not a text file.`);
      }

      return { modifiedAt: Math.trunc(stats.mtimeMs), text: bytes.toString() };
    },
  });
}

// No folder yet is the ordinary state of a video whose pipeline has not run:
// an empty list and the folder it would be written to, never an error the
// pane has to word.
async function markdownIn(folder: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && MARKDOWN.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function modifiedAt(path: string): Promise<number> {
  try {
    return Math.trunc((await stat(path)).mtimeMs);
  } catch {
    return 0;
  }
}
