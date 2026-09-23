import { CANVAS_SELECTOR } from "./anchor";

const FRAME_CLIP = "data-remocn-frame-clip";
const TOLERANCE = 1;

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

export function releaseFrameClips(root: ShadowRoot, element: HTMLElement): () => void {
  const style = document.createElement("style");
  style.textContent = `[${FRAME_CLIP}] { overflow: visible !important; }`;
  root.append(style);
  let scheduled = 0;

  const scan = () => {
    scheduled = 0;
    const player = root.querySelector<HTMLElement>(CANVAS_SELECTOR);
    if (player === null) return;
    const frame = player.getBoundingClientRect();
    if (frame.width <= 0 || frame.height <= 0) return;
    for (const node of player.querySelectorAll<HTMLElement>("*")) {
      if (node.hasAttribute(FRAME_CLIP)) continue;
      if (clips(getComputedStyle(node)) && fills(node.getBoundingClientRect(), frame)) {
        node.setAttribute(FRAME_CLIP, "");
      }
    }
  };
  const schedule = () => {
    if (scheduled === 0) scheduled = requestAnimationFrame(scan);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(element, { childList: true, subtree: true });
  schedule();

  return () => {
    observer.disconnect();
    cancelAnimationFrame(scheduled);
    style.remove();
  };
}
