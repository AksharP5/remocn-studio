import { afterEach, expect, it, mock } from "bun:test";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { DesignDropZone } from "./design-drop-zone";

afterEach(() => {
  cleanup();
  clearMocks();
});
it("routes only a single Markdown file dropped inside the zone and ignores disabled zones", async () => {
  const listeners = new Map<string, number>();
  mockIPC((command, args) => {
    if (command === "plugin:event|listen") {
      const entry = args as { event: string; handler: number };
      listeners.set(entry.event, entry.handler);
      return entry.handler;
    }
    return null;
  });
  mockWindows("main");
  const onDrop = mock();
  const onError = mock();
  const props = { onChoose: mock(), onDrop, onError };
  const { rerender } = render(<DesignDropZone {...props} loading={false} />);
  const zone = screen.getByRole("button", { name: "Import DESIGN.md" });
  zone.getBoundingClientRect = () => ({
    bottom: 150,
    height: 140,
    left: 10,
    right: 210,
    toJSON: () => ({}),
    top: 10,
    width: 200,
    x: 10,
    y: 10,
  });
  await waitFor(() => expect(listeners.has("tauri://drag-drop")).toBe(true));
  const emit = (paths: string[], x = 50) =>
    act(() => {
      const internals = (
        window as unknown as {
          __TAURI_INTERNALS__: {
            runCallback: (id: number, payload: unknown) => void;
          };
        }
      ).__TAURI_INTERNALS__;
      internals.runCallback(listeners.get("tauri://drag-drop") as number, {
        event: "tauri://drag-drop",
        id: 1,
        payload: { paths, position: { x, y: 50 } },
      });
    });
  emit(["/tmp/DESIGN.md"], 300);
  expect(onDrop).not.toHaveBeenCalled();
  emit(["/tmp/logo.png"]);
  expect(onError).toHaveBeenCalledWith("Drop one Markdown (.md) file.");
  emit(["/tmp/DESIGN.md", "/tmp/other.md"]);
  expect(onDrop).not.toHaveBeenCalled();
  emit(["/tmp/DESIGN.md"]);
  expect(onDrop).toHaveBeenCalledWith("/tmp/DESIGN.md");
  rerender(<DesignDropZone {...props} loading />);
  emit(["/tmp/other.md"]);
  expect(onDrop).toHaveBeenCalledTimes(1);
});
