import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExportButton } from "@/components/studio/export-button";
import type { Exporting } from "@/hooks/use-export";
import { DEFAULT_EXPORT_SETTINGS, reviewExport } from "@/shared/export";

function exporting(overrides: Partial<Exporting> = {}): Exporting {
  return {
    brief: null,
    cancel: () => undefined,
    canExport: true,
    canRetry: false,
    choose: () => undefined,
    chooseFolder: () => undefined,
    chooseFormat: () => undefined,
    choosePreset: () => undefined,
    chooseQuality: () => undefined,
    chooseResolution: () => undefined,
    close: () => undefined,
    confirmCancel: () => undefined,
    dismiss: () => undefined,
    duration: "00:10",
    fileName: "Main.mp4",
    folder: "out",
    isConfirmingCancel: false,
    isOpen: false,
    isRunning: false,
    keepExporting: () => undefined,
    notices: [],
    onConfirmChange: () => undefined,
    open: () => undefined,
    pending: 0,
    percent: null,
    rename: () => undefined,
    render: () => undefined,
    requestCancel: () => undefined,
    result: null,
    retry: () => undefined,
    reveal: () => Promise.resolve(),
    review: reviewExport(DEFAULT_EXPORT_SETTINGS, {
      height: 1080,
      width: 1920,
    }),
    settings: DEFAULT_EXPORT_SETTINGS,
    size: { height: 1080, width: 1920 },
    start: () => undefined,
    state: { phase: "idle" },
    status: null,
    target: "/Users/me/scenes/out/Main.mp4",
    trouble: null,
    unavailable: null,
    willReplace: false,
    ...overrides,
  };
}

describe("ExportButton", () => {
  it("opens the dialog rather than rendering on the spot", () => {
    const open = mock();
    const render_ = mock();
    render(<ExportButton exporting={exporting({ open, render: render_ })} />);

    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toHaveAttribute(
      "title",
      "Pick a format and a place to save, then render"
    );
    fireEvent.click(button);
    expect(open).toHaveBeenCalledTimes(1);
    expect(render_).toHaveBeenCalledTimes(0);
  });

  it("says why it is unavailable rather than disappearing", () => {
    render(
      <ExportButton
        exporting={exporting({
          canExport: false,
          unavailable: "Open a project to export it.",
        })}
      />
    );

    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Open a project to export it.");
  });

  it("names a stage that has no percentage, and the cross asks to cancel", () => {
    const onConfirmChange = mock();
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Measuring…", percent: null },
          isRunning: true,
          onConfirmChange,
          status: "Measuring the video…",
        })}
      />
    );

    const stage = screen.getByRole("status");
    expect(stage).toHaveTextContent("Measuring…");
    expect(stage).toHaveAttribute("title", "Measuring the video…");
    fireEvent.click(screen.getByRole("button", { name: "Cancel the export" }));
    expect(onConfirmChange).toHaveBeenCalledTimes(1);
    expect(onConfirmChange.mock.calls[0]?.[0]).toBe(true);
  });

  it("wears the stage and its percentage while it renders", () => {
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Rendering · 21%", percent: 21 },
          isRunning: true,
          percent: 21,
          status: "Rendering — 64/300 frames · 21%",
        })}
      />
    );

    const stage = screen.getByRole("status");
    expect(stage).toHaveTextContent("Rendering · 21%");
    expect(stage).toHaveAttribute("title", "Rendering — 64/300 frames · 21%");
  });

  it("asks before stopping a render that has run a while", () => {
    const confirmCancel = mock();
    const keepExporting = mock();
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Rendering · 60%", percent: 60 },
          confirmCancel,
          isConfirmingCancel: true,
          isRunning: true,
          keepExporting,
        })}
      />
    );

    expect(screen.getByText("Stop the export?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep exporting" }));
    expect(keepExporting).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(confirmCancel).toHaveBeenCalledTimes(1);
  });
});
