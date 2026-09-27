export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasRect extends CanvasPoint {
  height: number;
  width: number;
}

export interface PreviewCamera extends CanvasPoint {
  zoom: number;
}

export interface CanvasInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export const MIN_PREVIEW_ZOOM = 0.05;
export const MAX_PREVIEW_ZOOM = 8;
export const INITIAL_PREVIEW_CAMERA: PreviewCamera = { x: 0, y: 0, zoom: 1 };
export const SELECTION_ZOOM = 4;
export const SELECTION_BOUNDS_ATTR = "data-remocn-selection-bounds";
export const SELECTION_LABEL_ATTR = "data-remocn-selection-label";

export const OCCLUDES_ATTR = "data-canvas-occludes";

export interface CanvasBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface Occluder {
  rect: CanvasBox;
  side: keyof CanvasInsets;
}

export function occludedInsets(
  viewport: CanvasBox,
  occluders: readonly Occluder[],
  margin: number
): CanvasInsets {
  const insets = { bottom: margin, left: margin, right: margin, top: margin };
  for (const { rect, side } of occluders) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) {
      continue;
    }
    const covered = {
      bottom: viewport.bottom - rect.top,
      left: rect.right - viewport.left,
      right: viewport.right - rect.left,
      top: rect.bottom - viewport.top,
    }[side];
    insets[side] = Math.max(insets[side], covered + margin);
  }
  return insets;
}

function finitePoint(point: CanvasPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function validCamera(camera: PreviewCamera): boolean {
  return finitePoint(camera) && Number.isFinite(camera.zoom) && camera.zoom > 0;
}

export function canvasToScreen(
  point: CanvasPoint,
  camera: PreviewCamera
): CanvasPoint {
  return {
    x: camera.x + point.x * camera.zoom,
    y: camera.y + point.y * camera.zoom,
  };
}

export function screenToCanvas(
  point: CanvasPoint,
  camera: PreviewCamera
): CanvasPoint {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  };
}

export function panPreviewCamera(
  camera: PreviewCamera,
  delta: CanvasPoint
): PreviewCamera {
  if (!(validCamera(camera) && finitePoint(delta))) {
    return camera;
  }
  const next = { ...camera, x: camera.x + delta.x, y: camera.y + delta.y };
  return finitePoint(next) ? next : camera;
}

export function zoomPreviewCamera(
  camera: PreviewCamera,
  anchor: CanvasPoint,
  zoom: number
): PreviewCamera {
  if (!(validCamera(camera) && finitePoint(anchor) && Number.isFinite(zoom))) {
    return camera;
  }
  const bounded = Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, zoom));
  if (bounded === camera.zoom) {
    return camera;
  }
  const point = screenToCanvas(anchor, camera);
  const next = {
    x: anchor.x - point.x * bounded,
    y: anchor.y - point.y * bounded,
    zoom: bounded,
  };
  return finitePoint(next) ? next : camera;
}

export function fitPreviewCamera(
  camera: PreviewCamera,
  content: CanvasRect,
  viewport: { width: number; height: number },
  insets: CanvasInsets = { bottom: 32, left: 32, right: 32, top: 32 },
  maxZoom = 1
): PreviewCamera {
  if (
    !(
      finitePoint(content) &&
      [content.width, content.height, viewport.width, viewport.height].every(
        (value) => Number.isFinite(value) && value > 0
      ) &&
      Object.values(insets).every(
        (value) => Number.isFinite(value) && value >= 0
      )
    )
  ) {
    return camera;
  }
  const width = viewport.width - insets.left - insets.right;
  const height = viewport.height - insets.top - insets.bottom;
  if (width <= 0 || height <= 0) {
    return camera;
  }
  const zoom = Math.max(
    MIN_PREVIEW_ZOOM,
    Math.min(
      maxZoom,
      MAX_PREVIEW_ZOOM,
      width / content.width,
      height / content.height
    )
  );
  const next = {
    x: insets.left + width / 2 - (content.x + content.width / 2) * zoom,
    y: insets.top + height / 2 - (content.y + content.height / 2) * zoom,
    zoom,
  };
  return validCamera(next) ? next : camera;
}

export interface CanvasSize {
  height: number;
  width: number;
}

function centreOf(viewport: CanvasSize): CanvasPoint {
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

export function cameraCentre(
  camera: PreviewCamera,
  viewport: CanvasSize
): CanvasPoint {
  return screenToCanvas(centreOf(viewport), camera);
}

export function cameraAt(
  centre: CanvasPoint,
  zoom: number,
  viewport: CanvasSize
): PreviewCamera | null {
  const bounded = Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, zoom));
  const middle = centreOf(viewport);
  const next = {
    x: middle.x - centre.x * bounded,
    y: middle.y - centre.y * bounded,
    zoom: bounded,
  };
  return finitePoint(centre) && validCamera(next) ? next : null;
}

