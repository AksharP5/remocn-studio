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
import { CanvasRulers } from "@/components/studio/canvas-rulers";
import { hydrateSettings, type StudioSettings } from "@/lib/studio/settings";
import { useCanvasRulers } from "./use-canvas-rulers";
import { usePreviewCamera } from "./use-preview-camera";

const VIDEO = { height: 1080, width: 1920 };
const VIEWPORT = { bottom: 800, left: 0, right: 1000, top: 0 };

class SizedObserver {
  readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    this.callback(
      [
        {
          contentRect: { height: 800, width: 1000 },
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }
  readonly disconnect = mock();
  readonly unobserve = mock();
}

function box({
  bottom,
  left,
  right,
  top,
}: {
  bottom: number;
  left: number;
  right: number;
  top: number;
}) {
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
  } as DOMRect;
}

function rectOf(element: HTMLElement): DOMRect {
  const side = element.getAttribute("data-canvas-occludes");
  const ruler =
    element instanceof HTMLCanvasElement
      ? element.parentElement?.getAttribute("data-canvas-occludes")
      : side;
  if (ruler === "top") {
    return box({ bottom: 20, left: 20, right: 1000, top: 0 });
  }
  if (ruler === "left") {
    return box({ bottom: 800, left: 0, right: 20, top: 20 });
  }
  if (element.dataset.testid === "viewport") {
    return box(VIEWPORT);
  }
  return box({ bottom: 0, left: 0, right: 0, top: 0 });
}

function settingsWith(canvasRulers: boolean | null) {
  return { canvasRulers } as StudioSettings;
}

interface Harnessed {
  camera: ReturnType<typeof usePreviewCamera>;
  rulers: ReturnType<typeof useCanvasRulers>;
}

async function mount(settings: StudioSettings | null = settingsWith(null)) {
  const written = new Map<string, unknown>();
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:store|load") {
      return 7;
    }
    if (cmd === "plugin:store|set") {
      const { key, value } = payload as { key: string; value: unknown };
      written.set(key, value);
    }
    if (cmd === "plugin:store|entries") {
      return [];
    }
    return null;
  });
  await Effect.runPromise(hydrateSettings);
  const view: { current: Harnessed | null } = { current: null };
  function Harness() {
    const camera = usePreviewCamera(VIDEO, "p:intro", () => undefined);
    const rulers = useCanvasRulers({
      camera: camera.camera,
      selection: null,
      settings,
      video: VIDEO,
      viewport: camera.viewport,
    });
    view.current = { camera, rulers };
    return (
      <section>
        <div data-testid="viewport" ref={camera.viewport}>
          {rulers.shown ? <CanvasRulers rulers={rulers} /> : null}
          <input aria-label="Name" />
        </div>
      </section>
    );
  }
  const rendered = render(<Harness />);
  const viewport = rendered.getByTestId("viewport");
  const press = (init: KeyboardEventInit, target: Element = viewport) =>
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ...init })
      );
    });
  const current = () => view.current as Harnessed;
  return { current, press, rendered, viewport, written };
}

const SHIFT_R = { code: "KeyR", key: "R", shiftKey: true };

describe("useCanvasRulers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.ResizeObserver =
      SizedObserver as unknown as typeof ResizeObserver;
    spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return rectOf(this);
      }
    );
    spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) =>
        setTimeout(() => callback(performance.now()), 16) as unknown as number
    );
    spyOn(globalThis, "cancelAnimationFrame").mockImplementation((frame) =>
      clearTimeout(frame)
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the rulers until the person hides them", async () => {
    const { current, rendered } = await mount();

    expect(current().rulers.shown).toBe(true);
    expect(
      rendered.container.querySelector('[data-canvas-occludes="left"] canvas')
    ).not.toBeNull();
  });

  it("hides them with ⇧R and remembers the choice", async () => {
    const { current, press, rendered, written } = await mount();

    press(SHIFT_R);

    expect(current().rulers.shown).toBe(false);
    expect(rendered.container.querySelector("canvas")).toBeNull();
    expect(written.get("canvasRulers")).toBe("hidden");

    press(SHIFT_R);
    expect(written.get("canvasRulers")).toBe("shown");
  });

  it("starts hidden when they were hidden before a relaunch", async () => {
    const { current, rendered } = await mount(settingsWith(false));

    expect(current().rulers.shown).toBe(false);
    expect(rendered.container.querySelector("canvas")).toBeNull();
  });

  it("leaves ⇧R alone in a text field and while an edit holds the canvas", async () => {
    const { current, press, rendered, viewport } = await mount();

    press(SHIFT_R, rendered.getByLabelText("Name"));
    expect(current().rulers.shown).toBe(true);

    viewport.setAttribute("data-preview-editing", "");
    press(SHIFT_R);
    expect(current().rulers.shown).toBe(true);
  });

  it("does not take ⌘⇧R, which belongs to the menu", async () => {
    const { current, press } = await mount();

    press({ ...SHIFT_R, metaKey: true });

    expect(current().rulers.shown).toBe(true);
  });

  it("keeps the fitted video clear of the rulers", async () => {
    const shown = await mount();
    const withRulers = shown.current().camera.camera;
    shown.rendered.unmount();
    const hidden = await mount(settingsWith(false));
    const withoutRulers = hidden.current().camera.camera;

    expect(withRulers.x).toBeCloseTo(20 + 24);
    expect(withRulers.y).toBeGreaterThanOrEqual(20 + 24);
    expect(withoutRulers.x).toBeCloseTo(24);
  });

  it("marks the pointer on the top ruler", async () => {
    const strokes: [number, number][] = [];
    const context = new Proxy(
      {},
      {
        get: (_target, property) =>
          property === "moveTo"
            ? (x: number, y: number) => strokes.push([x, y])
            : () => undefined,
        set: () => true,
      }
    );
    spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    const { viewport } = await mount();
    strokes.length = 0;

    act(() => {
      viewport.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: 520,
          clientY: 300,
        })
      );
      jest.advanceTimersByTime(20);
    });

    expect(strokes).toContainEqual([500.5, 0]);
    expect(strokes).toContainEqual([0, 280.5]);
  });
});
