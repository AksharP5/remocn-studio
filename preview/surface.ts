import type { StackFrame } from "./source";

export interface SurfaceEnvironment {
  assets: string;
  composition: string | null;
  getStack: (element: Element) => Promise<StackFrame[] | null>;
  overlays: HTMLElement;
  preferred: string | null;
  project: string;
  root: ShadowRoot;
  url: string;
  viewport: HTMLElement;
}

let environment: SurfaceEnvironment | null = null;
const locks = new Set<object>();

export function configureSurface(value: SurfaceEnvironment): () => void {
  environment = value;
  return () => {
    locks.clear();
    value.viewport.removeAttribute("data-preview-editing");
    value.overlays.replaceChildren();
    environment = null;
  };
}

export const nativeSurface = () => environment;
export const contentRoot = (): Document | ShadowRoot =>
  environment?.root ?? document;
export const overlayRoot = (): HTMLElement =>
  environment?.overlays ?? document.body;
export const styleRoot = (): ShadowRoot | HTMLElement =>
  environment?.root ?? document.head;
export const surfaceHref = () => environment?.url ?? window.location.href;
export const focusSurface = () =>
  environment
    ? environment.viewport.focus({ preventScroll: true })
    : window.focus();
export const eventElement = (event: Event): Element | null => {
  const target = event.composedPath()[0] ?? event.target;
  return target instanceof Element ? target : null;
};
export const isChrome = (event: Event) =>
  event
    .composedPath()
    .some(
      (node) =>
        node instanceof Element && node.hasAttribute("data-canvas-chrome")
    );

export function parentAcrossRoot(node: Element): HTMLElement | null {
  const root = node.getRootNode();
  return (
    node.parentElement ??
    (root instanceof ShadowRoot && root.host instanceof HTMLElement
      ? root.host
      : null)
  );
}

export function elementsAt(x: number, y: number): Element[] {
  if (!environment) {
    return document.elementsFromPoint(x, y);
  }
  const top = document.elementFromPoint(x, y);
  if (top !== environment.root.host) {
    return [];
  }
  return environment.root
    .elementsFromPoint(x, y)
    .filter((node) => node.getRootNode() === environment?.root);
}

export function onViewChange(receive: () => void): () => void {
  const target = environment?.viewport;
  target?.addEventListener("preview-view-change", receive);
  return () => target?.removeEventListener("preview-view-change", receive);
}

export function lockCamera(owner: object, locked: boolean): void {
  if (locked) {
    locks.add(owner);
  } else {
    locks.delete(owner);
  }
  environment?.viewport.toggleAttribute("data-preview-editing", locks.size > 0);
}

const wrappers = new Map<EventListener, Map<string, EventListener>>();
export const surfaceEvents = {
  addEventListener<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    capture = false
  ): void {
    const target = environment?.viewport ?? window;
    const original = listener as EventListener;
    const wrapped: EventListener = (event) => {
      if (isChrome(event) || event.defaultPrevented) {
        return;
      }
      original(event);
    };
    const entries = wrappers.get(original) ?? new Map<string, EventListener>();
    entries.set(`${type}:${capture}`, wrapped);
    wrappers.set(original, entries);
    target.addEventListener(type, wrapped, capture);
  },
  removeEventListener<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    capture = false
  ): void {
    const original = listener as EventListener;
    const entries = wrappers.get(original);
    const key = `${type}:${capture}`;
    const wrapped = entries?.get(key);
    if (wrapped) {
      (environment?.viewport ?? window).removeEventListener(
        type,
        wrapped,
        capture
      );
    }
    entries?.delete(key);
    if (!entries?.size) {
      wrappers.delete(original);
    }
  },
};
