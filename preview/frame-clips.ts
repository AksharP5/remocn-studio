import { CANVAS_SELECTOR } from "./anchor";

const FRAME_CLIP = "data-remocn-frame-clip";
const MOVING = "data-remocn-moving";
const TOLERANCE = 1;

function transformed(transform: string): boolean {
  return transform !== "" && transform !== "none";
}

function follow(node: HTMLElement, transforms: WeakMap<Element, string>): void {
  const now = node.style.transform;
  const before = transforms.get(node);
  transforms.set(node, now);
  if (!transformed(now)) {
    node.removeAttribute(MOVING);
  } else if (
    before !== undefined &&
    before !== now &&
    !node.hasAttribute(MOVING) &&
    getComputedStyle(node).display !== "inline"
  ) {
    node.setAttribute(MOVING, "");
  }
}

function clips(style: CSSStyleDeclaration): boolean {
  return style.overflowX !== "visible" || style.overflowY !== "visible";
}

function fills(rect: DOMRect, frame: DOMRect): boolean {
  return (
    rect.width > 0 &&
    Math.abs(rect.left - frame.left) <= TOLERANCE &&
    Math.abs(rect.top - frame.top) <= TOLERANCE &&
    Math.abs(rect.right - frame.right) <= TOLERANCE &&
    Math.abs(rect.bottom - frame.bottom) <= TOLERANCE
  );
}

function release(node: Element, frame: DOMRect): void {
  if (
    node instanceof HTMLElement &&
    !node.hasAttribute(FRAME_CLIP) &&
    clips(getComputedStyle(node)) &&
    fills(node.getBoundingClientRect(), frame)
  ) {
    node.setAttribute(FRAME_CLIP, "");
  }
}

function outermost(nodes: Set<Element>, player: Element): Element[] {
  const inside = [...nodes].filter(
    (node) => node !== player && node.isConnected && player.contains(node)
  );
  return inside.filter(
    (node) => !inside.some((other) => other !== node && other.contains(node))
  );
}

export function releaseFrameClips(
  root: ShadowRoot,
  element: HTMLElement
): () => void {
  const style = document.createElement("style");
  style.textContent = `[${FRAME_CLIP}] { overflow: visible !important; } [${MOVING}] { will-change: transform; }`;
  root.append(style);
  let scheduled = 0;
  let whole = true;
  const added = new Set<Element>();

  const scan = () => {
    scheduled = 0;
    const player = root.querySelector<HTMLElement>(CANVAS_SELECTOR);
    const frame = player?.getBoundingClientRect();
    if (!(player && frame) || frame.width <= 0 || frame.height <= 0) {
      whole = true;
      added.clear();
      return;
    }
    const everything =
      whole || [...added].some((node) => node.contains(player));
    const subtrees = everything ? [player] : outermost(added, player);
    whole = false;
    added.clear();
    for (const subtree of subtrees) {
      if (subtree !== player) {
        release(subtree, frame);
      }
      for (const node of subtree.querySelectorAll("*")) {
        release(node, frame);
      }
    }
  };
  const schedule = () => {
    if (scheduled === 0) {
      scheduled = requestAnimationFrame(scan);
    }
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) {
          added.add(node);
        }
      }
    }
    if (added.size > 0) {
      schedule();
    }
  });
  observer.observe(element, { childList: true, subtree: true });
  schedule();
  const transforms = new WeakMap<Element, string>();
  const moving = new MutationObserver((records) => {
    const player = root.querySelector<HTMLElement>(CANVAS_SELECTOR);
    for (const { target } of records) {
      if (
        target instanceof HTMLElement &&
        target !== player &&
        player?.contains(target)
      ) {
        follow(target, transforms);
      }
    }
  });
  moving.observe(element, { attributeFilter: ["style"], subtree: true });

  return () => {
    moving.disconnect();
    observer.disconnect();
    cancelAnimationFrame(scheduled);
    added.clear();
    style.remove();
  };
}
