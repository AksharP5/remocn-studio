import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingOverview } from "./onboarding-dialog";

const play = mock(() => Promise.resolve());
const pause = mock(() => undefined);
function Harness({ manual = false }: { manual?: boolean }) {
  const onboarding = useOnboarding({
    blocked: false,
    hasProject: !manual,
    isRunning: false,
    isSettingsOpen: manual,
    settings: { onboarding: { chapter: "inspect", dismissed: manual } },
  });
  return (
    <>
      <button onClick={onboarding.open} type="button">
        Explore Studio
      </button>
      <OnboardingOverview onboarding={onboarding} />
    </>
  );
}
beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  mockIPC((cmd) => (cmd === "plugin:store|load" ? 1 : null));
});
afterEach(() => mock.restore());

describe("feature overview", () => {
  it("renders one video, navigates freely, and stops the previous recording", async () => {
    render(<Harness />);
    expect(document.querySelectorAll("video")).toHaveLength(1);
    await waitFor(() => expect(play).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "06 Export" }));
    expect(screen.getByLabelText("Export demonstration")).toBeInTheDocument();
    expect(document.querySelectorAll("video")).toHaveLength(1);
    expect(document.querySelector("video")?.src).toContain(
      "/onboarding/export.mp4"
    );
    expect(pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.querySelector("video")).toBeNull();
  });
  it("follows pointer navigation direction and skips motion for keyboard navigation", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "06 Export" }), {
      detail: 1,
    });
    expect(dialog.getAttribute("data-motion")).toBe("forward");
    fireEvent.click(screen.getByRole("button", { name: "02 Snapshot" }), {
      detail: 1,
    });
    expect(dialog.getAttribute("data-motion")).toBe("backward");
    expect(document.querySelectorAll("video")).toHaveLength(1);
    expect(document.querySelector("video")?.src).toContain(
      "/onboarding/snapshot.mp4"
    );
    expect(pause).toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.getAttribute("data-motion")).toBe("instant");
    fireEvent.click(screen.getByRole("button", { name: "Next" }), {
      detail: 0,
    });
    expect(dialog.getAttribute("data-motion")).toBe("instant");
    expect(document.querySelector("video")?.src).toContain(
      "/onboarding/assets.mp4"
    );
  });
  it("leaves retry and chapter navigation usable when video fails", () => {
    render(<Harness />);
    const video = document.querySelector("video");
    if (!video) {
      throw new Error("video missing");
    }
    fireEvent.error(video);
    expect(
      screen.getByRole("button", { name: "Retry video" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Snapshot demonstration")).toBeInTheDocument();
  });
  it("uses a poster and manual play with reduced motion", () => {
    spyOn(window, "matchMedia").mockReturnValue({
      addEventListener: mock(),
      matches: true,
      removeEventListener: mock(),
    } as unknown as MediaQueryList);
    render(<Harness />);
    expect(play).not.toHaveBeenCalled();
    expect(document.querySelector("video")?.getAttribute("poster")).toContain(
      "/onboarding/inspect.jpg"
    );
    expect(document.querySelector("video")?.controls).toBe(true);
  });
  it("closes with Escape and restores focus to the manual entry", async () => {
    render(<Harness manual />);
    const trigger = screen.getByRole("button", { name: "Explore Studio" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { code: "Escape", key: "Escape" });
    await waitFor(() => expect(document.querySelector("video")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("does not dismiss on an outside press", async () => {
    render(<Harness />);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });
});
