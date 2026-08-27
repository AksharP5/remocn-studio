import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTours } from "@/hooks/use-tours";
import type { StudioSettings } from "@/lib/studio/settings";
import type { TourStage } from "@/lib/studio/tours";

const DWELL = "20 millis";
const PAST_DWELL = 60;

const written: string[][] = [];

// The settings store is Tauri's, and there is none under jsdom. The fake is
// also the assertion: what a "Got it" wrote down is what comes back next
// launch.
vi.mock("@tauri-apps/plugin-store", () => ({
  load: () =>
    Promise.resolve({
      delete: () => Promise.resolve(),
      entries: () => Promise.resolve([]),
      set: (_key: string, value: string) => {
        written.push(JSON.parse(value) as string[]);
        return Promise.resolve();
      },
    }),
}));

const SETTINGS: StudioSettings = {
  assetOffers: null,
  claudeEffort: null,
  claudeModel: null,
  codexModel: null,
  copilotModel: null,
  expandedVideos: [],
  grokModel: null,
  legacyProjectFolder: null,
  paneView: null,
  previewPane: null,
  projectsPane: null,
  taskDock: null,
  toursSeen: [],
};

const OPEN: TourStage = {
  hasMedia: false,
  hasPlan: false,
  hasPreviewTools: false,
  hasProject: true,
  isBlocked: false,
  isPaneShown: false,
  isRunning: false,
};

function pause(ms: number) {
  return act(
    () =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      })
  );
}

function mount(stage: TourStage, settings: StudioSettings | null = SETTINGS) {
  const onReveal = vi.fn();
  const view = renderHook(
    (props: { settings: StudioSettings | null; stage: TourStage }) =>
      useTours({ dwell: DWELL, onReveal, ...props }),
    { initialProps: { settings, stage } }
  );
  return { onReveal, view };
}

beforeEach(() => {
  written.length = 0;
});

describe("useTours", () => {
  it("holds a tip back until the feature has been there a moment", async () => {
    const { view } = mount(OPEN);

    expect(view.result.current.tip).toBeNull();

    await pause(PAST_DWELL);

    expect(view.result.current.tip?.id).toBe("composer");
  });

  it("says nothing at all until the settings have been read", async () => {
    const { view } = mount(OPEN, null);

    await pause(PAST_DWELL);

    expect(view.result.current.tip).toBeNull();
  });

  it("says nothing about a feature that is not available yet", async () => {
    const { view } = mount({ ...OPEN, hasProject: false });

    await pause(PAST_DWELL);

    expect(view.result.current.tip).toBeNull();
  });

  it("shows one tip at a time, and the next one only after the first is answered", async () => {
    const busy: TourStage = {
      ...OPEN,
      hasMedia: true,
      hasPreviewTools: true,
      isPaneShown: true,
    };
    const { view } = mount(busy);

    await pause(PAST_DWELL);
    expect(view.result.current.tip?.id).toBe("composer");

    act(() => {
      view.result.current.dismiss();
    });
    expect(view.result.current.tip).toBeNull();

    await pause(PAST_DWELL);
    expect(view.result.current.tip?.id).toBe("preview-tools");
  });

  it("remembers a tip that was answered", async () => {
    const { view } = mount(OPEN);

    await pause(PAST_DWELL);
    act(() => {
      view.result.current.dismiss();
    });
    await pause(PAST_DWELL);

    expect(written.at(-1)).toEqual(["composer"]);
    expect(view.result.current.hasSeenAny).toBe(true);
  });

  it("never offers a tip the last launch answered", async () => {
    const { view } = mount(OPEN, { ...SETTINGS, toursSeen: ["composer"] });

    await pause(PAST_DWELL);

    expect(view.result.current.tip).toBeNull();
  });

  // Clicking outside is "not now", not "never": nothing is written down, and
  // the tip comes back next launch.
  it("forgets a tip for this launch only when it is closed", async () => {
    const { view } = mount(OPEN);

    await pause(PAST_DWELL);
    act(() => {
      view.result.current.close();
    });
    await pause(PAST_DWELL);

    expect(view.result.current.tip).toBeNull();
    expect(written).toEqual([]);
    expect(view.result.current.hasSeenAny).toBe(false);
  });

  it("takes a tip away when its feature goes while the wait runs", async () => {
    const { view } = mount({ ...OPEN, hasPlan: true });

    act(() => {
      view.rerender({
        settings: { ...SETTINGS, toursSeen: ["composer"] },
        stage: { ...OPEN, hasPlan: false },
      });
    });
    await pause(PAST_DWELL);

    expect(view.result.current.tip).toBeNull();
  });

  it("offers everything again after a replay", async () => {
    const { view } = mount(OPEN, { ...SETTINGS, toursSeen: ["composer"] });

    act(() => {
      view.result.current.replay();
    });
    await pause(PAST_DWELL);

    expect(written.at(-1)).toEqual([]);
    expect(view.result.current.tip?.id).toBe("composer");
  });

  it("shows what a tip's action reveals, and counts that as an answer", async () => {
    const { onReveal, view } = mount({
      ...OPEN,
      hasMedia: true,
      isPaneShown: true,
    });

    act(() => {
      view.rerender({
        settings: { ...SETTINGS, toursSeen: ["composer"] },
        stage: { ...OPEN, hasMedia: true, isPaneShown: true },
      });
    });
    await pause(PAST_DWELL);
    expect(view.result.current.tip?.id).toBe("library");

    act(() => {
      view.result.current.reveal?.();
    });

    expect(onReveal).toHaveBeenCalledWith("assets");
    expect(written.at(-1)).toEqual(["composer", "library"]);
  });
});
