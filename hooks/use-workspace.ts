"use client";

import { Effect, Exit } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useMemo, useRef } from "react";
import {
  type ExpandedVideos,
  useExpandedVideos,
} from "@/hooks/use-expanded-videos";
import {
  type ProjectActions,
  useProjectActions,
} from "@/hooks/use-project-actions";
import { type StudioProjects, useProjects } from "@/hooks/use-projects";
import { type Scaffolds, useScaffold } from "@/hooks/use-scaffold";
import { type StudioSessions, useSessions } from "@/hooks/use-sessions";
import type { TemplateOutcome } from "@/hooks/use-template-links";
import { type TurnActions, useTurns } from "@/hooks/use-turns";
import { type StudioVideos, useVideos } from "@/hooks/use-videos";
import { causeMessage } from "@/lib/error-message";
import type { VideoFormat } from "@/lib/studio/formats";
import {
  newestChat,
  newestChatIn,
  type PaneGroup,
  paneGroups,
  projectOf,
  reuseGroups,
  videoOf,
} from "@/lib/studio/groups";
import { saveSessionMode } from "@/lib/studio/history";
import { createFromTemplate } from "@/lib/studio/projects";
import type { StudioSettings } from "@/lib/studio/settings";
import {
  type SessionStatus,
  statusOf,
  type TurnState,
} from "@/lib/studio/turns";
import type {
  HistorySession,
  Project,
  ProjectDraft,
  SessionMode,
  Video,
} from "@/shared/ipc";
import type { TemplateDraft } from "@/shared/templates";

export interface Workspace
  extends StudioProjects,
    StudioSessions,
    StudioVideos,
    ExpandedVideos,
    Omit<ProjectActions, "createProject">,
    Scaffolds,
    TurnActions {
  addVideo: (name: string, format: VideoFormat) => Promise<Video | null>;
  changeSessionMode: (historyId: string, mode: SessionMode) => void;
  createProject: (
    draft: ProjectDraft,
    format: VideoFormat
  ) => Promise<Project | null>;
  groups: readonly PaneGroup[];
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenVideo: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  openedProject: Project | null;
  openedVideo: Video | null;
  openTemplate: (draft: TemplateDraft) => Promise<TemplateOutcome>;
  openVideo: (videoId: string) => void;
  startSessionIn: (videoId: string) => void;
  statuses: ReadonlyMap<string, SessionStatus>;
}

export interface WorkspaceState {
  turns: ReadonlyMap<string, TurnState>;
  workspace: Workspace;
}

