import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { PreviewControl, PreviewListener } from "@/hooks/use-preview";
import type { PreviewMessage } from "@/lib/studio/preview";
import {
  usePreviewTransport,
  useTransportEdge,
  useTransportFrame,
} from "./use-preview-transport";

const SCENES = [
  { duration: 90, from: 0, id: "a", name: "Intro" },
  { duration: 210, from: 90, id: "b", name: "Features" },
];

function setup() {
  const listeners = new Set<PreviewListener>();
  const send = mock();
  const preview = (composition: string): PreviewControl =>
    ({
      composition,
      frameOf: () => 0,
      isServing: true,
      onFrame: () => () => undefined,
      pick: { metadata: { durationInFrames: 300, fps: 30 } },
      playing: false,
      preview: { phase: "ready", url: "http://localhost:3001" },
      send,
      subscribe: (listener: PreviewListener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    }) as unknown as PreviewControl;
  const hook = renderHook(
    ({ composition }: { composition: string }) =>
      usePreviewTransport(preview(composition), true),
    { initialProps: { composition: "intro" } }
  );
  const emit = (message: PreviewMessage) =>
    act(() => {
      for (const listener of listeners) {
        listener(message);
      }
    });
  const rates = () =>
    send.mock.calls
      .map(([command]) => command)
      .filter((command) => command.type === "transport.rate")
      .map((command) => command.rate);
  return { ...hook, emit, rates, send };
}

describe("usePreviewTransport scenes", () => {
  it("has no scenes until the runtime reports them", () => {
    const { result } = setup();

    expect(result.current.scenes).toEqual([]);
  });

  it("takes the scenes reported for the video on screen", () => {
    const { emit, result } = setup();
    emit({
      compositionId: "intro",
      scenes: SCENES,
      source: "remocn-preview",
      type: "scenes",
    });

    expect(result.current.scenes.map((scene) => scene.name)).toEqual([
      "Intro",
      "Features",
    ]);
  });

  it("ignores scenes reported for another video", () => {
    const { emit, rerender, result } = setup();
    emit({
      compositionId: "intro",
      scenes: SCENES,
      source: "remocn-preview",
      type: "scenes",
    });
    rerender({ composition: "outro" });

    expect(result.current.scenes).toEqual([]);
  });
});

describe("usePreviewTransport scenes arriving early", () => {
  it("keeps scenes that arrive before the pane knows the video is open", () => {
    const { emit, rerender, result } = setup();
    rerender({ composition: "previous" });
    emit({
      compositionId: "intro",
      scenes: SCENES,
      source: "remocn-preview",
      type: "scenes",
    });

    expect(result.current.scenes).toEqual([]);

    rerender({ composition: "intro" });

    expect(result.current.scenes.map((scene) => scene.name)).toEqual([
      "Intro",
      "Features",
    ]);
  });
});

describe("usePreviewTransport speed", () => {
  it("starts at 1x and sends a chosen speed to the runtime", () => {
    const { rates, result } = setup();

    expect(result.current.rate).toBe(1);

    act(() => result.current.setRate(0.25));

    expect(result.current.rate).toBe(0.25);
    expect(rates().at(-1)).toBe(0.25);
  });

  it("moves between the speeds by step, as the slider does", () => {
    const { result } = setup();

    expect(result.current.rateStep).toBe(2);
    expect(result.current.rateMarks).toEqual([0, 1 / 3, 2 / 3, 1]);

    act(() => result.current.setRateStep(0));

    expect(result.current.rate).toBe(0.25);

    act(() => result.current.setRateStep(9));

    expect(result.current.rate).toBe(0.25);
  });

  it("cycles through the speeds from the compact button, wrapping at the end", () => {
    const { result } = setup();

    act(() => result.current.cycleRate());
    expect(result.current.rate).toBe(2);

    act(() => result.current.cycleRate());
    expect(result.current.rate).toBe(0.25);

    act(() => result.current.cycleRate());
    expect(result.current.rate).toBe(0.5);
  });

  it("sends the speed again to a rebuilt runtime", () => {
    const { emit, rates, result } = setup();
    act(() => result.current.setRate(0.5));
    const before = rates().length;
    emit({ source: "remocn-preview", type: "rebuilt" });

    expect(rates().length).toBe(before + 1);
    expect(rates().at(-1)).toBe(0.5);
  });

  it("plays another video at 1x", () => {
    const { rates, rerender, result } = setup();
    act(() => result.current.setRate(2));
    rerender({ composition: "outro" });

    expect(result.current.rate).toBe(1);
    expect(rates().at(-1)).toBe(1);
  });
});

describe("usePreviewTransport playhead", () => {
  it("keeps the transport still while frames play, and the seek bar follows them", () => {
    const clock = { frame: 0 };
    const watchers = new Set<() => void>();
    const preview = {
      composition: "intro",
      frameOf: () => clock.frame,
      isServing: true,
      onFrame: (listen: () => void) => {
        watchers.add(listen);
        return () => {
          watchers.delete(listen);
        };
      },
      pick: { metadata: { durationInFrames: 300, fps: 30 } },
      playing: true,
      preview: { phase: "ready", url: "http://localhost:3001" },
      send: mock(),
      subscribe: () => () => undefined,
    } as unknown as PreviewControl;
    let renders = 0;
    const transport = renderHook(() => {
      renders += 1;
      return usePreviewTransport(preview, true);
    });
    const seekBar = renderHook(() => ({
      edge: useTransportEdge(transport.result.current),
      shown: useTransportFrame(transport.result.current),
    }));
    const before = { renders, seekTo: transport.result.current.seekTo };

    for (const frame of [30, 60, 299]) {
      act(() => {
        clock.frame = frame;
        for (const listen of watchers) {
          listen();
        }
      });
    }

    expect(renders).toBe(before.renders);
    expect(transport.result.current.seekTo).toBe(before.seekTo);
    expect(seekBar.result.current.shown).toEqual({
      frame: 299,
      position: "00:09",
    });
    expect(seekBar.result.current.edge).toBe("end");
  });
});
