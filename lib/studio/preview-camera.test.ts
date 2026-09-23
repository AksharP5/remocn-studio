import { describe, expect, it } from "bun:test";
import {
  fitPreviewCamera,
  INITIAL_PREVIEW_CAMERA,
  MAX_PREVIEW_ZOOM,
  occludedInsets,
  SELECTION_ZOOM,
  screenToCanvas,
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
});
