import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExportDialog } from "@/components/studio/export-dialog";
import type { Exporting } from "@/hooks/use-export";
import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  presetSettings,
  reviewExport,
} from "@/shared/export";

const PORTRAIT = { height: 1920, width: 1080 };

const SIXTEEN_NINE = /16:9/;

const OUT_FOLDER = /out/;

function exporting(
  overrides: Partial<Exporting> = {},
  settings: ExportSettings = DEFAULT_EXPORT_SETTINGS,
  size = { height: 1080, width: 1920 }
): Exporting {
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
    isOpen: true,
    isRunning: false,
    notices: [],
    open: () => undefined,
    pending: 0,
    percent: null,
    rename: () => undefined,
    render: () => undefined,
    result: null,
    reveal: () => Promise.resolve(),
    review: reviewExport(settings, size),
    settings,
    size,
    start: () => undefined,
    status: null,
    target: "/Users/me/scenes/out/Main.mp4",
    trouble: null,
    unavailable: null,
    ...overrides,
  };
}

describe("ExportDialog", () => {
  it("shows every format, and the resolution the render will produce", () => {
    render(<ExportDialog composition="Main" exporting={exporting()} />);

    for (const label of ["MP4 · H.264", "WebM · VP9", "GIF", "MOV · ProRes"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }

    expect(screen.getByText("1920×1080")).toBeInTheDocument();
    expect(screen.getByText("MP4")).toBeInTheDocument();
    expect(screen.getByText("00:10")).toBeInTheDocument();
  });

  it("hides quality for a GIF and says it carries no audio", () => {
    const settings: ExportSettings = {
      ...DEFAULT_EXPORT_SETTINGS,
      format: "gif",
    };

    render(
      <ExportDialog composition="Main" exporting={exporting({}, settings)} />
    );

    expect(screen.queryByRole("radio", { name: "Draft" })).toBeNull();
    expect(screen.getByText("A GIF carries no audio.")).toBeInTheDocument();
  });

  it("warns about a preset that does not match the shape, and still renders", () => {
    render(
      <ExportDialog
        composition="Intro"
        exporting={exporting({}, presetSettings("youtube"), PORTRAIT)}
      />
    );

    expect(screen.getByText(SIXTEEN_NINE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("exports a 9:16 video at 1080 as 1080×1920", () => {
    render(
      <ExportDialog
        composition="Intro"
        exporting={exporting(
          { fileName: "Intro-shorts.mp4" },
          presetSettings("shorts"),
          PORTRAIT
        )}
      />
    );

    expect(screen.getByText("1080×1920")).toBeInTheDocument();
  });

  it("shows where the file goes without a step of its own", () => {
    render(
      <ExportDialog
        composition="Intro"
        exporting={exporting({
          fileName: "Intro-shorts.mp4",
          folder: "out",
        })}
      />
    );

    expect(screen.getByRole("textbox", { name: "File name" })).toHaveValue(
      "Intro-shorts.mp4"
    );
    expect(
      screen.getByRole("button", { name: OUT_FOLDER })
    ).toBeInTheDocument();
  });

  it("renames the file from the field", () => {
    const rename = mock();

    render(
      <ExportDialog composition="Intro" exporting={exporting({ rename })} />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "File name" }), {
      target: { value: "opening.mp4" },
    });

    expect(rename).toHaveBeenCalled();
  });

  it("opens a folder picker rather than a save panel", () => {
    const chooseFolder = mock();

    render(
      <ExportDialog
        composition="Intro"
        exporting={exporting({ chooseFolder, folder: "out" })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: OUT_FOLDER }));

    expect(chooseFolder).toHaveBeenCalledTimes(1);
  });

  it("refuses to render a size the encoder would not take", () => {
    const settings: ExportSettings = {
      ...DEFAULT_EXPORT_SETTINGS,
      resolution: "2160",
    };

    render(
      <ExportDialog
        composition="Main"
        exporting={exporting({}, settings, { height: 100, width: 100 })}
      />
    );

    expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("renders from the dialog itself", () => {
    const chosen = mock();

    render(
      <ExportDialog
        composition="Main"
        exporting={exporting({ render: chosen })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(chosen).toHaveBeenCalledTimes(1);
  });

  it("picks a preset by name", () => {
    const choosePreset = mock();

    render(
      <ExportDialog
        composition="Main"
        exporting={exporting({ choosePreset })}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "YouTube" }));

    expect(choosePreset).toHaveBeenCalled();
  });
});
