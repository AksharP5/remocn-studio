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
import { cameraCentre, type PreviewCamera } from "@/lib/studio/preview-camera";
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
