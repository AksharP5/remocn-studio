export interface Fiber {
  child: Fiber | null;
  memoizedProps: Record<string, unknown> | null;
  return: Fiber | null;
  sibling: Fiber | null;
  stateNode: unknown;
  type: unknown;
}

/**
 * The first DOM element a fiber renders, which is what "where is this
 * component on screen" means for anything that is not itself a host node.
 * Depth-first, because the first painted node in tree order is the one whose
 * box covers what the component put there.
 */
export function hostOf(fiber: Fiber): Element | null {
  const { child, stateNode } = fiber;

  if (stateNode instanceof Element) {
    return stateNode;
  }

  let next = child ?? null;

  while (next !== null) {
    const found = hostOf(next);

    if (found !== null) {
      return found;
    }

    next = next.sibling ?? null;
  }

  return null;
}

const FIBER_KEY = "__reactFiber$";

export function fiberOf(node: Element): Fiber | null {
  const key = Object.keys(node).find((own) => own.startsWith(FIBER_KEY));

  return key === undefined
    ? null
    : ((node as unknown as Record<string, Fiber>)[key] ?? null);
}

/**
 * The first answer walking outwards from the node's own fiber, which is what
 * "nearest" means for anything read off the React tree: the innermost match
 * wins, exactly as a DOM containment search would resolve it.
 */
export function nearestInFibers<T>(
  node: Element,
  pick: (fiber: Fiber) => T | null
): T | null {
  let fiber = fiberOf(node);

  while (fiber !== null) {
    const found = pick(fiber);

    if (found !== null) {
      return found;
    }

    fiber = fiber.return;
  }

  return null;
}

/** Every answer from the node outwards, innermost first. */
export function allInFibers<T>(
  node: Element,
  pick: (fiber: Fiber) => T | null
): T[] {
  const found: T[] = [];
  let fiber = fiberOf(node);

  while (fiber !== null) {
    const answer = pick(fiber);

    if (answer !== null) {
      found.push(answer);
    }

    fiber = fiber.return;
  }

  return found;
}

export function displayName(fiber: Fiber): string | null {
  const type = fiber.type as
    | { displayName?: string; name?: string }
    | string
    | null;

  if (type === null || typeof type === "string") {
    return null;
  }

  const name = type.displayName ?? type.name;

  return typeof name === "string" && name.length > 0 ? name : null;
}
