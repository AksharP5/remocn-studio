import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import Page from "@/app/page";
import type {
  HistorySession,
  Project,
  TranscriptEntry,
  Video,
} from "@/shared/ipc";

const PICKED_FOLDER = "/Users/me/projects/my-video";
const SESSION_ROW = /^A promo for the launch/;
const PRODUCT_DEMO_ROW = /^Product demo/;
const LAUNCH_TEASER_ROW = /^Launch teaser/;
const WORDMARK = /^emocn/;
const STARTUP = "Make a video by describing it";
const SIDECAR_DOWN = /the sidecar is not running/;
const VIDEO_ROW = { selector: '[data-slot="sidebar-menu-button"] > span' };

const SIDECAR_READY = {
  attempt: 0,
  detail: null,
  logPath: "/tmp/sidecar.log",
  phase: "ready",
  pid: 1234,
};

const PROJECT: Project = {
  createdAt: 1_700_000_000_000,
  id: "project-1",
  missing: false,
  name: "my-video",
  path: PICKED_FOLDER,
  updatedAt: 1_700_000_000_000,
};

const VIDEO: Video = {
  compositionId: "my-video",
  createdAt: 1_700_000_000_000,
  deletedAt: null,
  id: "video-1",
  missing: false,
  name: "My video",
  projectId: PROJECT.id,
  updatedAt: 1_700_000_000_000,
};

const SECOND_VIDEO: Video = {
  compositionId: "second-video",
  createdAt: 1_700_000_000_000,
  deletedAt: null,
  id: "video-2",
  missing: false,
  name: "Second video",
  projectId: PROJECT.id,
  updatedAt: 1_700_000_000_000,
};

const STORED_SESSION: HistorySession = {
  createdAt: 1_700_000_000_000,
  id: "session-1",
  mode: "auto",
  projectId: PROJECT.id,
  provider: "claude" as const,
  sdkSessionId: "sdk-1",
  title: "A promo for the launch",
  updatedAt: 1_700_000_000_000,
  videoId: VIDEO.id,
};

