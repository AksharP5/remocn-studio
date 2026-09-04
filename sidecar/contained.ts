import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";

/**
 * The real path of `target`, resolving symlinks and `..` — walking up to the
 * nearest existing ancestor when the file itself is not there yet, so a path
 * that is about to be created still resolves.
 */
export async function realPathOf(target: string): Promise<string> {
  try {
    return await realpath(target);
  } catch {
    const parent = dirname(target);
    if (parent === target) {
      return target;
    }
    return join(await realPathOf(parent), basename(target));
  }
}

export function inside(root: string, target: string): boolean {
  return (
    target === root ||
    target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
  );
}

/**
 * The first of `targets` that resolves outside every root, or `null` when all
 * of them land inside one. The permission gate turns that into a card; the
 * document reader turns it into a refusal.
 */
export async function escapee(
  cwd: string,
  extraRoots: readonly string[],
  targets: readonly string[]
): Promise<string | null> {
  if (targets.length === 0) {
    return null;
  }

  const resolved = await Promise.all([
    realPathOf(resolve(cwd)),
    ...extraRoots.map((root) => realPathOf(resolve(root))),
    ...targets.map((target) =>
      realPathOf(isAbsolute(target) ? target : resolve(cwd, target))
    ),
  ]);

  const roots = resolved.slice(0, 1 + extraRoots.length);
  return (
    resolved
      .slice(1 + extraRoots.length)
      .find((target) => !roots.some((root) => inside(root, target))) ?? null
  );
}