export function useWorkspace(settings: StudioSettings | null): WorkspaceState {
  const projects = useProjects(settings);
  const sessions = useSessions();
  const actions = useProjectActions();
  const turns = useTurns(sessions.rememberSession);
  const scaffolds = useScaffold(projects.replaceProject);
  const videos = useVideos(projects.activeProject?.id ?? null);
  const expansion = useExpandedVideos(settings, videos.activeVideo?.id ?? null);

  const { forgetProject, rememberProject, replaceProject, selectProject } =
    projects;
  const { forgetSessionsOf, replaceSession, selectSession, startSession } =
    sessions;
  const { createVideo, rememberVideo, selectVideo } = videos;
  const { expandVideo } = expansion;
  const { setTurnMode, stopTurn } = turns;
  const rows = sessions.sessions;
  const pickFolder = projects.openFolder;
  const create = actions.createProject;
  const relocate = actions.relocateProject;
  const remove = actions.removeProject;
  const rename = actions.renameProject;

  const startSessionIn = useCallback(
    (videoId: string) => {
      selectVideo(videoId);
      expandVideo(videoId);
      startSession();
    },
    [expandVideo, selectVideo, startSession]
  );

  const changeSessionMode = useCallback(
    (historyId: string, mode: SessionMode) => {
      setTurnMode(historyId, mode);

      if (!rows.some((row) => row.id === historyId)) {
        return;
      }

      Effect.runFork(
        saveSessionMode(historyId, mode).pipe(
          Effect.tap((session) => Effect.sync(() => replaceSession(session))),
          Effect.ignore
        )
      );
    },
    [replaceSession, rows, setTurnMode]
  );

  const openFolder = useCallback(async () => {
    const project = await pickFolder();
    if (project !== null) {
      startSession();
    }
    return project;
  }, [pickFolder, startSession]);

  const { startScaffold } = scaffolds;

  // Creating a project and creating its first video are one gesture: the
  // person asked for a video, and the folder is the container it needs.
  const createProject = useCallback(
    async (draft: ProjectDraft, format: VideoFormat) => {
      const project = await create(draft);
      if (project === null) {
        return null;
      }

      rememberProject(project);
      startScaffold(project.id);

      const video = await createVideo(project.id, draft.name, format);
      if (video !== null) {
        expandVideo(video.id);
      }
      startSession();

      return project;
    },
    [
      create,
      createVideo,
      expandVideo,
      rememberProject,
      startScaffold,
      startSession,
    ]
  );

  // The same gesture as the wizard — a project, its first video, the scaffold
  // and a fresh chat — with the sidecar having already written the video from
  // the template, so only the install is left for the scaffold to do.
  const openTemplate = useCallback(
    async (draft: TemplateDraft): Promise<TemplateOutcome> => {
      const exit = await Effect.runPromiseExit(createFromTemplate(draft));
      if (Exit.isFailure(exit)) {
        return { error: causeMessage(exit.cause) ?? "interrupted" };
      }

      const { project, video } = exit.value;
      rememberProject(project);
      startScaffold(project.id);
      rememberVideo(video);
      expandVideo(video.id);
      startSession();

      return { project };
    },
    [expandVideo, rememberProject, rememberVideo, startScaffold, startSession]
  );

  const activeProjectId = projects.activeProject?.id ?? null;

  const addVideo = useCallback(
    async (name: string, format: VideoFormat) => {
      if (activeProjectId === null) {
        return null;
      }

      const video = await createVideo(activeProjectId, name, format);
      if (video !== null) {
        expandVideo(video.id);
        startSession();
      }
      return video;
    },
    [activeProjectId, createVideo, expandVideo, startSession]
  );

  const renameProject = useCallback(
    async (projectId: string, name: string) => {
      const project = await rename(projectId, name);
      if (project !== null) {
        replaceProject(project);
      }
      return project;
    },
    [rename, replaceProject]
  );

  const relocateProject = useCallback(
    async (projectId: string, path: string) => {
      const project = await relocate(projectId, path);
      if (project !== null) {
        replaceProject(project);
      }
      return project;
    },
    [relocate, replaceProject]
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      for (const row of rows) {
        if (row.projectId === projectId) {
          stopTurn(row.id);
        }
      }

      const removed = await remove(projectId);
      if (removed) {
        forgetSessionsOf(projectId);
        forgetProject(projectId);
      }
      return removed;
    },
    [forgetProject, forgetSessionsOf, remove, rows, stopTurn]
  );

  const openSession = useCallback(
    (session: HistorySession) => {
      selectProject(session.projectId);
      selectVideo(session.videoId);
      expandVideo(session.videoId);
      selectSession(session);
    },
    [expandVideo, selectProject, selectSession, selectVideo]
  );

  const onSelectSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const found = rows.find((row) => row.id === event.currentTarget.value);
      if (found !== undefined) {
        openSession(found);
      }
    },
    [openSession, rows]
  );

  // The row opens; the chevron beside it expands. They used to be the same
  // click, which left a video looking selected — expanded and highlighted —
  // with an unrelated chat driving the preview, the conventions and Export.
  const openVideo = useCallback(
    (videoId: string) => {
      const newest = newestChat(rows, videoId);

      if (newest === null) {
        expandVideo(videoId);
        return;
      }

      openSession(newest);
    },
    [expandVideo, openSession, rows]
  );

  const onOpenVideo = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      openVideo(event.currentTarget.value);
    },
    [openVideo]
  );

  // File → ‹project› moved the video list and the preview and left the chat
  // where it was, so the app showed two projects at once — the old transcript
  // beside the new preview, with Export bound to the preview. The switch opens
  // the project's most recent chat, exactly as a video row does; a project
  // with no chats yet opens with an empty composer rather than someone else's
  // conversation.
  const switchProject = useCallback(
    (projectId: string) => {
      const newest = newestChatIn(rows, projectId);
      if (newest !== null) {
        openSession(newest);
        return;
      }

      selectProject(projectId);
      startSession();
    },
    [openSession, rows, selectProject, startSession]
  );

  const onNewSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      startSessionIn(event.currentTarget.value);
    },
    [startSessionIn]
  );

  const removeSession = sessions.onRemoveSession;

  const onRemoveSession = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      stopTurn(event.currentTarget.value);
      removeSession(event);
    },
    [removeSession, stopTurn]
  );

  const shownGroups = useRef<readonly PaneGroup[]>([]);
  const groups = useMemo(() => {
    const next = reuseGroups(
      shownGroups.current,
      paneGroups(videos.videos, rows, turns.turns)
    );
    shownGroups.current = next;
    return next;
  }, [rows, turns.turns, videos.videos]);

  const shownStatuses = useRef<ReadonlyMap<string, SessionStatus>>(new Map());
  const statuses = useMemo(() => {
    const next = new Map<string, SessionStatus>();
    for (const [historyId, turn] of turns.turns) {
      next.set(historyId, statusOf(turn));
    }
    const was = shownStatuses.current;
    const same =
      was.size === next.size &&
      [...next].every(([historyId, status]) => was.get(historyId) === status);
    if (!same) {
      shownStatuses.current = next;
    }
    return shownStatuses.current;
  }, [turns.turns]);

  const openedProject = projectOf(
    projects.projects,
    sessions.openedSession,
    projects.activeProject
  );

  const openedVideo = videoOf(
    videos.videos,
    sessions.openedSession,
    videos.activeVideo
  );

  const turnActions = turns.actions;

  const workspace = useMemo(
    () => ({
      ...projects,
      ...sessions,
      ...videos,
      ...actions,
      ...expansion,
      ...scaffolds,
      ...turnActions,
      addVideo,
      changeSessionMode,
      createProject,
      groups,
      onNewSession,
      onOpenVideo,
      onRemoveSession,
      onSelectSession,
      openedProject,
      openedVideo,
      openFolder,
      openTemplate,
      openVideo,
      relocateProject,
      removeProject,
      renameProject,
      selectProject: switchProject,
      selectSession: openSession,
      startSessionIn,
      statuses,
    }),
    [
      actions,
      addVideo,
      changeSessionMode,
      createProject,
      expansion,
      groups,
      onNewSession,
      onOpenVideo,
      onRemoveSession,
      onSelectSession,
      openedProject,
      openedVideo,
      openFolder,
      openSession,
      openTemplate,
      openVideo,
      projects,
      relocateProject,
      removeProject,
      renameProject,
      scaffolds,
      sessions,
      startSessionIn,
      statuses,
      switchProject,
      turnActions,
      videos,
    ]
  );

  return useMemo(
    () => ({ turns: turns.turns, workspace }),
    [turns.turns, workspace]
  );
}
