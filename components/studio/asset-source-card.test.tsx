import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssetSourceCard } from "./asset-source-card";

const dialog = { open: mock() };
mock.module("@tauri-apps/plugin-dialog", () => ({ open: dialog.open }));

const UPLOAD = /Upload original/;
const SCREENSHOT = /Use site screenshot/;

const source = {
  askedAt: 0,
  attempt: "No downloadable image or linked SVG was exposed.",
  id: "source-1",
  name: "Acme Logo",
  source: "https://example.com/brand",
};

describe("AssetSourceCard", () => {
  beforeEach(() => dialog.open.mockReset());

  it("shows the source and both provenance-preserving choices", () => {
    render(<AssetSourceCard onAnswer={mock()} source={source} />);

    expect(screen.getByText("Acme Logo")).toBeVisible();
    expect(screen.getByText(source.source)).toBeVisible();
    expect(screen.getByRole("button", { name: UPLOAD })).toHaveFocus();
    expect(screen.getByRole("button", { name: SCREENSHOT })).toBeVisible();
  });

  it("cancels only the source request on Escape", async () => {
    const onAnswer = mock().mockResolvedValue(true);
    render(<AssetSourceCard onAnswer={onAnswer} source={source} />);

    fireEvent.keyDown(
      screen.getByLabelText("Choose the source for this brand asset"),
      { key: "Escape" }
    );

    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith("source-1", "cancel", null)
    );
  });

  it("returns the picked original path", async () => {
    dialog.open.mockResolvedValue("/Users/me/logo.svg");
    const onAnswer = mock().mockResolvedValue(true);
    render(<AssetSourceCard onAnswer={onAnswer} source={source} />);

    fireEvent.click(screen.getByRole("button", { name: UPLOAD }));

    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith(
        "source-1",
        "uploaded",
        "/Users/me/logo.svg"
      )
    );
  });

  it("authorises an app-owned screenshot without a file", async () => {
    const onAnswer = mock().mockResolvedValue(true);
    render(<AssetSourceCard onAnswer={onAnswer} source={source} />);

    fireEvent.click(screen.getByRole("button", { name: SCREENSHOT }));

    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith("source-1", "screenshot", null)
    );
  });
});
