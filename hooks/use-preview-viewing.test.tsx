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
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { useRef } from "react";
import { hydrateSettings } from "@/lib/studio/settings";
import { useCameraView, usePreviewCamera } from "./use-preview-camera";
import {
  FULL_SCREEN_UNAVAILABLE,
  type PreviewViewing,
  usePreviewViewing,
  VIEWING_IDLE_MS,
} from "./use-preview-viewing";

const internals = () =>
  (
    window as unknown as {
      __TAURI_INTERNALS__: {
        runCallback: (id: number, payload: unknown) => void;
      };
    }
  ).__TAURI_INTERNALS__;

function core({
  failing = false,
  full = false,
}: {
  failing?: boolean;
  full?: boolean;
} = {}) {
  const state = { full };
  const requests: boolean[] = [];
  const listeners = new Map<string, number>();
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = payload as Record<string, unknown>;
    if (cmd === "plugin:window|is_fullscreen") {
      return state.full;
    }
    if (cmd === "plugin:window|set_fullscreen") {
      if (failing) {
        throw new Error("not allowed");
      }
      requests.push(args.value as boolean);
      return null;
    }
    if (cmd === "plugin:event|listen") {
      listeners.set(args.event as string, args.handler as number);
      return listeners.size;
    }
    if (cmd === "plugin:event|unlisten") {
      return null;
    }
    if (cmd === "plugin:store|load") {
      return 7;
    }
    if (cmd === "plugin:store|entries") {
      return [];
    }
    return null;
  });
  return {
    listeners,
    requests,
    resize(fullNow: boolean) {
      state.full = fullNow;
      const id = listeners.get("tauri://resize");
      if (id === undefined) {
        throw new Error("nobody listens to tauri://resize");
      }
      internals().runCallback(id, {
        event: "tauri://resize",
        id,
        payload: { height: 900, width: 1440 },
      });
    },
  };
}

interface Options {
  enabled?: boolean;
  playing?: boolean;
  ready?: boolean;
}

function mount(initial: Options = {}) {
  const toggle = mock();
  const view: { current: PreviewViewing | null } = { current: null };
  function Harness({ enabled = true, playing = false, ready = true }: Options) {
    const surface = useRef<HTMLElement>(null);
    const viewing = usePreviewViewing({
      enabled,
      playing,
      ready,
      surface,
      toggle,
    });
    view.current = viewing;
    return (
      <>
        <section data-testid="surface" ref={surface}>
          <div data-testid="canvas" tabIndex={-1} />
          <input aria-label="Name" />
          {viewing.viewing ? (
            <div data-testid="shield" ref={viewing.shield} tabIndex={-1} />
          ) : null}
          <div data-testid="controls" />
        </section>
        <input aria-label="Outside" />
      </>
    );
  }
  const rendered = render(<Harness {...initial} />);
  const current = () => view.current as PreviewViewing;
  const press = (target: Element, init: KeyboardEventInit) =>
    act(() => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ...init })
      );
    });
  return { current, press, rendered, toggle };
}

describe("usePreviewViewing", () => {
  it("opens with F on the focused canvas and closes with Esc", async () => {
    const window = core();
    const { current, press, rendered } = mount();
    const canvas = rendered.getByTestId("canvas");
    canvas.focus();

    press(canvas, { key: "f" });
    expect(current().viewing).toBe(true);
    expect(document.activeElement).toBe(rendered.getByTestId("shield"));
    await waitFor(() => expect(window.requests).toEqual([true]));

    const after = mock();
    globalThis.window.addEventListener("keydown", after);
    press(rendered.getByTestId("shield"), { key: "Escape" });
    globalThis.window.removeEventListener("keydown", after);

    expect(current().viewing).toBe(false);
    expect(after).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(canvas);
    await waitFor(() => expect(window.requests).toEqual([true, false]));
  });

  it("does not open while typing, outside the canvas or before a video is ready", () => {
    core();
    const { current, press, rendered } = mount();

    press(rendered.getByLabelText("Name"), { key: "f" });
    press(rendered.getByLabelText("Outside"), { key: "f" });
    press(rendered.getByTestId("canvas"), { key: "f", metaKey: true });
    expect(current().viewing).toBe(false);

    rendered.rerender(<div />);
    const later = mount({ ready: false });
    press(later.rendered.getAllByTestId("canvas")[0] as Element, {
      key: "f",
    });
    later.current().toggle();
    expect(later.current().viewing).toBe(false);
    expect(later.current().canEnter).toBe(false);
  });

  it("leaves a window that was already full screen as it was", async () => {
    const window = core({ full: true });
    const { current, press, rendered } = mount();

    act(() => current().toggle());
    expect(current().viewing).toBe(true);
    press(rendered.getByTestId("shield"), { key: "f" });
    expect(current().viewing).toBe(false);

    await act(() => Promise.resolve());
    expect(window.requests).toEqual([]);
  });

  it("closes when the window leaves full screen by other means", async () => {
    const window = core();
    const { current } = mount();

    act(() => current().toggle());
    await waitFor(() =>
      expect(window.listeners.has("tauri://resize")).toBe(true)
    );

    act(() => window.resize(false));
    await act(() => Promise.resolve());
    expect(current().viewing).toBe(true);

    act(() => window.resize(true));
    await act(() => Promise.resolve());
    act(() => window.resize(false));
    await waitFor(() => expect(current().viewing).toBe(false));
  });

  it("fills the window and says so when full screen is refused", async () => {
    core({ failing: true });
    const { current } = mount();

    act(() => current().toggle());

    await waitFor(() => expect(current().notice).toBe(FULL_SCREEN_UNAVAILABLE));
    expect(current().viewing).toBe(true);
  });

  it("plays and pauses with K and a click, but not with a pan or a pinch", () => {
    core();
    const { current, press, rendered, toggle } = mount();

    press(rendered.getByTestId("canvas"), { key: "k" });
    expect(toggle).not.toHaveBeenCalled();

    act(() => current().toggle());
    const shield = rendered.getByTestId("shield");
    press(shield, { key: "k" });
    fireEvent.click(shield);
    expect(toggle).toHaveBeenCalledTimes(2);

    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true });
    act(() => {
      shield.dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("closes when the canvas is hidden", () => {
    core();
    const { current, rendered } = mount();

    act(() => current().toggle());
    rendered.rerender(<div />);
    const again = mount({ enabled: false });

    expect(again.current().viewing).toBe(false);
    expect(again.current().canEnter).toBe(false);
  });
});

describe("usePreviewViewing controls", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fade while the video plays and the pointer rests on it", () => {
    core();
    const { current, rendered } = mount({ playing: true });

    act(() => current().toggle());
    expect(current().controlsHidden).toBe(false);

    act(() => {
      jest.advanceTimersByTime(VIEWING_IDLE_MS);
    });
    expect(current().controlsHidden).toBe(true);

    fireEvent.pointerMove(rendered.getByTestId("shield"));
    expect(current().controlsHidden).toBe(false);

    act(() => {
      jest.advanceTimersByTime(VIEWING_IDLE_MS);
    });
    expect(current().controlsHidden).toBe(true);
  });

  it("stay while paused or while the pointer is over them", () => {
    core();
    const { current, rendered } = mount({ playing: false });

    act(() => current().toggle());
    act(() => {
      jest.advanceTimersByTime(VIEWING_IDLE_MS * 2);
    });
    expect(current().controlsHidden).toBe(false);

    rendered.rerender(<div />);
    const playing = mount({ playing: true });
    act(() => playing.current().toggle());
    fireEvent.pointerMove(playing.rendered.getByTestId("controls"));
    act(() => {
      jest.advanceTimersByTime(VIEWING_IDLE_MS * 2);
    });
    expect(playing.current().controlsHidden).toBe(false);
  });
});

