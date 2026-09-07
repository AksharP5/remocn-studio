import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePropGroups } from "@/hooks/use-prop-groups";
import type { StudioSettings } from "@/lib/studio/settings";

const SETTINGS = {
  assetOffers: null,
  claudeEffort: null,
  collapsedPropGroups: ["Timing"],
} as unknown as StudioSettings;

describe("usePropGroups", () => {
  // Collapsed names, not open ones: a section the pane gains later opens with
  // everything else rather than arriving shut.
  it("starts from what was remembered", () => {
    const { result } = renderHook(() => usePropGroups(SETTINGS));

    expect(result.current.collapsed).toEqual(["Timing"]);
  });

  it("is open by default, and before the settings have hydrated", () => {
    const { result } = renderHook(() => usePropGroups(null));

    expect(result.current.collapsed).toEqual([]);
  });

  it("folds and unfolds by name, leaving the others alone", () => {
    const { result } = renderHook(() => usePropGroups(SETTINGS));

    act(() => {
      result.current.toggle("Transform");
    });
    expect(result.current.collapsed).toEqual(["Timing", "Transform"]);

    act(() => {
      result.current.toggle("Timing");
    });
    expect(result.current.collapsed).toEqual(["Transform"]);
  });
});
