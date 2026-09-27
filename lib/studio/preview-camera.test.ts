import { describe, expect, it } from "bun:test";
import {
  cameraAt,
  cameraCentre,
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  interpolateCamera,
  MAX_PREVIEW_ZOOM,
  MIN_PREVIEW_ZOOM,
  occludedInsets,
  PIXEL_GRID_ZOOM,
  panPreviewCamera,
  pixelGrid,
  rulerStep,
  rulerTicks,
  SELECTION_ZOOM,
  screenToCanvas,
  surroundOf,
  zoomPreviewCamera,
} from "./preview-camera";

const viewport = { height: 800, width: 1000 };
const none = { bottom: 0, left: 0, right: 0, top: 0 };

describe("fitPreviewCamera", () => {
  it("never enlarges a whole video past 100%", () => {
    const camera = fitPreviewCamera(
      INITIAL_PREVIEW_CAMERA,
      { height: 100, width: 100, x: 0, y: 0 },
      viewport,
      none
    );
    expect(camera.zoom).toBe(1);
  });

  it("enlarges a selection up to the ceiling it is given", () => {
    const camera = fitPreviewCamera(
      INITIAL_PREVIEW_CAMERA,
      { height: 50, width: 50, x: 400, y: 300 },
      viewport,
      none,
      SELECTION_ZOOM
    );
    expect(camera.zoom).toBe(SELECTION_ZOOM);
    expect(screenToCanvas({ x: 500, y: 400 }, camera)).toEqual({
      x: 425,
      y: 325,
    });
  });

  it("keeps the ceiling within the camera's own limit", () => {
    const camera = fitPreviewCamera(
      INITIAL_PREVIEW_CAMERA,
      { height: 1, width: 1, x: 0, y: 0 },
      viewport,
      none,
      100
    );
    expect(camera.zoom).toBe(MAX_PREVIEW_ZOOM);
  });

  it("centres the content inside the unobscured area", () => {
    const insets = { bottom: 160, left: 24, right: 376, top: 104 };
    const camera = fitPreviewCamera(
      INITIAL_PREVIEW_CAMERA,
      { height: 1080, width: 1920, x: 0, y: 0 },
      { height: 900, width: 1400 },
      insets
    );
    const left = camera.x;
    const right = 1400 - (camera.x + 1920 * camera.zoom);
    expect(left - insets.left).toBeCloseTo(right - insets.right);
  });

  it("keeps the camera when the viewport cannot be measured", () => {
    const camera = { x: 10, y: 20, zoom: 0.5 };
    expect(
      fitPreviewCamera(
        camera,
        { height: 100, width: 100, x: 0, y: 0 },
        { height: 0, width: 0 }
      )
    ).toBe(camera);
  });

  it("keeps the camera when occluders leave no free space at all", () => {
    const camera = { x: 10, y: 20, zoom: 0.5 };
    const insets = { bottom: 500, left: 600, right: 600, top: 500 };
    expect(
      fitPreviewCamera(
        camera,
        { height: 100, width: 100, x: 0, y: 0 },
        viewport,
        insets
      )
    ).toBe(camera);
  });
});

describe("occludedInsets", () => {
  const viewportRect = { bottom: 800, left: 100, right: 1100, top: 50 };

  it("keeps the margin where nothing covers the canvas", () => {
    expect(occludedInsets(viewportRect, [], 24)).toEqual({
      bottom: 24,
      left: 24,
      right: 24,
      top: 24,
    });
  });

  it("reserves what each panel covers on its side, plus the margin", () => {
    expect(
      occludedInsets(
        viewportRect,
        [
          {
            rect: { bottom: 130, left: 116, right: 400, top: 98 },
            side: "top",
          },
          {
            rect: { bottom: 800, left: 760, right: 1100, top: 50 },
            side: "right",
          },
          {
            rect: { bottom: 784, left: 116, right: 744, top: 656 },
            side: "bottom",
          },
        ],
        24
      )
    ).toEqual({ bottom: 168, left: 24, right: 364, top: 104 });
  });

  it("ignores a panel that is hidden and so measures nothing", () => {
    expect(
      occludedInsets(
        viewportRect,
        [{ rect: { bottom: 0, left: 0, right: 0, top: 0 }, side: "right" }],
        24
      ).right
    ).toBe(24);
  });
});