const VIDEO = { height: 1080, width: 1920 };

let viewportSize = { height: 800, width: 1000 };
let observed: (() => void) | null = null;

class SizedObserver {
  readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    observed = () =>
      this.callback(
        [{ contentRect: viewportSize } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    observed();
  }
  readonly disconnect = mock();
  readonly unobserve = mock();
}

describe("usePreviewCamera while viewing", () => {
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

  async function mountCamera() {
    const written: string[] = [];
    mockIPC((cmd, payload) => {
      if (cmd === "plugin:store|load") {
        return 7;
      }
      if (cmd === "plugin:store|entries") {
        return [];
      }
      if (cmd === "plugin:store|set") {
        written.push((payload as { key: string }).key);
      }
      return null;
    });
    await Effect.runPromise(hydrateSettings);
    const view: {
      current: ReturnType<typeof useCameraView>["camera"] | null;
    } = { current: null };
    function Harness({
      size = VIDEO,
      viewing,
    }: {
      size?: typeof VIDEO;
      viewing: boolean;
    }) {
      const camera = usePreviewCamera(
        size,
        "p:intro",
        () => undefined,
        viewing
      );
      view.current = useCameraView(camera).camera;
      return <div data-testid="viewport" ref={camera.viewport} />;
    }
    const rendered = render(<Harness viewing={false} />);
    const viewport = rendered.getByTestId("viewport");
    const press = (init: KeyboardEventInit) =>
      act(() => {
        viewport.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, ...init })
        );
      });
    const settle = () =>
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    const camera = () => view.current as NonNullable<typeof view.current>;
    const setViewing = (viewing: boolean, size = VIDEO) =>
      rendered.rerender(<Harness size={size} viewing={viewing} />);
    return { camera, press, settle, setViewing, written };
  }

  it("fits the whole frame to the whole screen and restores the camera", async () => {
    const { camera, press, setViewing, settle, written } = await mountCamera();
    press({ key: "=", metaKey: true });
    settle();
    const before = camera();
    written.length = 0;

    setViewing(true);
    expect(camera().zoom).toBeCloseTo(1000 / 1920);
    expect(camera().x).toBeCloseTo(0);
    expect(camera().y).toBeCloseTo((800 - 1080 * (1000 / 1920)) / 2);

    viewportSize = { height: 1440, width: 3840 };
    act(() => observed?.());
    expect(camera().zoom).toBeCloseTo(1440 / 1080);

    press({ code: "Digit1", key: "!", shiftKey: true });
    settle();
    expect(camera().zoom).toBeCloseTo(1440 / 1080);
    expect(written).not.toContain("canvasCameras");

    setViewing(false);
    expect(camera()).toEqual(before);
  });

  it("frames a video whose size changed while viewing on its own", async () => {
    const { camera, press, setViewing, settle } = await mountCamera();
    press({ key: "=", metaKey: true });
    settle();

    setViewing(true);
    const resized = { height: 720, width: 1280 };
    setViewing(true, resized);
    expect(camera().zoom).toBeCloseTo(1000 / 1280);

    setViewing(false, resized);
    expect(camera().zoom).toBeCloseTo(952 / 1280);
  });
});
