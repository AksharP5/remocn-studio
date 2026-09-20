import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useOnboardingVideo } from "./use-onboarding-video";

afterEach(() => mock.restore());

describe("onboarding video lifecycle", () => {
  it("does not autoplay when retrying with reduced motion", () => {
    spyOn(window, "matchMedia").mockReturnValue({
      addEventListener: mock(),
      matches: true,
      removeEventListener: mock(),
    } as unknown as MediaQueryList);
    const view = renderHook(useOnboardingVideo);
    const video = document.createElement("video");
    const play = spyOn(video, "play").mockResolvedValue();
    view.result.current.videoRef.current = video;
    expect(play).not.toHaveBeenCalled();
    act(() => view.result.current.retry());
    expect(play).not.toHaveBeenCalled();
  });
  it("keeps manual controls usable after refused autoplay", async () => {
    const view = renderHook(useOnboardingVideo);
    const video = document.createElement("video");
    const play = spyOn(video, "play").mockRejectedValue(
      new Error("autoplay denied")
    );
    view.result.current.videoRef.current = video;
    act(() => view.result.current.retry());
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(view.result.current.failed).toBe(false);
  });
  it("retries load errors without advancing chapters", () => {
    const view = renderHook(useOnboardingVideo);
    const video = document.createElement("video");
    const play = spyOn(video, "play").mockResolvedValue();
    const load = spyOn(video, "load").mockImplementation(() => undefined);
    view.result.current.videoRef.current = video;
    act(() => view.result.current.onError());
    expect(view.result.current.failed).toBe(true);
    act(() => view.result.current.retry());
    expect(load).toHaveBeenCalled();
    expect(view.result.current.failed).toBe(false);
    expect(play).toHaveBeenCalled();
  });
});
