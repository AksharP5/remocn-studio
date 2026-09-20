import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { hydrateSettings } from "@/lib/studio/settings";
import { type OnboardingInputs, useOnboarding } from "./use-onboarding";

const written = new Map<string, string>();
let failWrite = false;
beforeEach(() => {
  written.clear();
  failWrite = false;
  mockIPC((cmd, payload) => {
    if (cmd === "plugin:store|load") {
      return 1;
    }
    if (cmd === "plugin:store|entries") {
      return [...written];
    }
    if (cmd === "plugin:store|set") {
      if (failWrite) {
        throw new Error("disk unavailable");
      }
      const { key, value } = payload as { key: string; value: string };
      written.set(key, value);
      return null;
    }
    if (cmd === "plugin:store|save") {
      return null;
    }
    throw new Error(cmd);
  });
});
const ready: OnboardingInputs = {
  blocked: false,
  hasProject: true,
  isRunning: false,
  isSettingsOpen: false,
  settings: { onboarding: { chapter: "inspect", dismissed: false } },
};

describe("useOnboarding", () => {
  it("waits for hydrated settings, a project, idle work and no blocking surface", () => {
    for (const patch of [
      { settings: null },
      { hasProject: false },
      { isRunning: true },
      { blocked: true },
      { isSettingsOpen: true },
    ]) {
      const view = renderHook(useOnboarding, {
        initialProps: { ...ready, ...patch },
      });
      expect(view.result.current.isOpen).toBe(false);
      view.rerender(ready);
      expect(view.result.current.isOpen).toBe(true);
      view.unmount();
    }
  });
  it("persists the last chapter and dismissal across remounts", async () => {
    const view = renderHook(useOnboarding, { initialProps: ready });
    act(() => view.result.current.next());
    expect(view.result.current.chapter.id).toBe("snapshot");
    act(() => view.result.current.close());
    await waitFor(() =>
      expect(JSON.parse(written.get("onboarding") ?? "{}")).toEqual({
        chapter: "snapshot",
        dismissed: true,
      })
    );
    view.unmount();
    const settings = await Effect.runPromise(hydrateSettings);
    const restored = renderHook(useOnboarding, {
      initialProps: { ...ready, settings },
    });
    expect(restored.result.current.isOpen).toBe(false);
    act(() => restored.result.current.open());
    expect(restored.result.current.isOpen).toBe(true);
    expect(restored.result.current.chapter.id).toBe("snapshot");
  });
  it("opens manually above Settings without a project, even after dismissal", () => {
    const view = renderHook(useOnboarding, {
      initialProps: {
        ...ready,
        blocked: true,
        hasProject: false,
        isSettingsOpen: true,
        settings: {
          onboarding: { chapter: "brand" as const, dismissed: true },
        },
      },
    });
    act(() => view.result.current.open());
    expect(view.result.current.isOpen).toBe(true);
    expect(view.result.current.chapter.id).toBe("brand");
  });
  it("does not treat old tips as having dismissed the overview", async () => {
    written.set("toursSeen", '["composer","snapshot"]');
    const settings = await Effect.runPromise(hydrateSettings);
    const view = renderHook(useOnboarding, {
      initialProps: { ...ready, settings },
    });
    expect(view.result.current.isOpen).toBe(true);
  });
  it("reports a failed save and retries the latest choice", async () => {
    failWrite = true;
    const view = renderHook(useOnboarding, { initialProps: ready });
    act(() => view.result.current.close());
    await waitFor(() => expect(view.result.current.saveError).toBe(true));
    expect(view.result.current.isOpen).toBe(false);
    failWrite = false;
    act(() => view.result.current.retrySave());
    await waitFor(() => expect(view.result.current.saveError).toBe(false));
    expect(JSON.parse(written.get("onboarding") ?? "{}").dismissed).toBe(true);
  });
  it("temporarily hides for a blocking question without recording dismissal", () => {
    const view = renderHook(useOnboarding, { initialProps: ready });
    view.rerender({ ...ready, blocked: true });
    expect(view.result.current.isOpen).toBe(false);
    expect(written.size).toBe(0);
    view.rerender(ready);
    expect(view.result.current.isOpen).toBe(true);
  });
  it("Done dismisses the final chapter", async () => {
    const view = renderHook(useOnboarding, {
      initialProps: {
        ...ready,
        settings: {
          onboarding: { chapter: "export" as const, dismissed: false },
        },
      },
    });
    act(() => view.result.current.next());
    expect(view.result.current.isOpen).toBe(false);
    await waitFor(() => expect(written.has("onboarding")).toBe(true));
  });
});