describe("zoomPreviewCamera", () => {
  it("keeps the point under the pointer in place", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToCanvas(anchor, INITIAL_PREVIEW_CAMERA);
    const camera = zoomPreviewCamera(INITIAL_PREVIEW_CAMERA, anchor, 2.5);
    expect(screenToCanvas(anchor, camera)).toEqual(before);
  });

  it("clamps a zoom past the ceiling to the maximum, keeping the pointer anchored", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToCanvas(anchor, INITIAL_PREVIEW_CAMERA);
    const camera = zoomPreviewCamera(INITIAL_PREVIEW_CAMERA, anchor, 500);

    expect(camera.zoom).toBe(MAX_PREVIEW_ZOOM);
    expect(screenToCanvas(anchor, camera)).toEqual(before);
  });

  it("clamps a zoom past the floor to the minimum, keeping the pointer anchored", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToCanvas(anchor, INITIAL_PREVIEW_CAMERA);
    const camera = zoomPreviewCamera(INITIAL_PREVIEW_CAMERA, anchor, 0.0001);

    expect(camera.zoom).toBe(MIN_PREVIEW_ZOOM);
    expect(screenToCanvas(anchor, camera)).toEqual(before);
  });

  it("does nothing more once already at the ceiling", () => {
    const atMax = { x: 0, y: 0, zoom: MAX_PREVIEW_ZOOM };
    expect(zoomPreviewCamera(atMax, { x: 300, y: 200 }, 999)).toBe(atMax);
  });

  it("never yields a non-finite camera for a non-finite request", () => {
    const camera = INITIAL_PREVIEW_CAMERA;
    expect(zoomPreviewCamera(camera, { x: 300, y: 200 }, Number.NaN)).toBe(
      camera
    );
    expect(zoomPreviewCamera(camera, { x: Number.NaN, y: 200 }, 2)).toBe(
      camera
    );
  });
});

describe("panPreviewCamera", () => {
  it("moves the camera by the pan delta", () => {
    const camera = { x: 10, y: 20, zoom: 1 };
    expect(panPreviewCamera(camera, { x: 5, y: -5 })).toEqual({
      x: 15,
      y: 15,
      zoom: 1,
    });
  });

  it("keeps the camera unchanged for a non-finite delta", () => {
    const camera = { x: 10, y: 20, zoom: 1 };
    expect(panPreviewCamera(camera, { x: Number.NaN, y: 0 })).toBe(camera);
    expect(
      panPreviewCamera(camera, { x: Number.POSITIVE_INFINITY, y: 0 })
    ).toBe(camera);
  });

  it("keeps an already-invalid camera unchanged rather than propagating NaN", () => {
    const camera = { x: Number.NaN, y: 0, zoom: 1 };
    expect(panPreviewCamera(camera, { x: 5, y: 5 })).toBe(camera);
  });
});

describe("interpolateCamera", () => {
  const from = { x: 100, y: 50, zoom: 0.5 };
  const to = { x: -3000, y: -1800, zoom: 4 };

  it("starts and ends exactly at the two cameras", () => {
    expect(interpolateCamera(from, to, 0, viewport)).toBe(from);
    expect(interpolateCamera(from, to, 1, viewport)).toBe(to);
  });

  it("moves the zoom geometrically", () => {
    const half = interpolateCamera(from, to, 0.5, viewport);
    expect(half.zoom).toBeCloseTo(Math.sqrt(from.zoom * to.zoom));
  });

  it("moves the video point at the centre in a straight line", () => {
    const start = cameraCentre(from, viewport);
    const end = cameraCentre(to, viewport);
    const quarter = cameraCentre(
      interpolateCamera(from, to, 0.25, viewport),
      viewport
    );
    expect(quarter.x).toBeCloseTo(start.x + (end.x - start.x) * 0.25);
    expect(quarter.y).toBeCloseTo(start.y + (end.y - start.y) * 0.25);
  });
});

