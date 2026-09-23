import { MANAGED_OBJECT } from "./managed-objects";

export function presentObjects(root: ParentNode): string[] {
  const ids = new Set<string>();
  for (const node of root.querySelectorAll(`[${MANAGED_OBJECT}]`)) {
    const id = node.getAttribute(MANAGED_OBJECT);
    if (id) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

export function watchPresence(
  root: Node & ParentNode,
  report: (ids: string[]) => void
): () => void {
  let last: string | null = null;
  let scheduled = 0;
  const flush = () => {
    scheduled = 0;
    const ids = presentObjects(root);
    const key = ids.join("\n");
    if (key !== last) {
      last = key;
      report(ids);
    }
  };
  const observer = new MutationObserver(() => {
    if (scheduled === 0) {
      scheduled = requestAnimationFrame(flush);
    }
  });
  observer.observe(root, {
    attributeFilter: [MANAGED_OBJECT],
    attributes: true,
    childList: true,
    subtree: true,
  });
  flush();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(scheduled);
  };
}
