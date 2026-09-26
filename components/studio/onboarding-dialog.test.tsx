import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingOverview } from "./onboarding-dialog";

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
  mockIPC((cmd) => (cmd === "plugin:store|load" ? 1 : null));
});

function still() {
  return document.querySelector<HTMLImageElement>('img[alt$="in Studio"]');
}

describe("feature overview", () => {
  it("opens on the cover the first time and starts the tour from it", () => {
    render(<Harness />);
    expect(
      screen.getByRole("heading", { name: "Welcome to Remocn Studio" })
    ).toBeInTheDocument();
    expect(still()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(
      screen.getByRole("heading", { name: "Point at anything in the frame" })
    ).toBeInTheDocument();
    expect(still()?.src).toContain("/onboarding/inspect.webp");
    fireEvent.click(screen.getByRole("button", { name: "Previous chapter" }));
    expect(
      screen.getByRole("heading", { name: "Welcome to Remocn Studio" })
    ).toBeInTheDocument();
  });
  it("skips the cover when opened from Settings", async () => {
    render(<Harness manual />);
    fireEvent.click(screen.getByRole("button", { name: "Explore Studio" }));
    await screen.findByRole("dialog");
    expect(still()?.src).toContain("/onboarding/inspect.webp");
  });
  it("renders one picture per chapter and navigates freely", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(document.querySelectorAll('img[alt$="in Studio"]')).toHaveLength(1);
    expect(document.querySelector("video")).toBeNull();
    expect(still()?.src).toContain("/onboarding/inspect.webp");
    fireEvent.click(screen.getByRole("button", { name: "06 Export" }));
    expect(screen.getByAltText("Export in Studio")).toBeInTheDocument();
    expect(document.querySelectorAll('img[alt$="in Studio"]')).toHaveLength(1);
    expect(still()?.src).toContain("/onboarding/export.webp");
    expect(
      screen.getByRole("heading", { name: "Ship it anywhere" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(still()).toBeNull();
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
    expect(still()?.src).toContain("/onboarding/snapshot.webp");
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.getAttribute("data-motion")).toBe("instant");
    fireEvent.click(screen.getByRole("button", { name: "Next" }), {
      detail: 0,
    });
    expect(dialog.getAttribute("data-motion")).toBe("instant");
    expect(still()?.src).toContain("/onboarding/assets.webp");
  });
  it("leaves retry and chapter navigation usable when the picture fails", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    const image = still();
    if (!image) {
      throw new Error("picture missing");
    }
    fireEvent.error(image);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(still()).not.toBe(image);
    expect(still()?.src).toContain("/onboarding/inspect.webp");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByAltText("Snapshot in Studio")).toBeInTheDocument();
  });
  it("closes with Escape and restores focus to the manual entry", async () => {
    render(<Harness manual />);
    const trigger = screen.getByRole("button", { name: "Explore Studio" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { code: "Escape", key: "Escape" });
    await waitFor(() => expect(still()).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("does not dismiss on an outside press", async () => {
    render(<Harness />);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });
});