describe("cameraAt", () => {
  it("keeps the same video point at the centre of a different viewport", () => {
    const camera = { x: -2400, y: -900, zoom: 3 };
    const centre = cameraCentre(camera, { height: 900, width: 1400 });
    const smaller = { height: 500, width: 700 };
    const restored = cameraAt(centre, camera.zoom, smaller);
    expect(restored?.zoom).toBe(3);
    const after = cameraCentre(restored ?? camera, smaller);
    expect(after.x).toBeCloseTo(centre.x);
    expect(after.y).toBeCloseTo(centre.y);
  });

  it("refuses a centre that is not a number", () => {
    expect(cameraAt({ x: Number.NaN, y: 0 }, 1, viewport)).toBeNull();
  });

  it("clamps a zoom outside the camera's range", () => {
    expect(cameraAt({ x: 0, y: 0 }, 999, viewport)?.zoom).toBe(
      MAX_PREVIEW_ZOOM
    );
    expect(cameraAt({ x: 0, y: 0 }, 0.0001, viewport)?.zoom).toBe(
      MIN_PREVIEW_ZOOM
    );
  });
});

describe("rulerTicks", () => {
  it("picks the smallest 1, 2, 5 step whose labels stay 60px apart", () => {
    expect(rulerStep(1)).toBe(100);
    expect(rulerStep(0.5)).toBe(200);
    expect(rulerStep(0.25)).toBe(500);
    expect(rulerStep(2)).toBe(50);
    expect(rulerStep(MAX_PREVIEW_ZOOM)).toBe(10);
    expect(rulerStep(0.05)).toBe(2000);
  });

  it("keeps labels at least 60px apart at every zoom", () => {
    for (let zoom = 0.05; zoom <= MAX_PREVIEW_ZOOM; zoom *= 1.07) {
      const step = rulerStep(zoom);
      expect(step * zoom).toBeGreaterThanOrEqual(60);
      expect(step * zoom).toBeLessThan(60 * 2.5);
    }
  });

  it("lists the multiples of the step inside the range", () => {
    const ticks = rulerTicks(-150, 420, 1);
    expect(ticks.major).toEqual([-100, 0, 100, 200, 300, 400]);
    expect(ticks.minor).toContain(20);
    expect(ticks.minor).not.toContain(100);
  });

  it("draws nothing for a zoom that is not a number", () => {
    expect(rulerTicks(0, 100, Number.NaN).major).toEqual([]);
  });
});

describe("pixelGrid", () => {
  const video = { height: 1080, width: 1920 };

  it("is absent below 800%", () => {
    expect(pixelGrid({ x: 0, y: 0, zoom: 7.9 }, video, viewport)).toBeNull();
  });

  it("covers the visible part of the frame from 800%, aligned to video pixels", () => {
    const grid = pixelGrid(
      { x: -1003, y: 20, zoom: PIXEL_GRID_ZOOM },
      video,
      viewport
    );
    expect(grid).toEqual({
      height: 780,
      offsetX: 5,
      offsetY: 0,
      size: 8,
      width: 1000,
      x: 0,
      y: 20,
    });
  });
});

describe("surroundOf", () => {
  it("covers the viewport around the frame and nothing beyond it", () => {
    const rects = surroundOf(
      { x: 100, y: 50, zoom: 0.25 },
      { height: 1080, width: 1920 },
      viewport
    );
    expect(rects).toEqual([
      { height: 50, id: "top", width: 1000, x: 0, y: 0 },
      { height: 480, id: "bottom", width: 1000, x: 0, y: 320 },
      { height: 270, id: "left", width: 100, x: 0, y: 50 },
      { height: 270, id: "right", width: 420, x: 580, y: 50 },
    ]);
  });

  it("stays inside the viewport when the frame is larger than it", () => {
    const rects = surroundOf(
      { x: -5000, y: -5000, zoom: 8 },
      { height: 1080, width: 1920 },
      viewport
    );
    for (const rect of rects) {
      expect(rect.width * rect.height).toBe(0);
    }
  });
});
