import { describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect } from "effect";
import { ExportDialog } from "@/components/studio/export-dialog";
import {
  CONFIRM_CANCEL_AFTER_MS,
  type ExportOptions,
  useExport,
} from "@/hooks/use-export";
import type { ExportEvent, Exported } from "@/shared/ipc";

const PROJECT = "project-1";
const OTHER = "project-2";
const OUTPUT = "/Users/me/scenes/out/Main.mp4";

const SERVING: ExportOptions = {
  composition: "Main",
  isServing: true,
  metadata: { durationInFrames: 300, fps: 30, height: 1080, width: 1920 },
  openedProjectId: PROJECT,
  pick: () => Effect.succeed("/Users/me/scenes/out"),
  projectId: PROJECT,
};

const EXPORTED: Exported = {
  bytes: 4_404_019,
  height: 1080,
  path: OUTPUT,
  width: 1920,
};

function EditableExport() {
  const exporting = useExport({ ...SERVING, projectPath: "/Users/me/scenes" });

  return (
    <>
      <button onClick={exporting.open} type="button">
        Open export
      </button>
      <ExportDialog composition="Main" exporting={exporting} />
      <output data-testid="export-target">{exporting.target}</output>
    </>
  );
}

describe("editing the export file name", () => {
  it("allows clearing and typing a name without reinserting the extension", async () => {
    mockExport();
    const user = userEvent.setup();
    render(<EditableExport />);
    await user.click(screen.getByRole("button", { name: "Open export" }));
    const input = screen.getByRole("textbox", { name: "File name" });

    await user.clear(input);
    expect(input).toHaveValue("");
    await user.type(input, "Opening title");
    expect(input).toHaveValue("Opening title");
    await user.tab();
    expect(input).toHaveValue("Opening title.mp4");
    expect(screen.getByTestId("export-target").textContent).toBe(
      "/Users/me/scenes/out/Opening title.mp4"
    );
  });

  it("edits an existing name and pastes a full filename without duplicate extensions", async () => {
    mockExport();
    const user = userEvent.setup();
    render(<EditableExport />);
    await user.click(screen.getByRole("button", { name: "Open export" }));
    const input = screen.getByRole("textbox", { name: "File name" });

    await user.click(input);
    await user.keyboard("{Home}New ");
    expect(input).toHaveValue("New Main.mp4");
    await user.tab();
    expect(input).toHaveValue("New Main.mp4");

    await user.clear(input);
    await user.paste("Final cut.mp4");
    await user.tab();
    expect(input).toHaveValue("Final cut.mp4");
    expect(screen.getByTestId("export-target").textContent).toBe(
      "/Users/me/scenes/out/Final cut.mp4"
    );
    await user.click(screen.getByRole("radio", { name: "WebM · VP9" }));
    expect(input).toHaveValue("Final cut.webm");
  });
});

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals })
    .__TAURI_INTERNALS__;
}

function mockExport() {
  const state = {
    cancels: 0,
    index: 0,
    requests: 0,
    revealed: [] as string[],
  };

  let settle: ((exported: Exported) => void) | null = null;
  let breaks: ((message: string) => void) | null = null;
  let stream = 0;

  mockIPC((cmd, args) => {
    if (cmd === "sidecar_request") {
      const payload = args as Record<string, unknown>;
      stream = (payload.onStream as { id: number }).id;
      state.requests += 1;

      return new Promise<Exported>((resolve, reject) => {
        settle = resolve;
        breaks = (message) => reject(new Error(message));
      });
    }

    if (cmd === "sidecar_cancel") {
      state.cancels += 1;
      return null;
    }

    if (cmd === "plugin:opener|reveal_item_in_dir") {
      state.revealed.push(String((args as { paths: string[] }).paths[0]));
      return null;
    }

    throw new Error(`unexpected command: ${cmd}`);
  });

  return {
    finish: async (exported: Exported = EXPORTED) => {
      await act(async () => {
        settle?.(exported);
        await Promise.resolve();
      });
    },
    send: (event: ExportEvent) => {
      act(() => {
        internals().runCallback(stream, { index: state.index, message: event });
        state.index += 1;
      });
    },
    spoil: async (message: string) => {
      await act(async () => {
        breaks?.(message);
        await Promise.resolve();
      });
    },
    state,
  };
}

async function started(settings: ExportOptions = SERVING) {
  const host = mockExport();
  const rendered = renderHook((props: ExportOptions) => useExport(props), {
    initialProps: settings,
  });

  act(() => {
    rendered.result.current.open();
  });

  await act(async () => {
    rendered.result.current.render();
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(rendered.result.current.isRunning).toBe(true);
  });

  return { host, rendered };
}

