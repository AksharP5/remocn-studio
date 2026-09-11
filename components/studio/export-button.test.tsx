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
    choose: () => undefined,
    chooseFolder: () => undefined,
    chooseFormat: () => undefined,
    choosePreset: () => undefined,
    chooseQuality: () => undefined,
    chooseResolution: () => undefined,
    close: () => undefined,
    duration: "00:10",
    fileName: "Main.mp4",
    folder: "out",
    isOpen: false,
    isRunning: false,
    notices: [],
    open: () => undefined,
    pending: 0,
    percent: null,
    rename: () => undefined,
    render: () => undefined,
    result: null,
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

  it("names a stage that has no percentage, and clicking cancels", () => {
    const cancel = mock();
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Measuring…", percent: null },
          cancel,
          isRunning: true,
          status: "Measuring the composition…",
        })}
      />
    );

    const button = screen.getByRole("button", { name: "Cancel the export" });
    expect(button).toHaveTextContent("Measuring…");
    expect(button).toHaveAttribute("title", "Measuring the composition…");
    fireEvent.click(button);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("wears the stage and its percentage while it renders", () => {
    const cancel = mock();
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Rendering · 21%", percent: 21 },
          cancel,
          isRunning: true,
          percent: 21,
          status: "Rendering — 64/300 frames · 21%",
        })}
      />
    );

    const button = screen.getByRole("button", { name: "Cancel the export" });
    expect(button).toHaveTextContent("Rendering · 21%");
    expect(button).toHaveAttribute("title", "Rendering — 64/300 frames · 21%");
    fireEvent.click(button);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
