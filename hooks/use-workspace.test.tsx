import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkspace } from "@/hooks/use-workspace";
import type { StudioSettings } from "@/lib/studio/settings";
import type { HistorySession, Project, Video } from "@/shared/ipc";

const SETTINGS: StudioSettings = {
  assetOffers: null,
  claudeEffort: null,
  claudeModel: null,
  codexModel: null,
  copilotModel: null,
  crashReports: null,
  expandedVideos: [],
  grokModel: null,
  legacyProjectFolder: null,
  paneView: null,
  previewPane: null,
  projectsPane: null,
  taskDock: null,
  toursSeen: [],
  trialCardsDismissed: [],
};

function project(id: string): Project {
  return {
    createdAt: 0,
    id,
    missing: false,
    name: id,
    path: `/Users/me/${id}`,
    updatedAt: 0,
  };
}

function video(id: string, projectId: string): Video {
  return {
    compositionId: id,
    createdAt: 0,
    deletedAt: null,
    id,
    missing: false,
    name: id,
    projectId,
    updatedAt: 0,
  };
}

function session(
  id: string,
  projectId: string,
  videoId: string
): HistorySession {
  return {
    createdAt: 0,
    id,
    mode: "auto",
    projectId,
    provider: "claude",
    sdkSessionId: null,
    title: id,
    updatedAt: 0,
    videoId,
  };
}

const A = project("project-a");
const B = project("project-b");
const VIDEOS: Record<string, Video[]> = {
  [A.id]: [video("video-a", A.id)],
  [B.id]: [video("video-b", B.id)],
};

const A_NEW = session("a-new", A.id, "video-a");
const B_NEW = session("b-new", B.id, "video-b");
const B_OLD = session("b-old", B.id, "video-b");

function harness(sessions: readonly HistorySession[]) {
  mockIPC(
    (cmd, payload) => {
      if (cmd !== "sidecar_request") {
        return null;
      }

      const call = payload as {
        method: string;
        params: { projectId?: string } | null;
      };

      if (call.method === "project.list") {
        return [A, B];
      }
      if (call.method === "history.sessions") {
        return sessions;
      }
      if (call.method === "video.list") {
        return VIDEOS[call.params?.projectId ?? ""] ?? [];
      }
      return null;
    },
    { shouldMockEvents: true }
  );

  return renderHook(() => useWorkspace(SETTINGS));
}

afterEach(() => {
  clearMocks();
});

// File → ‹project› is the one way to change project without opening a chat,
// and it moved the video list and the preview while the chat pane stayed on
// the project that was open before — two projects on screen at once, with
// Export bound to the preview.
describe("useWorkspace", () => {
  it("opens the project's most recent chat when the project is switched", async () => {
    const { result } = harness([B_NEW, A_NEW, B_OLD]);

    await waitFor(() => expect(result.current.projects).toHaveLength(2));
    await waitFor(() => expect(result.current.sessions).toHaveLength(3));

    act(() => {
      result.current.selectSession(A_NEW);
    });
    expect(result.current.openedSession?.id).toBe("a-new");

    act(() => {
      result.current.selectProject(B.id);
    });

    expect(result.current.activeProject?.id).toBe(B.id);
    expect(result.current.openedProject?.id).toBe(B.id);
    expect(result.current.openedSession?.id).toBe("b-new");
  });

  it("switches to a project with no chats on an empty composer", async () => {
    const { result } = harness([A_NEW]);

    await waitFor(() => expect(result.current.projects).toHaveLength(2));
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    act(() => {
      result.current.selectSession(A_NEW);
    });

    act(() => {
      result.current.selectProject(B.id);
    });

    expect(result.current.activeProject?.id).toBe(B.id);
    expect(result.current.openedProject?.id).toBe(B.id);
    expect(result.current.openedSession).toBeNull();
  });
});
