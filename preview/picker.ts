import { managedRoot } from "./managed-objects";
import { elementsAt } from "./surface";

const CLIMB_LIMIT = 8;
const OVERLAY_ATTR = "data-remocn-inspect";

const SVG_NS = "http://www.w3.org/2000/svg";

const REPLACED = new Set([
  "audio",
  "button",
  "canvas",
  "iframe",
  "img",
  "input",
  "select",
  "textarea",
  "video",
]);

const INLINE = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "ruby",
]);

const WORD_GAP = 0.35;
const VISIBLE_ALPHA = 0.05;
const DEFAULT_FONT_SIZE = 16;
const FULL_FRAME = 0.8;

const TRANSPARENT = new Set(["transparent", "rgba(0, 0, 0, 0)"]);
const ZERO_ALPHA = /^rgba\([^)]*,\s*0(\.0+)?\)$/;

export function isTransparent(color: string): boolean {
  const value = color.trim();
  return value.length === 0 || TRANSPARENT.has(value) || ZERO_ALPHA.test(value);
}

function pixels(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function edge(width: string | undefined, color: string | undefined): boolean {
  return pixels(width) > 0 && !isTransparent(color ?? "");
}

export function hasBorder(style: CSSStyleDeclaration): boolean {
  return (
    edge(style.borderTopWidth, style.borderTopColor) ||
    edge(style.borderRightWidth, style.borderRightColor) ||
    edge(style.borderBottomWidth, style.borderBottomColor) ||
    edge(style.borderLeftWidth, style.borderLeftColor)
  );
}

function styleOf(element: Element): CSSStyleDeclaration | undefined {
  return element.ownerDocument.defaultView?.getComputedStyle(element);
}

export function isHidden(style: CSSStyleDeclaration): boolean {
  const opacity = Number.parseFloat(style.opacity ?? "");
  const visibility = style.visibility ?? "";

  return (
    (Number.isFinite(opacity) && opacity < VISIBLE_ALPHA) ||
    (visibility.length > 0 && visibility !== "visible")
  );
}

export function isMasked(style: CSSStyleDeclaration): boolean {
  const mask = style.maskImage ?? "none";
  const webkit = style.webkitMaskImage ?? "none";

  return (
    (mask !== "none" && mask.length > 0) ||
    (webkit !== "none" && webkit.length > 0)
  );
}

function shown(element: Element | null, limit: Element): boolean {
  let current = element;

  while (current !== null) {
    const style = styleOf(current);

    if (style !== undefined && isHidden(style)) {
      return false;
    }
    if (current === limit) {
      return true;
    }

    current = current.parentElement;
  }

  return true;
}

function fontSizeOf(element: Element | null): number {
  const style = element === null ? undefined : styleOf(element);
  const size = Number.parseFloat(style?.fontSize ?? "");

  return Number.isFinite(size) ? size : DEFAULT_FONT_SIZE;
}

export function nearText(
  element: Element,
  x: number,
  y: number,
  allowance: number = WORD_GAP
): boolean {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode();

  while (node !== null) {
    const parent = node.parentElement;

    if ((node.textContent ?? "").trim().length > 0 && shown(parent, element)) {
      const slack = allowance * fontSizeOf(parent);
      const range = document.createRange();
      range.selectNodeContents(node);

      for (const rect of range.getClientRects()) {
        if (
          x >= rect.left - slack &&
          x <= rect.right + slack &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          return true;
        }
      }
    }

    node = walker.nextNode();
  }

  return false;
}

export function coversText(element: Element, x: number, y: number): boolean {
  return nearText(element, x, y, 0);
}

export function paintsSurface(style: CSSStyleDeclaration): boolean {
  const image = style.backgroundImage ?? "none";

  if (image !== "none" && image.length > 0) {
    return true;
  }
  if (!isTransparent(style.backgroundColor ?? "")) {
    return true;
  }

  const shadow = style.boxShadow ?? "none";

  if (shadow !== "none" && shadow.length > 0) {
    return true;
  }

  return hasBorder(style);
}

export function isDrawing(element: Element): boolean {
  return element.namespaceURI === SVG_NS;
}

export function svgRootOf(element: Element): Element | null {
  if (!isDrawing(element)) {
    return null;
  }

  let current: Element | null = element;
  let root = element;

  while (current !== null && isDrawing(current)) {
    if (current.localName === "svg") {
      root = current;
    }
    current = current.parentElement;
  }

  return root;
}

export function paints(element: Element, x: number, y: number): boolean {
  const style = styleOf(element);

  if (style === undefined) {
    return true;
  }
  if (isHidden(style)) {
    return false;
  }
  if (isDrawing(element) || REPLACED.has(element.localName)) {
    return true;
  }
  if (isMasked(style)) {
    return nearText(element, x, y);
  }

  return paintsSurface(style) || nearText(element, x, y);
}

export function isInlineWrapper(element: Element): boolean {
  if (isDrawing(element) || REPLACED.has(element.localName)) {
    return false;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);

  if (style === undefined || !INLINE.has(style.display)) {
    return false;
  }

  return !paintsSurface(style);
}

export function climb(element: Element, container: Element): Element {
  const drawing = svgRootOf(element);
  let current =
    drawing !== null && container.contains(drawing) ? drawing : element;

  for (let depth = 0; depth < CLIMB_LIMIT; depth += 1) {
    const parent = current.parentElement;

    if (
      parent === null ||
      parent === container ||
      !container.contains(parent)
    ) {
      return current;
    }
    if (!isInlineWrapper(current)) {
      return current;
    }

    current = parent;
  }

  return current;
}

export function covers(container: Element, x: number, y: number): boolean {
  const rect = container.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom
  );
}

export function fillsFrame(element: Element, container: Element): boolean {
  const box = element.getBoundingClientRect();
  const frame = container.getBoundingClientRect();

  if (frame.width <= 0 || frame.height <= 0) {
    return false;
  }

  return (
    box.width >= frame.width * FULL_FRAME &&
    box.height >= frame.height * FULL_FRAME
  );
}

function smallestPainter(
  painters: Element[],
  container: Element
): Element | undefined {
  const [first] = painters;

  if (first === undefined || !fillsFrame(first, container)) {
    return first;
  }

  return painters.find((element) => !fillsFrame(element, container)) ?? first;
}

export function pickAt(
  x: number,
  y: number,
  container: Element,
  exact: boolean
): Element | null {
  const under = elementsAt(x, y).filter(
    (element) =>
      container.contains(element) && !element.hasAttribute(OVERLAY_ATTR)
  );

  const [topmost] = under;

  if (topmost === undefined) {
    return null;
  }
  for (const element of under) {
    const root = managedRoot(element, container);
    if (root !== null && shown(element, container)) {
      return root;
    }
  }
  if (exact) {
    return topmost;
  }

  const text = under.find((element) => nearText(element, x, y));

  if (text !== undefined) {
    return climb(text, container);
  }

  const painters = under.filter((element) => paints(element, x, y));

  return climb(smallestPainter(painters, container) ?? topmost, container);
}

export { OVERLAY_ATTR };
