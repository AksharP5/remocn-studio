import { type Dirent, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The project's static files, by the names `staticFile()` takes.
 *
 * Remotion's own studio server publishes this list as `remotion_staticFiles`;
 * this host does not, because setting that global changes what `staticFile()`
 * returns. It is served as its own listing instead, and the only thing that
 * reads it is the properties pane's asset picker — which needs to offer the
 * pictures a project already has, and can name them no other way.
 */
export const MAX_STATIC_FILES = 2000;

const MAX_DEPTH = 8;
const DOT = ".";

export interface StaticFiles {
  readonly files: readonly string[];
  readonly truncated: boolean;
}

export function staticFiles(
  publicDir: string,
  limit: number = MAX_STATIC_FILES
): StaticFiles {
  const files: string[] = [];
  let truncated = false;

  const descend = (relative: string, depth: number) => {
    if (truncated || depth > MAX_DEPTH) {
      return;
    }

    for (const entry of entriesIn(path.join(publicDir, relative))) {
      // A dot entry is `.DS_Store` and its friends: never something a person
      // put in `public/` to point a composition at.
      if (entry.name.startsWith(DOT)) {
        continue;
      }

      const name = relative === "" ? entry.name : `${relative}/${entry.name}`;

      if (isDirectory(publicDir, name, entry)) {
        descend(name, depth + 1);
        continue;
      }

      if (files.length >= limit) {
        truncated = true;
        return;
      }

      files.push(name);
    }
  };

  descend("", 0);
  files.sort((one, other) => one.localeCompare(other));

  return { files, truncated };
}

// The server resolves symlinks when it serves a file, so the listing has to
// see through them too — a monorepo sharing one asset folder is the case, and
// `Dirent.isDirectory()` is false for the link that points at it.
function isDirectory(publicDir: string, name: string, entry: Dirent): boolean {
  if (!entry.isSymbolicLink()) {
    return entry.isDirectory();
  }

  try {
    return statSync(path.join(publicDir, name)).isDirectory();
  } catch {
    return false;
  }
}

function entriesIn(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((one, other) =>
      one.name.localeCompare(other.name)
    );
  } catch {
    // A project with no `public/` at all is an empty listing, not a failure:
    // the picker then offers nothing, which is the truth.
    return [];
  }
}
