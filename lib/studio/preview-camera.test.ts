import { describe, expect, it } from "bun:test";
import {
  canvasInsets,
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  MAX_PREVIEW_ZOOM,
  SELECTION_ZOOM,
  screenToCanvas,
  zoomPreviewCamera,
} from "./preview-camera";

const viewport = { width: 1000, height: 800 };
const none = { top: 0, right: 0, bottom: 0, left: 0 };

describe("fitPreviewCamera", () => {
  it("never enlarges a whole video past 100%", () => {
    const camera = fitPreviewCamera(INITIAL_PREVIEW_CAMERA, { x: 0, y: 0, width: 100, height: 100 }, viewport, none);
    expect(camera.zoom).toBe(1);
  });

  it("enlarges a selection up to the ceiling it is given", () => {
    const camera = fitPreviewCamera(
      INITIAL_PREVIEW_CAMERA,
      { x: 400, y: 300, width: 50, height: 50 },
      viewport,
      none,
      SELECTION_ZOOM
    );
    expect(camera.zoom).toBe(SELECTION_ZOOM);
    expect(screenToCanvas({ x: 500, y: 400 }, camera)).toEqual({ x: 425, y: 325 });
  });

  it("keeps the ceiling within the camera's own limit", () => {
    const camera = fitPreviewCamera(INITIAL_PREVIEW_CAMERA, { x: 0, y: 0, width: 1, height: 1 }, viewport, none, 100);
    expect(camera.zoom).toBe(MAX_PREVIEW_ZOOM);
  });

  it("centres the content inside the unobscured area", () => {
    const insets = canvasInsets(true);
    const camera = fitPreviewCamera(INITIAL_PREVIEW_CAMERA, { x: 0, y: 0, width: 1920, height: 1080 }, { width: 1400, height: 900 }, insets);
    const left = camera.x;
    const right = 1400 - (camera.x + 1920 * camera.zoom);
    expect(left - insets.left).toBeCloseTo(right - insets.right);
  });

  it("keeps the camera when the viewport cannot be measured", () => {
    const camera = { x: 10, y: 20, zoom: 0.5 };
    expect(fitPreviewCamera(camera, { x: 0, y: 0, width: 100, height: 100 }, { width: 0, height: 0 })).toBe(camera);
  });
});

describe("canvasInsets", () => {
  it("reserves the inspector only while it is shown and adds a margin on every side", () => {
    expect(canvasInsets(false).right).toBe(32);
    expect(canvasInsets(true).right).toBe(376);
    expect(canvasInsets(false, 10)).toEqual({ top: 114, right: 42, bottom: 170, left: 42 });
  });
});

describe("zoomPreviewCamera", () => {
  it("keeps the point under the pointer in place", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToCanvas(anchor, INITIAL_PREVIEW_CAMERA);
    const camera = zoomPreviewCamera(INITIAL_PREVIEW_CAMERA, anchor, 2.5);
    expect(screenToCanvas(anchor, camera)).toEqual(before);
  });
});
