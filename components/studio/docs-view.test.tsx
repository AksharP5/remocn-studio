import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DocsView } from "@/components/studio/docs-view";
import type { Docs } from "@/hooks/use-docs";
import { documentTabs } from "@/lib/studio/documents";
import type { ProjectFile } from "@/shared/ipc";

const FOLDER = "/Users/me/project/src/videos/intro/docs";
const DOCS_FOLDER = /videos\/intro\/docs/;

function file(name: string): ProjectFile {
  return { modifiedAt: 1, name, path: `${FOLDER}/${name}` };
}

function docs(shape: Partial<Docs> = {}): Docs {
  const tabs = shape.tabs ?? documentTabs([]);

  return {
    error: null,
    folder: FOLDER,
    isLoading: false,
    mode: "docs",
    onPickMode: mock(),
    onPickTab: mock(),
    onReveal: mock(),
    open: null,
    openPath: tabs[0]?.file.path ?? null,
    pickMode: mock(),
    ...shape,
    tabs,
  };
}

function open(name: string, text: string): Partial<Docs> {
  return { open: { file: file(name), text } };
}

describe("DocsView", () => {
  it("says where the pipeline writes, rather than showing an empty pane", () => {
    render(<DocsView docs={docs()} />);

    expect(screen.getByText("No documents yet")).toBeVisible();
    expect(screen.getByText(DOCS_FOLDER)).toBeVisible();
  });

  it("stands one tab per document, in pipeline order", () => {
    const tabs = documentTabs([file("script.md"), file("analysis.md")]);

    render(<DocsView docs={docs({ tabs, ...open("analysis.md", "# A") })} />);

    // The icon renders its own <title>, so `textContent` is not the name a
    // screen reader reads; the accessible name is, and it is the file.
    const strip = within(screen.getByRole("tablist"));
    const [first, second] = strip.getAllByRole("tab");

    expect(first).toBe(strip.getByRole("tab", { name: "analysis.md" }));
    expect(second).toBe(strip.getByRole("tab", { name: "script.md" }));
  });

  it("marks exactly the open document as the active tab", () => {
    const tabs = documentTabs([file("analysis.md"), file("script.md")]);

    render(
      <DocsView
        docs={docs({
          openPath: `${FOLDER}/script.md`,
          tabs,
          ...open("script.md", "# S"),
        })}
      />
    );

    const [analysis, script] = screen.getAllByRole("tab");
    expect(script).toHaveAttribute("data-active");
    expect(analysis).not.toHaveAttribute("data-active");
  });

  it("names the stage a document belongs to, where the file name does not", () => {
    const tabs = documentTabs([file("choreography.md")]);

    render(
      <DocsView docs={docs({ tabs, ...open("choreography.md", "# C") })} />
    );

    expect(screen.getByRole("tab")).toHaveAttribute("title", "Choreography");
  });

  it("renders the document under the strip", () => {
    const tabs = documentTabs([file("script.md")]);

    render(
      <DocsView docs={docs({ tabs, ...open("script.md", "# Scene one") })} />
    );

    expect(screen.getByText("Scene one")).toBeVisible();
  });

  // A strip of six tabs must cost one Tab stop, not six: the open tab is the
  // way in and the arrows walk from there.
  it("keeps exactly the open tab in the tab order", () => {
    const tabs = documentTabs([file("analysis.md"), file("script.md")]);

    render(
      <DocsView
        docs={docs({
          openPath: `${FOLDER}/script.md`,
          tabs,
          ...open("script.md", "# S"),
        })}
      />
    );

    const reachable = screen
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("tabindex") !== "-1");

    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAccessibleName("script.md");
  });

  it("reports the document a tab was picked with", () => {
    const onPickTab = mock();
    const tabs = documentTabs([file("analysis.md"), file("script.md")]);

    render(
      <DocsView
        docs={docs({ onPickTab, tabs, ...open("analysis.md", "# A") })}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "script.md" }));

    expect(onPickTab).toHaveBeenCalledWith(
      `${FOLDER}/script.md`,
      expect.anything()
    );
  });

  it("words a read that failed instead of drawing a blank document", () => {
    const tabs = documentTabs([file("script.md")]);

    render(
      <DocsView docs={docs({ error: "script.md is not a text file.", tabs })} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "script.md is not a text file."
    );
  });
});
