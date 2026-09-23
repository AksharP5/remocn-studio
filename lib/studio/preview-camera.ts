export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasRect extends CanvasPoint {
  width: number;
  height: number;
}

export interface PreviewCamera extends CanvasPoint {
  zoom: number;
}

export interface CanvasInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MIN_PREVIEW_ZOOM = 0.05;
export const MAX_PREVIEW_ZOOM = 8;
export const INITIAL_PREVIEW_CAMERA: PreviewCamera = { x: 0, y: 0, zoom: 1 };
export const SELECTION_ZOOM = 4;
export const SELECTION_BOUNDS_ATTR = "data-remocn-selection-bounds";

export function canvasInsets(inspector: boolean, margin = 0): CanvasInsets {
  return {
    top: 104 + margin,
    bottom: 160 + margin,
    left: 32 + margin,
    right: (inspector ? 376 : 32) + margin,
  };
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
  if (!validCamera(camera) || !finitePoint(delta)) return camera;
  const next = { ...camera, x: camera.x + delta.x, y: camera.y + delta.y };
  return finitePoint(next) ? next : camera;
}

export function zoomPreviewCamera(
  camera: PreviewCamera,
  anchor: CanvasPoint,
  zoom: number
): PreviewCamera {
  if (!validCamera(camera) || !finitePoint(anchor) || !Number.isFinite(zoom)) {
    return camera;
  }
  const bounded = Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, zoom));
  if (bounded === camera.zoom) return camera;
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
  insets: CanvasInsets = { top: 32, right: 32, bottom: 32, left: 32 },
  maxZoom = 1
): PreviewCamera {
  if (
    !finitePoint(content) ||
    ![content.width, content.height, viewport.width, viewport.height].every(
      (value) => Number.isFinite(value) && value > 0
    ) ||
    !Object.values(insets).every((value) => Number.isFinite(value) && value >= 0)
  ) {
    return camera;
  }
  const width = viewport.width - insets.left - insets.right;
  const height = viewport.height - insets.top - insets.bottom;
  if (width <= 0 || height <= 0) return camera;
  const zoom = Math.max(
    MIN_PREVIEW_ZOOM,
    Math.min(maxZoom, MAX_PREVIEW_ZOOM, width / content.width, height / content.height)
  );
  const next = {
    x: insets.left + width / 2 - (content.x + content.width / 2) * zoom,
    y: insets.top + height / 2 - (content.y + content.height / 2) * zoom,
    zoom,
  };
  return validCamera(next) ? next : camera;
}
