import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { type DocsSettings, useDocs } from "@/hooks/use-docs";
import type { ProjectFile, TranscriptEntry } from "@/shared/ipc";

const PROJECT = "project-1";
const VIDEO = "video-1";
const FOLDER = "/Users/me/project/src/videos/intro/docs";

function file(name: string): ProjectFile {
  return { modifiedAt: 1, name, path: `${FOLDER}/${name}` };
}

interface Calls {
  listings: number;
  reads: string[];
  write: (path: string, text: string) => void;
}

function install(files: readonly ProjectFile[]): Calls {
  const texts = new Map(
    files
      .filter((row) => row.name !== "gone.md")
      .map((row) => [row.path, `# ${row.name}`])
  );
  const calls: Calls = {
    listings: 0,
    reads: [],
    write: (path, text) => texts.set(path, text),
  };

  mockIPC((cmd, payload) => {
    if (cmd !== "sidecar_request") {
      throw new Error(`unexpected command: ${cmd}`);
    }

    const { method, params } = payload as {
      method: string;
      params: Record<string, string>;
    };

    if (method === "video.documents") {
      calls.listings += 1;
      return { files, folder: FOLDER };
    }

    if (method === "project.read") {
      calls.reads.push(params.path);
      const text = texts.get(params.path);
      if (text === undefined) {
        throw new Error(`${params.path} could not be read`);
      }
      return { modifiedAt: 2, text };
    }

    throw new Error(`unexpected sidecar method: ${method}`);
  });

  return calls;
}

function settings(shape: Partial<DocsSettings> = {}): DocsSettings {
  return {
    entries: [],
    isTurnRunning: false,
    projectId: PROJECT,
    videoId: VIDEO,
    ...shape,
  };
}

function wrote(id: string, path: string): TranscriptEntry {
  return {
    id,
    input: { file_path: path },
    kind: "activity",
    name: "Edit",
    result: null,
    state: "done",
    verb: "edit",
  };
}

function click(value: string) {
  return {
    currentTarget: { value },
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

describe("useDocs", () => {
  beforeEach(() => {
    clearMocks();
  });

  it("opens the first document in pipeline order without being asked", async () => {
    install([file("script.md"), file("analysis.md")]);

    const { result } = renderHook(() => useDocs(settings()));

    await waitFor(() => {
      expect(result.current.open?.file.name).toBe("analysis.md");
    });
    expect(result.current.tabs.map((tab) => tab.file.name)).toEqual([
      "analysis.md",
      "script.md",
    ]);
    expect(result.current.folder).toBe(FOLDER);
  });

  it("starts on the preview and moves only when asked", async () => {
    install([file("script.md")]);

    const { result } = renderHook(() => useDocs(settings()));
    await waitFor(() => expect(result.current.open).not.toBeNull());

    expect(result.current.mode).toBe("preview");

    act(() => result.current.onPickMode(click("docs")));
    expect(result.current.mode).toBe("docs");

    act(() => result.current.onPickMode(click("preview")));
    expect(result.current.mode).toBe("preview");
  });

  it("opens the document a stage row names, and moves the pane with it", async () => {
    install([file("analysis.md"), file("script.md")]);

    const { result } = renderHook(() => useDocs(settings()));
    await waitFor(() => expect(result.current.open).not.toBeNull());

    act(() => result.current.onReveal(click(`${FOLDER}/script.md`)));

    await waitFor(() => {
      expect(result.current.open?.file.name).toBe("script.md");
    });
    expect(result.current.mode).toBe("docs");
  });

  // The tab and the mode are per video and live in memory, so looking at
  // another video and coming back lands where you left off.
  it("remembers the tab and the mode per video", async () => {
    install([file("analysis.md"), file("script.md")]);

    const { rerender, result } = renderHook(
      (props: DocsSettings) => useDocs(props),
      { initialProps: settings() }
    );
    await waitFor(() => expect(result.current.open).not.toBeNull());

    act(() => result.current.onReveal(click(`${FOLDER}/script.md`)));
    await waitFor(() => {
      expect(result.current.open?.file.name).toBe("script.md");
    });

    rerender(settings({ videoId: "video-2" }));
    await waitFor(() => expect(result.current.mode).toBe("preview"));

    rerender(settings());
    await waitFor(() => {
      expect(result.current.openPath).toBe(`${FOLDER}/script.md`);
    });
    expect(result.current.mode).toBe("docs");
  });

  // No watcher: the webview already receives every tool call, so the agent
  // writing to the open file is the signal to read it again.
  it("reads the open document again when the agent writes to it", async () => {
    const calls = install([file("script.md")]);
    const path = `${FOLDER}/script.md`;

    const { rerender, result } = renderHook(
      (props: DocsSettings) => useDocs(props),
      { initialProps: settings() }
    );
    await waitFor(() => expect(result.current.open?.text).toBe("# script.md"));

    calls.write(path, "# Scene two");
    rerender(settings({ entries: [wrote("tool-1", path)] }));

    await waitFor(() => expect(result.current.open?.text).toBe("# Scene two"));
  });

  it("ignores a write to a file that is not open", async () => {
    const calls = install([file("script.md"), file("brand.md")]);

    const { rerender, result } = renderHook(
      (props: DocsSettings) => useDocs(props),
      { initialProps: settings() }
    );
    await waitFor(() => expect(result.current.open).not.toBeNull());
    const seen = calls.reads.length;

    rerender(
      settings({ entries: [wrote("tool-1", "/Users/me/project/src/App.tsx")] })
    );

    expect(calls.reads).toHaveLength(seen);
  });

  it("lists again when a turn settles, because the agent writes these files", async () => {
    const calls = install([file("script.md")]);

    const { rerender, result } = renderHook(
      (props: DocsSettings) => useDocs(props),
      { initialProps: settings({ isTurnRunning: true }) }
    );
    await waitFor(() => expect(result.current.open).not.toBeNull());
    const { listings } = calls;

    rerender(settings({ isTurnRunning: false }));

    await waitFor(() => expect(calls.listings).toBe(listings + 1));
  });

  // The listing and the read are two calls, so a file that vanished between
  // them is the ordinary failure — and it has to be worded, not shown as an
  // empty document.
  it("says why a document could not be read, rather than showing nothing", async () => {
    install([file("gone.md")]);

    const { result } = renderHook(() => useDocs(settings()));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain("gone.md");
    expect(result.current.open).toBeNull();
  });

  it("keeps a tab open only while the folder still holds it", async () => {
    install([file("script.md")]);

    const { result } = renderHook(() => useDocs(settings()));
    await waitFor(() => expect(result.current.open).not.toBeNull());

    act(() => result.current.onPickTab(`${FOLDER}/never-written.md`));

    expect(result.current.openPath).toBe(`${FOLDER}/script.md`);
  });

  it("has nothing to show with no video open", async () => {
    install([file("script.md")]);

    const { result } = renderHook(() => useDocs(settings({ videoId: null })));

    await waitFor(() => expect(result.current.tabs).toEqual([]));
    expect(result.current.open).toBeNull();
    expect(result.current.mode).toBe("preview");
  });
});