export function interpolateCamera(
  from: PreviewCamera,
  to: PreviewCamera,
  progress: number,
  viewport: CanvasSize
): PreviewCamera {
  if (progress >= 1 || !validCamera(from)) {
    return to;
  }
  if (progress <= 0 || !validCamera(to)) {
    return from;
  }
  const start = cameraCentre(from, viewport);
  const end = cameraCentre(to, viewport);
  const zoom = Math.exp(
    Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * progress
  );
  return (
    cameraAt(
      {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      },
      zoom,
      viewport
    ) ?? to
  );
}

export function easeOutCubic(progress: number): number {
  const rest = 1 - Math.max(0, Math.min(1, progress));
  return 1 - rest * rest * rest;
}

const TICK_MANTISSAS = [1, 2, 5] as const;
const MAX_TICKS = 2000;

export interface RulerTicks {
  major: readonly number[];
  minor: readonly number[];
  step: number;
}

const NO_TICKS: RulerTicks = { major: [], minor: [], step: 0 };

export function rulerStep(zoom: number, spacing = 60): number {
  if (!(Number.isFinite(zoom) && zoom > 0 && spacing > 0)) {
    return 0;
  }
  for (let power = 1; ; power *= 10) {
    for (const mantissa of TICK_MANTISSAS) {
      if (mantissa * power * zoom >= spacing) {
        return mantissa * power;
      }
    }
  }
}

function multiplesOf(step: number, from: number, to: number): number[] {
  const values: number[] = [];
  const first = Math.ceil(from / step);
  const last = Math.floor(to / step);
  if (last - first > MAX_TICKS) {
    return values;
  }
  for (let index = first; index <= last; index += 1) {
    values.push(index * step);
  }
  return values;
}

export function rulerTicks(
  from: number,
  to: number,
  zoom: number,
  spacing = 60
): RulerTicks {
  const step = rulerStep(zoom, spacing);
  if (step === 0 || !(Number.isFinite(from) && Number.isFinite(to))) {
    return NO_TICKS;
  }
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const divisions = String(step).startsWith("2") ? 2 : 5;
  const minorStep = step / divisions;
  return {
    major: multiplesOf(step, low, high),
    minor:
      minorStep >= 1
        ? multiplesOf(minorStep, low, high).filter(
            (value) => Math.round(value / minorStep) % divisions !== 0
          )
        : [],
    step,
  };
}

export const PIXEL_GRID_ZOOM = 8;

export interface PixelGrid extends CanvasRect {
  offsetX: number;
  offsetY: number;
  size: number;
}

export function pixelGrid(
  camera: PreviewCamera,
  video: CanvasSize,
  viewport: CanvasSize
): PixelGrid | null {
  if (!validCamera(camera) || camera.zoom < PIXEL_GRID_ZOOM - 1e-6) {
    return null;
  }
  const left = Math.max(0, camera.x);
  const top = Math.max(0, camera.y);
  const right = Math.min(viewport.width, camera.x + video.width * camera.zoom);
  const bottom = Math.min(
    viewport.height,
    camera.y + video.height * camera.zoom
  );
  if (right <= left || bottom <= top) {
    return null;
  }
  const size = camera.zoom;
  const offset = (start: number, edge: number) =>
    (((start - edge) % size) + size) % size;
  return {
    height: bottom - top,
    offsetX: offset(camera.x, left),
    offsetY: offset(camera.y, top),
    size,
    width: right - left,
    x: left,
    y: top,
  };
}

export interface SurroundRect extends CanvasRect {
  id: "bottom" | "left" | "right" | "top";
}

export function surroundOf(
  camera: PreviewCamera,
  video: CanvasSize,
  viewport: CanvasSize
): readonly SurroundRect[] {
  const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(max, value));
  const frameLeft = clamp(camera.x, viewport.width);
  const frameRight = clamp(
    camera.x + video.width * camera.zoom,
    viewport.width
  );
  const frameTop = clamp(camera.y, viewport.height);
  const frameBottom = clamp(
    camera.y + video.height * camera.zoom,
    viewport.height
  );
  const middle = frameBottom - frameTop;
  return [
    { height: frameTop, id: "top", width: viewport.width, x: 0, y: 0 },
    {
      height: viewport.height - frameBottom,
      id: "bottom",
      width: viewport.width,
      x: 0,
      y: frameBottom,
    },
    { height: middle, id: "left", width: frameLeft, x: 0, y: frameTop },
    {
      height: middle,
      id: "right",
      width: viewport.width - frameRight,
      x: frameRight,
      y: frameTop,
    },
  ];
}
