import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
  spyOn,
} from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, render } from "@testing-library/react";
import { Effect } from "effect";
import {
  cameraCentre,
  INITIAL_PREVIEW_CAMERA,
  type PreviewCamera,
  SELECTION_ZOOM,
} from "@/lib/studio/preview-camera";
import { hydrateSettings } from "@/lib/studio/settings";
import { useCameraView, usePreviewCamera } from "./use-preview-camera";

const VIDEO = { height: 1080, width: 1920 };
const KEY = "p:intro:1920:1080";

let viewportSize = { height: 800, width: 1000 };

class SizedObserver {
  readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    this.callback(
      [{ contentRect: viewportSize } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
  readonly disconnect = mock();
  readonly unobserve = mock();
}

function store(entries: readonly [string, unknown][]) {
  const written = new Map<string, unknown>();
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:store|load") {
      return 7;
    }
    if (cmd === "plugin:store|entries") {
      return entries;
    }
    if (cmd === "plugin:store|set") {
      const { key, value } = payload as { key: string; value: unknown };
      written.set(key, value);
      return null;
    }
    return null;
  });
  return written;
}

type Camera = ReturnType<typeof usePreviewCamera> &
  ReturnType<typeof useCameraView>;

async function mount(saved?: PreviewCamera & { key?: string }) {
  const written = store(
    saved
      ? [
          [
            "canvasCameras",
            JSON.stringify([{ key: saved.key ?? KEY, ...saved }]),
          ],
        ]
      : []
  );
  await Effect.runPromise(hydrateSettings);
  const view: { current: Camera | null } = { current: null };
  function Harness() {
    const camera = usePreviewCamera(VIDEO, "p:intro", () => undefined);
    const shown = useCameraView(camera);
    view.current = { ...camera, ...shown };
    return (
      <div>
        <div data-testid="viewport" ref={camera.viewport} />
      </div>
    );
  }
  const rendered = render(<Harness />);
  const viewport = rendered.getByTestId("viewport");
  const camera = () => (view.current as Camera).camera;
  const press = (init: KeyboardEventInit) =>
    act(() => {
      viewport.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ...init })
      );
    });
  const advance = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  return { advance, camera, press, rendered, view, viewport, written };
}

const fitted = { x: 24, y: 132.25, zoom: 952 / 1920 };

