import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export interface Lookup {
  readonly env: string;
  readonly fallbacks: readonly string[];
  readonly name: string;
}

export interface LookupHost {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly exists: (path: string) => boolean;
}

const host: LookupHost = { env: process.env, exists: existsSync };

export function findExecutable(
  lookup: Lookup,
  at: LookupHost = host
): string | null {
  const overridden = at.env[lookup.env];
  if (overridden !== undefined && overridden.length > 0) {
    return at.exists(overridden) ? overridden : null;
  }

  const onPath = (at.env.PATH ?? "")
    .split(delimiter)
    .filter((dir) => dir.length > 0);

  for (const dir of [...onPath, ...lookup.fallbacks]) {
    const candidate = join(dir, lookup.name);
    if (at.exists(candidate)) {
      return candidate;
    }
  }

  return null;
}
