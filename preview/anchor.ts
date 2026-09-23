import { contentRoot } from "./surface";
export const CANVAS_SELECTOR = ".__remotion-player";

const DESIGN_ID = "data-design-id";

export function anchorOf(node: Element, container: Element): string {
  const steps: string[] = [];
  let current: Element | null = node;

  while (current !== null) {
    const id = current.getAttribute(DESIGN_ID);

    if (id !== null && id.length > 0) {
      return joined(`[${DESIGN_ID}="${CSS.escape(id)}"]`, steps);
    }

    if (current === container) {
      return joined(CANVAS_SELECTOR, steps);
    }

    const parent: Element | null = current.parentElement;

    if (parent === null) {
      return joined(CANVAS_SELECTOR, steps);
    }

    steps.unshift(`:nth-child(${[...parent.children].indexOf(current) + 1})`);
    current = parent;
  }

  return CANVAS_SELECTOR;
}

export function resolveAnchor(
  anchor: string,
  container: Element
): Element | null {
  if (anchor.length === 0) {
    return null;
  }

  try {
    if (!anchor.startsWith(CANVAS_SELECTOR)) {
      return contentRoot().querySelector(anchor);
    }

    const steps = anchor.slice(CANVAS_SELECTOR.length).trim();

    return steps.length === 0
      ? container
      : container.querySelector(`:scope ${steps}`);
  } catch {
    return null;
  }
}

export function anchorContainer(): Element | null {
  return contentRoot().querySelector(CANVAS_SELECTOR);
}

function joined(base: string, steps: readonly string[]): string {
  return [base, ...steps].join(" > ");
}