function mockStudio(
  options: {
    blocks?: TranscriptEntry[];
    folder?: string | null;
    projects?:
      | Project[]
      | Promise<Project[]>
      | (() => Project[] | Promise<Project[]>);
    sessions?: HistorySession[];
    videos?: Video[];
  } = {}
) {
  mockIPC(
    (cmd, payload) => {
      if (cmd === "plugin:dialog|open") {
        return options.folder ?? null;
      }
      if (cmd === "sidecar_status") {
        return SIDECAR_READY;
      }
      if (cmd === "sidecar_request") {
        const { method } = payload as { method: string };
        if (method === "history.sessions") {
          return options.sessions ?? [];
        }
        if (method === "history.blocks") {
          return options.blocks ?? [];
        }
        if (method === "history.remove") {
          return { removed: true };
        }
        if (method === "library.list") {
          return [];
        }
        if (method === "project.list") {
          const { projects } = options;
          return typeof projects === "function" ? projects() : (projects ?? []);
        }
        if (method === "video.documents") {
          return {
            files: [],
            folder: `${PICKED_FOLDER}/src/videos/my-video/docs`,
          };
        }
        if (method === "video.list") {
          return options.videos ?? [VIDEO];
        }
        if (method === "video.reconcile") {
          return options.videos ?? [VIDEO];
        }
        if (method === "project.open") {
          return PROJECT;
        }
        if (method === "preview.start") {
          return new Promise(() => undefined);
        }
        throw new Error(`unexpected sidecar method: ${method}`);
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );
}

const OLDER_CHAT = /The older one/;

async function renderShell() {
  render(<Page />);
  await screen.findByRole("heading", { name: "Videos" });
}

// Picking a folder moved to the native File menu, which jsdom cannot open, so
// the route these tests drive is the startup screen's own button — on screen
// in every projectless shell.
async function openFolderButton() {
  return await screen.findByRole("button", {
    name: "Open an existing project",
  });
}

// The preview leaves once the project list comes back empty, so its own
// "show" button is the marker for a settled, project-less shell.
function showPreviewButton() {
  return screen.findByRole("button", { name: "Show the preview" });
}

describe("app shell", () => {
  beforeEach(() => {
    mockStudio();
  });

  it("renders the three panes", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();

    expect(screen.getByRole("heading", { name: "Videos" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Chat" })).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "Hide the preview" })
    ).toBeVisible();
  });

  it("keeps Docs behind a shortcut and offers the way back from it", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(await screen.findByText("My video", VIDEO_ROW));
    await screen.findByRole("button", { name: "Hide the preview" });

    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();

    fireEvent.keyDown(window, { key: "d", metaKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Preview" })).toBeNull()
    );
  });

  it("keeps the preview out of the way until there is a project", async () => {
    await renderShell();
    await showPreviewButton();

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Hide the preview" })
      ).not.toBeInTheDocument()
    );
  });

  it("does not reveal onboarding while stored projects are loading", async () => {
    let finishLoading: (projects: Project[]) => void = () => undefined;
    const projects = new Promise<Project[]>((resolve) => {
      finishLoading = resolve;
    });
    mockStudio({ projects });

    render(<Page />);
    await screen.findByRole("heading", { name: "Chat" });

    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();

    finishLoading([PROJECT]);
    expect(await screen.findByText("My video", VIDEO_ROW)).toBeVisible();
  });

  // A list that failed is not a list that is empty. Onboarding here told a
  // returning person their projects were gone, and New Project from that
  // screen would have failed the same way with nothing connecting the two.
  it("says the project list could not be read instead of onboarding", async () => {
    let attempts = 0;
    mockStudio({
      projects: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("the sidecar is not running"))
          : [PROJECT];
      },
    });

    render(<Page />);

    // The sidebar repeats the message; the conversation is where onboarding
    // used to be, so that is where the failure has to be.
    const conversation = within(await screen.findByLabelText("Conversation"));
    expect(
      await conversation.findByText("The project list could not be read")
    ).toBeVisible();
    expect(conversation.getByText(SIDECAR_DOWN)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();

    fireEvent.click(conversation.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("My video", VIDEO_ROW)).toBeVisible();
  });

  it("brings the preview back, and lets it be dismissed again", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();
    fireEvent.click(
      await screen.findByRole("button", { name: "Hide the preview" })
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByRole("button", { name: "Hide the preview" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Show the preview" }));

    expect(
      screen.getByRole("button", { name: "Hide the preview" })
    ).toBeVisible();
  });

  // "Clicking a video opens its most recent chat" is the invariant the rest of
  // the design leans on — the open chat decides the composition the preview
  // plays, the folder in the conventions and the target of an export. The row
  // only expanded, so a video could look selected while an unrelated chat drove
  // all three.
  it("opens a video's most recent chat when its row is clicked", async () => {
    mockStudio({
      projects: [PROJECT],
      sessions: [
        { ...STORED_SESSION, id: "session-2", title: "The newer one" },
        { ...STORED_SESSION, id: "session-1", title: "The older one" },
      ],
    });
    await renderShell();

    fireEvent.click(await screen.findByText("My video", VIDEO_ROW));

    expect(
      await screen.findByRole("heading", { name: "The newer one" })
    ).toBeVisible();
  });

  it("opens the command palette on Cmd+K and reaches a chat from it", async () => {
    mockStudio({
      projects: [PROJECT],
      sessions: [
        { ...STORED_SESSION, id: "session-2", title: "The newer one" },
        { ...STORED_SESSION, id: "session-1", title: "The older one" },
      ],
    });
    await renderShell();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("combobox")).toBeVisible();

    fireEvent.click(await screen.findByRole("option", { name: OLDER_CHAT }));

    expect(
      await screen.findByRole("heading", { name: "The older one" })
    ).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  // Row and chevron did the same thing, so the affordance that tells "expand"
  // from "open" pointed at nothing.
  it("expands without opening when the chevron alone is clicked", async () => {
    mockStudio({
      projects: [PROJECT],
      sessions: [{ ...STORED_SESSION, videoId: SECOND_VIDEO.id }],
      videos: [VIDEO, SECOND_VIDEO],
    });
    await renderShell();
    await screen.findByText("Second video");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show the chats about Second video",
      })
    );

    // The chat is listed under the video, but it is not the open one: the
    // pane's heading still names the chat that was open before.
    expect(await screen.findByText(STORED_SESSION.title)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STORED_SESSION.title })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Hide the chats about Second video",
      })
    ).toBeVisible();
  });

  // The band itself is there either way — it is what clears the traffic
  // lights. What arrives with the first project is the state indicator in it.
  it("keeps the state indicator out of an empty app", async () => {
    const { container } = render(<Page />);
    await showPreviewButton();

    expect(container.querySelector('[data-slot="titlebar"]')).toBeVisible();
    expect(container.querySelector('[data-slot="titlebar-mood"]')).toBeNull();
  });

  it("lights the band once there is a project", async () => {
    mockStudio({ projects: [PROJECT] });
    const { container } = render(<Page />);
    await screen.findByText("My video", VIDEO_ROW);

    expect(
      container.querySelector('[data-slot="titlebar-mood"]')
    ).toBeInTheDocument();
  });

  it("opens the new project dialog with the project list hidden", async () => {
    await renderShell();
    await showPreviewButton();
    fireEvent.click(
      screen.getByRole("button", { name: "Hide the project list" })
    );

    const [cta] = screen.getAllByRole("button", { name: "New Project…" });
    fireEvent.click(cta);

    expect(
      await screen.findByRole("heading", { name: "New Project" })
    ).toBeVisible();
  });

  it("lets the project list be dismissed and brought back", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    await screen.findByText("My video", VIDEO_ROW);

    fireEvent.click(
      screen.getByRole("button", { name: "Hide the project list" })
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByRole("heading", { name: "Videos" })
    );
    expect(screen.queryByText("My video", VIDEO_ROW)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show the project list" })
    );

    expect(screen.getByRole("heading", { name: "Videos" })).toBeVisible();
    expect(await screen.findByText("My video", VIDEO_ROW)).toBeVisible();
  });

  it("keeps the chat clear of the window buttons on its own", async () => {
    const { container } = render(<Page />);
    await screen.findByRole("heading", { name: "Chat" });

    fireEvent.click(
      await screen.findByRole("button", { name: "Hide the project list" })
    );

    expect(container.querySelector('[data-slot="pane-header"]')).toHaveClass(
      "pl-(--titlebar-inline-inset)"
    );
  });

  it("lets the transcript be selected, unlike the rest of the shell", async () => {
    const { container } = render(<Page />);
    await screen.findByRole("heading", { name: "Chat" });

    expect(
      container.querySelector('[data-slot="message-scroller-content"]')
    ).toHaveAttribute("data-selectable");
  });

  it("leaves the projects pane bare and offers to create one instead", async () => {
    await renderShell();
    await showPreviewButton();

    // The pane's own copies moved into the project switcher's menu, so the
    // startup screen is the only one on screen without opening it.
    const create = screen.getAllByRole("button", { name: "New Project…" });

    expect(screen.getByRole("heading", { name: STARTUP })).toBeVisible();
    expect(create).toHaveLength(1);
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("walks a first-time user through the steps, ending on the CTA", async () => {
    await renderShell();
    await showPreviewButton();

    const steps = screen.getByRole("list", { name: "Getting started" });

    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(within(steps).getByText("Start a project")).toBeVisible();
    expect(within(steps).getByText("Export the mp4")).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Open an existing project" })
    ).toHaveLength(1);
  });

  it("names the app at the head of the sidebar, and never a folder", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    // The lockup spells the name with the mark as its "R", so the text beside
    // the glyph starts at "emocn" — nothing else in the shell draws that.
    const wordmark = await screen.findByRole("img", {
      name: "Remocn Studio",
    });
    expect(within(wordmark).getByText(WORDMARK)).toBeVisible();

    // The open project's name lives in the native File menu now, so the
    // sidebar never spells a folder at all — only the videos inside it.
    await screen.findByText("My video", VIDEO_ROW);
    expect(screen.queryByText("my-video")).not.toBeInTheDocument();
  });

  it("opens the picked folder into the pane", async () => {
    mockStudio({ folder: PICKED_FOLDER });
    await renderShell();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByText("My video", VIDEO_ROW)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("keeps the empty states when the picker is dismissed", async () => {
    mockStudio({ folder: null });
    await renderShell();
    await showPreviewButton();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByRole("heading", { name: STARTUP })).toBeVisible();
    expect(screen.queryByText("My video", VIDEO_ROW)).not.toBeInTheDocument();
  });

  it("lists stored sessions and opens the one that is clicked", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    fireEvent.click(
      await screen.findByRole("button", {
        name: SESSION_ROW,
      })
    );

    expect(await screen.findByText("My video", VIDEO_ROW)).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "A promo for the launch" })
    ).toBeVisible();
  });

  it("offers the templates on a fresh session, and a pick fills without sending", async () => {
    mockStudio({ folder: PICKED_FOLDER });
    await renderShell();
    fireEvent.click(await openFolderButton());
    await screen.findByText("What should we make?");

    fireEvent.click(screen.getByRole("button", { name: PRODUCT_DEMO_ROW }));

    const field = screen.getByRole("textbox", { name: "Message" });
    expect((field as HTMLTextAreaElement).value).toContain("[product name]");
    expect(screen.getByText("What should we make?")).toBeVisible();
    expect(
      screen.getByRole("button", { name: LAUNCH_TEASER_ROW })
    ).toBeVisible();
  });

  it("keeps the templates out of a session that has already spoken", async () => {
    mockStudio({
      blocks: [{ id: "block-0", kind: "assistant", text: "All done." }],
      projects: [PROJECT],
      sessions: [STORED_SESSION],
    });
    await renderShell();

    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));

    expect(await screen.findByText("All done.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: PRODUCT_DEMO_ROW })
    ).not.toBeInTheDocument();
  });

  it("drops a deleted session and puts the chat back on a new one", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    await screen.findByRole("heading", { name: "A promo for the launch" });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete A promo for the launch" })
    );

    expect(
      screen.queryByRole("button", { name: SESSION_ROW })
    ).not.toBeInTheDocument();
    expect(await screen.findByText("No chats yet")).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "New chat" })
    ).toBeVisible();
  });

  it("offers to undo a delete, and puts the session back where it was", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    await screen.findByRole("heading", { name: "A promo for the launch" });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete A promo for the launch" })
    );

    expect(await screen.findByText("Chat deleted")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(
      await screen.findByRole("button", { name: SESSION_ROW })
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "A promo for the launch" })
    ).toBeVisible();
  });

  it("offers a way to start a project from the header", async () => {
    await renderShell();

    const [header] = await screen.findAllByRole("button", {
      name: "New Project…",
    });

    expect(header).toBeVisible();
  });

  it("says so when the history cannot be read", async () => {
    mockIPC(
      (cmd) => {
        if (cmd === "sidecar_status") {
          return SIDECAR_READY;
        }
        if (cmd === "sidecar_request") {
          throw new Error("the sidecar is not running");
        }
        throw new Error(`unexpected command: ${cmd}`);
      },
      { shouldMockEvents: true }
    );
    await renderShell();

    expect(await screen.findByText("History is unavailable")).toBeVisible();
    // The project list failed too, and the conversation says so beside the
    // sidebar: one Try again each.
    expect(
      screen.getByText("The project list could not be read")
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(
      2
    );
  });
});
