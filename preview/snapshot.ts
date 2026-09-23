import { post } from "./bridge";
import { ACCENT, ACCENT_SOFT, canvas, TOP } from "./inspect";
import { covers, OVERLAY_ATTR } from "./picker";
import { elementsAt, lockCamera, overlayRoot, surfaceEvents } from "./surface";

export const DRAG_THRESHOLD = 6;

export type SnapshotStatus = "armed" | "disarmed" | "no-canvas";

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface Rect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface Frame {
  composition: () => string;
  frame: () => number;
  height: () => number;
  width: () => number;
}

interface Session {
  readonly container: HTMLElement;
  readonly marquee: HTMLElement;
  readonly stop: () => void;
}

let session: Session | null = null;
let dragging: Point | null = null;

export function isDrag(
  from: Point,
  to: Point,
  threshold: number = DRAG_THRESHOLD
): boolean {
  return (
    Math.abs(to.x - from.x) >= threshold || Math.abs(to.y - from.y) >= threshold
  );
}

export function videoBox(container: Box, width: number, height: number): Box {
  if (
    width <= 0 ||
    height <= 0 ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return container;
  }

  const scale = Math.min(container.width / width, container.height / height);
  const drawn = { height: height * scale, width: width * scale };

  return {
    height: drawn.height,
    left: container.left + (container.width - drawn.width) / 2,
    top: container.top + (container.height - drawn.height) / 2,
    width: drawn.width,
  };
}

export function normalisedRect(
  from: Point,
  to: Point,
  video: Box
): Rect | null {
  if (video.width <= 0 || video.height <= 0) {
    return null;
  }

  const left = ratio(Math.min(from.x, to.x) - video.left, video.width);
  const right = ratio(Math.max(from.x, to.x) - video.left, video.width);
  const top = ratio(Math.min(from.y, to.y) - video.top, video.height);
  const bottom = ratio(Math.max(from.y, to.y) - video.top, video.height);

  const width = right - left;
  const height = bottom - top;

  return width <= 0 || height <= 0 ? null : { height, width, x: left, y: top };
}

export function armSnapshot(armed: boolean, frame: Frame): SnapshotStatus {
  if (!armed) {
    close();
    return "disarmed";
  }

  const container = canvas();

  if (container === null) {
    return "no-canvas";
  }

  close();
  session = start(container, frame);

  return "armed";
}

function start(container: HTMLElement, frame: Frame): Session {
  const marquee = overlay();
  const { cursor } = container.style;
  let captured: number | null = null;
  const releasePointer = () => {
    const id = captured;
    captured = null;
    if (id !== null && container.hasPointerCapture(id)) {
      container.releasePointerCapture(id);
    }
  };

  container.style.cursor = "crosshair";

  const onDown = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      !elementsAt(event.clientX, event.clientY).some((node) =>
        container.contains(node)
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    lockCamera(marquee, true);
    container.setPointerCapture(event.pointerId);
    captured = event.pointerId;
    dragging = { x: event.clientX, y: event.clientY };
    paint(marquee, dragging, dragging);
  };

  const onMove = (event: PointerEvent) => {
    if (dragging === null) {
      return;
    }

    paint(marquee, dragging, { x: event.clientX, y: event.clientY });
  };

  const onUp = (event: PointerEvent) => {
    if (dragging === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const from = dragging;
    const to = { x: event.clientX, y: event.clientY };

    dragging = null;
    lockCamera(marquee, false);
    releasePointer();
    marquee.style.display = "none";

    capture(container, frame, isDrag(from, to) ? { from, to } : null);
  };

  const onCancel = () => {
    dragging = null;
    lockCamera(marquee, false);
    releasePointer();
    marquee.style.display = "none";
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      event.stopPropagation();
      if (dragging === null) {
        post({ type: "inspect.clear" });
      } else {
        onCancel();
      }
    }
  };

  const swallow = (event: MouseEvent) => {
    if (covers(container, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  surfaceEvents.addEventListener("pointerdown", onDown, true);
  surfaceEvents.addEventListener("pointermove", onMove, true);
  surfaceEvents.addEventListener("pointerup", onUp, true);
  surfaceEvents.addEventListener("pointercancel", onCancel, true);
  surfaceEvents.addEventListener("lostpointercapture", onCancel, true);
  window.addEventListener("blur", onCancel);
  surfaceEvents.addEventListener("keydown", onKey, true);
  surfaceEvents.addEventListener("click", swallow, true);

  return {
    container,
    marquee,
    stop: () => {
      surfaceEvents.removeEventListener("pointerdown", onDown, true);
      surfaceEvents.removeEventListener("pointermove", onMove, true);
      surfaceEvents.removeEventListener("pointerup", onUp, true);
      surfaceEvents.removeEventListener("pointercancel", onCancel, true);
      surfaceEvents.removeEventListener("lostpointercapture", onCancel, true);
      window.removeEventListener("blur", onCancel);
      releasePointer();
      surfaceEvents.removeEventListener("keydown", onKey, true);
      surfaceEvents.removeEventListener("click", swallow, true);
      container.style.cursor = cursor;
      lockCamera(marquee, false);
      marquee.remove();
    },
  };
}

function close(): void {
  session?.stop();
  session = null;
  dragging = null;
}

function capture(
  container: HTMLElement,
  frame: Frame,
  drag: { from: Point; to: Point } | null
): void {
  const video = videoBox(
    boxOf(container.getBoundingClientRect()),
    frame.width(),
    frame.height()
  );

  post({
    composition: frame.composition(),
    frame: frame.frame(),
    rect: drag === null ? null : normalisedRect(drag.from, drag.to, video),
    type: "capture",
  });
}

function overlay(): HTMLElement {
  const marquee = document.createElement("div");

  marquee.setAttribute(OVERLAY_ATTR, "");
  marquee.style.position = "fixed";
  marquee.style.pointerEvents = "none";
  marquee.style.display = "none";
  marquee.style.left = "0";
  marquee.style.top = "0";
  marquee.style.zIndex = String(TOP);
  marquee.style.boxSizing = "border-box";
  marquee.style.border = `1px dashed ${ACCENT}`;
  marquee.style.background = ACCENT_SOFT;

  overlayRoot().append(marquee);

  return marquee;
}

function paint(marquee: HTMLElement, from: Point, to: Point): void {
  marquee.style.display = "block";
  marquee.style.left = `${Math.min(from.x, to.x)}px`;
  marquee.style.top = `${Math.min(from.y, to.y)}px`;
  marquee.style.width = `${Math.abs(to.x - from.x)}px`;
  marquee.style.height = `${Math.abs(to.y - from.y)}px`;
}

function boxOf(rect: DOMRect): Box {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function ratio(offset: number, size: number): number {
  return Math.min(Math.max(offset / size, 0), 1);
}