describe("the destination the dialog shows", () => {
  function opened(over: Partial<ExportOptions> = {}) {
    mockExport();
    const rendered = renderHook(() =>
      useExport({ ...SERVING, projectPath: "/Users/me/scenes", ...over })
    );

    act(() => {
      rendered.result.current.open();
    });

    return rendered;
  }

  it("names the file and the folder before anybody presses anything", () => {
    const { result } = opened();

    expect(result.current.fileName).toBe("Main.mp4");
    expect(result.current.folder).toBe("out");
    expect(result.current.target).toBe("/Users/me/scenes/out/Main.mp4");
  });

  it("follows the preset into the name", () => {
    const { result } = opened();

    act(() => {
      result.current.choosePreset("youtube");
    });

    expect(result.current.fileName).toBe("Main-youtube.mp4");
  });

  it("follows the format into the ending", () => {
    const { result } = opened();

    act(() => {
      result.current.chooseFormat("webm");
    });

    expect(result.current.fileName).toBe("Main.webm");
  });

  it("keeps a name that was typed, and still moves its ending with the format", () => {
    const { result } = opened();

    act(() => {
      result.current.rename({
        currentTarget: { value: "opening" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.fileName).toBe("opening.mp4");

    act(() => {
      result.current.chooseFormat("gif");
    });

    expect(result.current.fileName).toBe("opening.gif");
  });

  it("takes a folder from the picker and shows it", async () => {
    const { result } = opened({
      pick: () => Effect.succeed("/Users/me/Desktop"),
    });

    await act(async () => {
      result.current.chooseFolder();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.folder).toBe("~/Desktop");
    });

    expect(result.current.target).toBe("/Users/me/Desktop/Main.mp4");
  });

  it("keeps the folder it had when the picker was dismissed", async () => {
    const { result } = opened({ pick: () => Effect.succeed(null) });

    await act(async () => {
      result.current.chooseFolder();
      await Promise.resolve();
    });

    expect(result.current.folder).toBe("out");
  });

  it("renders to the file it showed, with no second step", async () => {
    const host = mockExport();
    const rendered = renderHook(() =>
      useExport({ ...SERVING, projectPath: "/Users/me/scenes" })
    );

    act(() => {
      rendered.result.current.open();
    });

    act(() => {
      rendered.result.current.choosePreset("shorts");
    });

    const { target } = rendered.result.current;

    await act(async () => {
      rendered.result.current.render();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rendered.result.current.isRunning).toBe(true);
    });

    expect(target).toBe("/Users/me/scenes/out/Main-shorts.mp4");
    expect(host.state.requests).toBe(1);
  });
});

describe("useExport", () => {
  it("blocks export until managed edits have been saved or discarded", () => {
    const { result } = renderHook(() =>
      useExport({ ...SERVING, managedPending: 1 })
    );
    expect(result.current.unavailable).toContain("saving or discard");
  });

  it("refuses to export a preview that is not serving", () => {
    const { result } = renderHook(() =>
      useExport({ ...SERVING, isServing: false })
    );

    expect(result.current.canExport).toBe(false);
    expect(result.current.unavailable).toBe(
      "The preview has to be running before it can be exported."
    );
  });

  it("refuses to export a project that is not open", () => {
    const { result } = renderHook(() =>
      useExport({
        composition: null,
        isServing: false,
        openedProjectId: null,
        projectId: null,
      })
    );

    expect(result.current.unavailable).toBe("Open a project to export it.");
  });

  // Inspect and Snapshot already refused this with the same sentence; Export
  // renders from the same preview and stayed enabled, so it would have put the
  // other project's video into its out/ under a conversation about this one.
  it("refuses while the preview shows another project than the open chat", () => {
    const { result } = renderHook(() =>
      useExport({ ...SERVING, openedProjectId: OTHER })
    );

    expect(result.current.canExport).toBe(false);
    expect(result.current.unavailable).toBe(
      "The preview is showing another project, not the one this chat belongs to."
    );
  });

  it("says what it is doing while the frames render", async () => {
    const { host, rendered } = await started();

    host.send({
      encoded: 40,
      percent: 21,
      rendered: 64,
      stage: "encoding",
      total: 300,
      type: "progress",
    });

    expect(rendered.result.current.status).toBe(
      "Rendering — 64/300 frames · 21%"
    );
    expect(rendered.result.current.percent).toBe(21);
  });

  it("shows the finished file without yanking Finder over the screen", async () => {
    const { host, rendered } = await started();

    await host.finish();

    await waitFor(() => {
      expect(rendered.result.current.result).toEqual(EXPORTED);
    });

    expect(rendered.result.current.isRunning).toBe(false);
    expect(rendered.result.current.status).toBeNull();
    expect(host.state.revealed).toEqual([]);
  });

  it("reveals the finished file when asked to", async () => {
    const { host, rendered } = await started();

    await host.finish();

    await waitFor(() => {
      expect(rendered.result.current.result).toEqual(EXPORTED);
    });

    await act(async () => {
      await rendered.result.current.reveal();
    });

    expect(host.state.revealed).toEqual([OUTPUT]);
  });

  it("cancels the request it started, and reports no error for it", async () => {
    const { host, rendered } = await started();

    act(() => {
      rendered.result.current.cancel();
    });

    await waitFor(() => {
      expect(rendered.result.current.isRunning).toBe(false);
    });

    expect(host.state.cancels).toBe(1);
    expect(rendered.result.current.trouble).toBeNull();
    expect(rendered.result.current.result).toBeNull();
  });

  it("cancels a render that has only just started without asking", async () => {
    const { host, rendered } = await started();

    act(() => {
      rendered.result.current.requestCancel();
    });

    await waitFor(() => {
      expect(rendered.result.current.isRunning).toBe(false);
    });
    expect(host.state.cancels).toBe(1);
    expect(rendered.result.current.isConfirmingCancel).toBe(false);
  });

  it("asks before cancelling a render that has run a while", async () => {
    const { host, rendered } = await started();
    const { now } = Date;
    Date.now = () => now() + CONFIRM_CANCEL_AFTER_MS + 1;

    try {
      act(() => {
        rendered.result.current.requestCancel();
      });
    } finally {
      Date.now = now;
    }

    expect(rendered.result.current.isConfirmingCancel).toBe(true);
    expect(rendered.result.current.isRunning).toBe(true);

    act(() => {
      rendered.result.current.keepExporting();
    });
    expect(rendered.result.current.isConfirmingCancel).toBe(false);
    expect(host.state.cancels).toBe(0);

    act(() => {
      rendered.result.current.confirmCancel();
    });
    await waitFor(() => {
      expect(rendered.result.current.isRunning).toBe(false);
    });
    expect(host.state.cancels).toBe(1);
  });

  it("lets a finished file be dismissed", async () => {
    const { host, rendered } = await started();

    await host.finish();
    await waitFor(() => {
      expect(rendered.result.current.result).toEqual(EXPORTED);
    });

    act(() => {
      rendered.result.current.dismiss();
    });
    expect(rendered.result.current.result).toBeNull();
  });

  it("retries a failed render with the settings it ran with", async () => {
    const { host, rendered } = await started();

    await host.spoil("Cannot find module ./missing");
    await waitFor(() => {
      expect(rendered.result.current.canRetry).toBe(true);
    });

    await act(async () => {
      rendered.result.current.retry();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rendered.result.current.isRunning).toBe(true);
    });
    expect(host.state.requests).toBe(2);
    expect(rendered.result.current.trouble).toBeNull();
  });

  it("surfaces why a render failed", async () => {
    const { host, rendered } = await started();

    await host.spoil("Cannot find module ./missing");

    await waitFor(() => {
      expect(rendered.result.current.trouble).toBe(
        "Cannot find module ./missing"
      );
    });

    expect(rendered.result.current.isRunning).toBe(false);
  });

  it("starts one export at a time", async () => {
    const { host, rendered } = await started();

    act(() => {
      rendered.result.current.start();
    });

    expect(host.state.requests).toBe(1);
  });

  it("says why another project's export blocks this one", async () => {
    const { rendered } = await started();

    rendered.rerender({ ...SERVING, openedProjectId: OTHER, projectId: OTHER });

    expect(rendered.result.current.isRunning).toBe(false);
    expect(rendered.result.current.canExport).toBe(false);
    expect(rendered.result.current.unavailable).toBe(
      "Another project is exporting, and only one export runs at a time."
    );
  });

  it("keeps showing a render that is still running when you come back to it", async () => {
    const { rendered } = await started();

    rendered.rerender({ ...SERVING, openedProjectId: OTHER, projectId: OTHER });
    rendered.rerender(SERVING);

    expect(rendered.result.current.isRunning).toBe(true);
  });

  it("does not show one project's finished file against another", async () => {
    const { host, rendered } = await started();

    await host.finish();

    await waitFor(() => {
      expect(rendered.result.current.result).toEqual(EXPORTED);
    });

    rendered.rerender({ ...SERVING, openedProjectId: OTHER, projectId: OTHER });

    expect(rendered.result.current.result).toBeNull();
  });
});