describe("usePreviewCamera", () => {
  beforeEach(() => {
    viewportSize = { height: 800, width: 1000 };
    jest.useFakeTimers();
    globalThis.ResizeObserver =
      SizedObserver as unknown as typeof ResizeObserver;
    spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) =>
        setTimeout(() => callback(performance.now()), 16) as unknown as number
    );
    spyOn(globalThis, "cancelAnimationFrame").mockImplementation((frame) =>
      clearTimeout(frame)
    );
    spyOn(window, "matchMedia").mockImplementation(
      (query) => ({ matches: false, media: query }) as MediaQueryList
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fits a video without a remembered camera at once", async () => {
    const { camera } = await mount();

    expect(camera().zoom).toBeCloseTo(fitted.zoom);
  });

  it("animates a fit over about 200 ms", async () => {
    const { advance, camera, press } = await mount({ x: 0, y: 0, zoom: 4 });
    expect(camera().zoom).toBe(4);

    press({ code: "Digit1", key: "!", shiftKey: true });
    expect(camera().zoom).toBe(4);

    advance(96);
    const midway = camera().zoom;
    expect(midway).toBeLessThan(4);
    expect(midway).toBeGreaterThan(fitted.zoom);

    advance(160);
    expect(camera().zoom).toBeCloseTo(fitted.zoom);
    expect(camera().x).toBeCloseTo(fitted.x);
  });

  it("stops an animation where it is when the person pans", async () => {
    const { advance, camera, press, viewport } = await mount({
      x: 0,
      y: 0,
      zoom: 4,
    });

    press({ code: "Digit1", key: "!", shiftKey: true });
    advance(64);
    const interrupted = camera();
    act(() => {
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaX: 10,
        })
      );
    });
    advance(400);

    expect(camera().zoom).toBe(interrupted.zoom);
    expect(camera().x).toBeCloseTo(interrupted.x - 10);
  });

  it("zooms in steps that compound while an animation runs", async () => {
    const { advance, camera, press } = await mount({ x: 0, y: 0, zoom: 1 });

    press({ key: "=", metaKey: true });
    advance(32);
    press({ key: "=", metaKey: true });
    advance(400);

    expect(camera().zoom).toBeCloseTo(1.44);
  });

  it("jumps at once when the system asks for reduced motion", async () => {
    (
      window.matchMedia as unknown as ReturnType<typeof spyOn>
    ).mockImplementation(
      (query: string) => ({ matches: true, media: query }) as MediaQueryList
    );
    const { camera, press } = await mount({ x: 0, y: 0, zoom: 4 });

    press({ code: "Digit1", key: "!", shiftKey: true });

    expect(camera().zoom).toBeCloseTo(fitted.zoom);
  });

  it("does not jump while an edit holds the camera", async () => {
    const { advance, camera, view, viewport } = await mount({
      x: 0,
      y: 0,
      zoom: 4,
    });
    const before = camera();
    viewport.setAttribute("data-preview-editing", "");

    act(() => view.current?.fit());
    act(() => view.current?.zoomIn());
    advance(400);

    expect(camera()).toBe(before);
  });

  it("zooms to the selection but never past 400%", async () => {
    const { advance, camera, view, viewport } = await mount({
      x: 0,
      y: 0,
      zoom: 1,
    });
    const selection = document.createElement("div");
    selection.setAttribute("data-remocn-selection-bounds", "");
    viewport.append(selection);
    spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
    } as DOMRect);
    spyOn(selection, "getBoundingClientRect").mockReturnValue({
      bottom: 420,
      height: 40,
      left: 480,
      right: 520,
      top: 380,
      width: 40,
    } as DOMRect);
    const before = camera();

    act(() => view.current?.zoomToSelection());
    advance(400);

    expect(camera().zoom).not.toBe(before.zoom);
    expect(camera().zoom).toBe(SELECTION_ZOOM);
  });

  it("does nothing for zoom-to-selection with nothing selected", async () => {
    const { camera, view } = await mount({ x: 0, y: 0, zoom: 1 });
    const before = camera();

    act(() => view.current?.zoomToSelection());

    expect(camera()).toBe(before);
  });

  it("still fits when Shift+1 is pressed while a geometry handle has focus", async () => {
    const { advance, camera, viewport } = await mount({ x: 0, y: 0, zoom: 4 });
    const handle = document.createElement("button");
    handle.setAttribute("data-geometry-handle", "");
    viewport.append(handle);
    expect(camera().zoom).toBe(4);

    act(() => {
      handle.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "Digit1",
          key: "!",
          shiftKey: true,
        })
      );
    });
    advance(400);

    expect(camera().zoom).toBeCloseTo(fitted.zoom);
  });

  it("leaves room for a real occluder element when fitting", async () => {
    const { advance, camera, press, viewport } = await mount({
      x: 0,
      y: 0,
      zoom: 4,
    });
    spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
    } as DOMRect);
    const occluder = document.createElement("div");
    occluder.setAttribute("data-canvas-occludes", "top");
    viewport.append(occluder);
    spyOn(occluder, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
    } as DOMRect);

    press({ code: "Digit1", key: "!", shiftKey: true });
    advance(400);

    expect(camera().zoom).toBeCloseTo(fitted.zoom);
    expect(camera().y).not.toBeCloseTo(fitted.y);
    expect(camera().y).toBeCloseTo(182.25);
  });

  it("keeps the last valid camera when the canvas cannot be measured", async () => {
    viewportSize = { height: 0, width: 0 };
    const { advance, camera, view } = await mount();

    expect(camera()).toEqual(INITIAL_PREVIEW_CAMERA);

    act(() => view.current?.fit());
    advance(400);

    expect(camera()).toEqual(INITIAL_PREVIEW_CAMERA);
  });

  it("never produces a NaN or infinite camera while the canvas has no size", async () => {
    viewportSize = { height: 0, width: 0 };
    const { advance, camera, view } = await mount();

    act(() => view.current?.zoomIn());
    advance(400);

    expect(Number.isFinite(camera().x)).toBe(true);
    expect(Number.isFinite(camera().y)).toBe(true);
    expect(Number.isFinite(camera().zoom)).toBe(true);
  });

  it("restores a remembered camera with the same point at the centre", async () => {
    viewportSize = { height: 500, width: 700 };
    const { camera } = await mount({ x: 1500, y: 300, zoom: 3 });

    const centre = cameraCentre(camera(), viewportSize);
    expect(camera().zoom).toBe(3);
    expect(centre.x).toBeCloseTo(1500);
    expect(centre.y).toBeCloseTo(300);
  });

  it("fits again when the remembered camera was for other dimensions", async () => {
    const { camera } = await mount({
      key: "p:intro:1080:1920",
      x: 0,
      y: 0,
      zoom: 4,
    });

    expect(camera().zoom).toBeCloseTo(fitted.zoom);
  });

  it("draws the pixel grid from 800% and removes it below", async () => {
    const { advance, press, view } = await mount({ x: 960, y: 540, zoom: 8 });

    expect(view.current?.grid?.size).toBe(8);

    press({ key: "-", metaKey: true });
    advance(400);
    expect(view.current?.grid).toBeNull();
  });

  it("remembers the camera 500 ms after it settles, as its centre", async () => {
    const { advance, press, written } = await mount({
      x: 960,
      y: 540,
      zoom: 1,
    });

    press({ key: "0", metaKey: true });
    press({ key: "=", metaKey: true });
    advance(250);
    expect(written.has("canvasCameras")).toBe(false);
    advance(500);

    const [entry] = JSON.parse(String(written.get("canvasCameras")));
    expect(entry.key).toBe(KEY);
    expect(entry.zoom).toBeCloseTo(1.2);
    expect(entry.x).toBeCloseTo(960);
    expect(entry.y).toBeCloseTo(540);
  });

  it("does not remember a fit the person did not ask for", async () => {
    const { advance, rendered, written } = await mount();

    advance(1000);
    rendered.unmount();

    expect(written.has("canvasCameras")).toBe(false);
  });

  it("stops an animation as soon as the person presses to pan", async () => {
    const { advance, camera, press, viewport } = await mount({
      x: 0,
      y: 0,
      zoom: 4,
    });

    press({ code: "Digit1", key: "!", shiftKey: true });
    advance(64);
    const interrupted = camera();
    act(() => {
      viewport.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          cancelable: true,
          pointerId: 1,
        })
      );
    });
    advance(400);

    expect(camera()).toBe(interrupted);
  });

  it("pans by the pointer's travel on a middle-button drag over the video, and passes nothing on", async () => {
    const { advance, camera, viewport } = await mount({ x: 0, y: 0, zoom: 1 });
    const video = document.createElement("div");
    viewport.append(video);
    const reached = mock();
    video.addEventListener("pointerdown", reached);
    video.addEventListener("pointermove", reached);
    const pointer = (type: string, init: PointerEventInit) =>
      act(() => {
        video.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            ...init,
          })
        );
      });
    const before = camera();

    pointer("pointerdown", {
      button: 1,
      buttons: 4,
      clientX: 100,
      clientY: 100,
    });
    pointer("pointermove", { buttons: 4, clientX: 130, clientY: 110 });
    advance(20);
    pointer("pointermove", { buttons: 4, clientX: 160, clientY: 130 });
    pointer("pointerup", { button: 1, clientX: 160, clientY: 130 });
    advance(200);

    expect(camera().x).toBeCloseTo(before.x + 60);
    expect(camera().y).toBeCloseTo(before.y + 30);
    expect(camera().zoom).toBe(before.zoom);
    expect(reached).not.toHaveBeenCalled();
  });

  it("does not pan on a left-button drag that starts on the video", async () => {
    const { advance, camera, viewport } = await mount({ x: 0, y: 0, zoom: 1 });
    const video = document.createElement("div");
    viewport.append(video);
    const before = camera();

    act(() => {
      video.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          buttons: 1,
          clientX: 100,
          clientY: 100,
          pointerId: 1,
        })
      );
      video.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          buttons: 1,
          clientX: 160,
          clientY: 130,
          pointerId: 1,
        })
      );
    });
    advance(200);

    expect(camera()).toEqual(before);
  });

  it("remembers where an animation was going when the canvas goes away", async () => {
    const { advance, press, rendered, written } = await mount({
      x: 960,
      y: 540,
      zoom: 1,
    });

    press({ key: "=", metaKey: true });
    advance(64);
    rendered.unmount();

    const [entry] = JSON.parse(String(written.get("canvasCameras")));
    expect(entry.zoom).toBeCloseTo(1.2);
  });

  it("moves the view every frame of a pan and commits once it settles", async () => {
    store([
      ["canvasCameras", JSON.stringify([{ key: KEY, x: 0, y: 0, zoom: 1 }])],
    ]);
    await Effect.runPromise(hydrateSettings);
    const counts = { leaf: 0, owner: 0 };
    const shown: { camera: PreviewCamera } = {
      camera: { x: 0, y: 0, zoom: 1 },
    };
    function Leaf({ camera }: { camera: Camera }) {
      counts.leaf += 1;
      shown.camera = useCameraView(camera).camera;
      return null;
    }
    function Owner() {
      counts.owner += 1;
      const camera = usePreviewCamera(VIDEO, "p:intro", () => undefined);
      return (
        <div data-testid="viewport" ref={camera.viewport}>
          <Leaf camera={camera as Camera} />
        </div>
      );
    }
    const rendered = render(<Owner />);
    const viewport = rendered.getByTestId("viewport");
    const start = shown.camera.x;
    const { leaf, owner } = counts;

    for (let step = 0; step < 3; step += 1) {
      act(() => {
        viewport.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaX: 10,
          })
        );
        jest.advanceTimersByTime(16);
      });
    }

    expect(counts.owner).toBe(owner);
    expect(counts.leaf).toBe(leaf + 3);
    expect(shown.camera.x).toBeCloseTo(start - 30);

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(counts.owner).toBe(owner + 1);
    expect(shown.camera.x).toBeCloseTo(start - 30);
  });
});
