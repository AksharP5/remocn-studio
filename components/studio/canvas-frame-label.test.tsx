import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, render } from "@testing-library/react";
import { Profiler } from "react";
import type { FrameCamera, FrameChrome } from "@/hooks/use-frame-label";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { PreviewCamera } from "@/lib/studio/preview-camera";
import { WORKING_PHRASES } from "@/lib/studio/working-phrases";

type Turn = Pick<OpenTurn, "isRunning" | "permission" | "source">;

const IDLE: Turn = { isRunning: false, permission: null, source: null };
const RUNNING: Turn = { isRunning: true, permission: null, source: null };
const turn: { current: Turn } = { current: IDLE };

const provider = await import("@/components/studio/studio-provider");
mock.module("@/components/studio/studio-provider", () => ({
  ...provider,
  useStudioTurn: () => turn.current,
}));

const { CanvasFrameLabel } = await import(
  "@/components/studio/canvas-frame-label"
);

const NO_CHROME: FrameChrome = { inspector: false, rulers: false };

function stage(start: PreviewCamera) {
  let shown = start;
  const listeners = new Set<() => void>();
  const viewport = document.createElement("div");
  viewport.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 800);
  document.body.append(viewport);
  const camera: FrameCamera = {
    bounds: { height: 800, width: 1000 },
    frameSize: { height: 1080, width: 1920 },
    view: {
      current: () => shown,
      subscribe: (listen) => {
        listeners.add(listen);
        return () => {
          listeners.delete(listen);
        };
      },
    },
    viewport: { current: viewport },
  };
  const move = (next: PreviewCamera) => {
    shown = next;
    for (const listen of listeners) {
      listen();
    }
  };
  const cover = (side: string, rect: DOMRect) => {
    const chrome = document.createElement("div");
    chrome.setAttribute("data-canvas-occludes", side);
    chrome.getBoundingClientRect = () => rect;
    viewport.append(chrome);
  };
  return { camera, cover, listeners, move };
}

function labelIn(container: HTMLElement): HTMLElement {
  const label = container.querySelector<HTMLElement>(
    "[data-canvas-frame-label]"
  );
  if (label === null) {
    throw new Error("no frame label");
  }
  return label;
}

afterEach(() => {
  turn.current = IDLE;
  document.body.replaceChildren();
});

describe("CanvasFrameLabel", () => {
  it("names the open video just above the frame's top-left corner", () => {
    const { camera } = stage({ x: 60, y: 140, zoom: 0.25 });

    const { container } = render(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    const label = labelIn(container);

    expect(label).toHaveTextContent("Launch");
    expect(label.hidden).toBe(false);
    expect(label.style.transform).toBe("translate(60px, 118px)");
    expect(label.style.maxWidth).toBe("480px");
    expect(label).toHaveAttribute("aria-hidden", "true");
    expect(label).toHaveClass("pointer-events-none");
  });

  it("follows the camera without rendering again", () => {
    const { camera, move } = stage({ x: 60, y: 140, zoom: 0.25 });
    let commits = 0;
    const counted = () => {
      commits += 1;
    };

    const { container } = render(
      <Profiler id="label" onRender={counted}>
        <CanvasFrameLabel
          camera={camera}
          chrome={NO_CHROME}
          name="Launch"
          shown
        />
      </Profiler>
    );
    const before = commits;
    act(() => move({ x: -100, y: 300, zoom: 0.5 }));
    const label = labelIn(container);

    expect(label.style.transform).toBe("translate(0px, 278px)");
    expect(label.style.maxWidth).toBe("860px");
    expect(commits).toBe(before);
  });

  it("hides while the frame's top edge is under the toolbar or off the canvas", () => {
    const { camera, cover, move } = stage({ x: 60, y: 140, zoom: 0.25 });
    cover("top", new DOMRect(0, 0, 1000, 68));

    const { container } = render(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    const label = labelIn(container);
    expect(label.hidden).toBe(false);

    act(() => move({ x: 60, y: 80, zoom: 0.25 }));
    expect(label.hidden).toBe(true);

    act(() => move({ x: 60, y: 900, zoom: 0.25 }));
    expect(label.hidden).toBe(true);

    act(() => move({ x: 60, y: 140, zoom: 0.25 }));
    expect(label.hidden).toBe(false);
  });

  it("measures the chrome again when the rulers or the inspector change", () => {
    const { camera, cover } = stage({ x: 10, y: 140, zoom: 0.5 });

    const { container, rerender } = render(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    const label = labelIn(container);
    expect(label.style.transform).toBe("translate(10px, 118px)");

    cover("left", new DOMRect(0, 20, 20, 780));
    cover("right", new DOMRect(660, 0, 340, 800));
    rerender(
      <CanvasFrameLabel
        camera={camera}
        chrome={{ inspector: true, rulers: true }}
        name="Launch"
        shown
      />
    );

    expect(label.style.transform).toBe("translate(20px, 118px)");
    expect(label.style.maxWidth).toBe("640px");
  });

  it("swaps the name for the wide thinking mark and a working phrase while the open chat's turn works", () => {
    const { camera } = stage({ x: 60, y: 140, zoom: 0.25 });
    turn.current = RUNNING;

    const { container, rerender } = render(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    const label = labelIn(container);
    expect(label.children).toHaveLength(2);
    expect(label).not.toHaveTextContent("Launch");
    expect(
      WORKING_PHRASES.some((phrase) => label.textContent?.includes(phrase))
    ).toBe(true);
    expect(label.lastElementChild).toHaveClass("shimmer");
    expect(label.firstElementChild?.children).toHaveLength(3);

    turn.current = { ...RUNNING, permission: {} as Turn["permission"] };
    rerender(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    expect(label.children).toHaveLength(1);

    turn.current = { ...RUNNING, source: {} as Turn["source"] };
    rerender(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    expect(label.children).toHaveLength(1);

    turn.current = IDLE;
    rerender(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    expect(label.children).toHaveLength(1);
    expect(label).toHaveTextContent("Launch");
  });

  it("draws nothing while the video is not shown or no video is open", () => {
    const { camera, listeners } = stage({ x: 60, y: 140, zoom: 0.25 });

    const { container, rerender } = render(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown={false}
      />
    );
    expect(container.querySelector("[data-canvas-frame-label]")).toBeNull();

    rerender(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name={undefined}
        shown
      />
    );
    expect(container.querySelector("[data-canvas-frame-label]")).toBeNull();
    expect(listeners.size).toBe(0);

    rerender(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    expect(labelIn(container).style.transform).toBe("translate(60px, 118px)");
  });

  it("stops following the camera once it is gone", () => {
    const { camera, listeners } = stage({ x: 60, y: 140, zoom: 0.25 });

    const { unmount } = render(
      <CanvasFrameLabel
        camera={camera}
        chrome={NO_CHROME}
        name="Launch"
        shown
      />
    );
    expect(listeners.size).toBe(1);

    unmount();
    expect(listeners.size).toBe(0);
  });
});
