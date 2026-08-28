"use client";

import { createContext, use, useCallback, useMemo } from "react";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { type Composer, useComposer } from "@/hooks/use-composer";
import { useCrashReporting } from "@/hooks/use-crash-reporting";
import { type Environment, useEnvironment } from "@/hooks/use-environment";
import { type FileDrops, useFileDrops } from "@/hooks/use-file-drops";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { type Library, useLibrary } from "@/hooks/use-library";
import { type StudioModels, useModels } from "@/hooks/use-models";
import { type NewProject, useNewProject } from "@/hooks/use-new-project";
import { type NewVideo, useNewVideo } from "@/hooks/use-new-video";
import { type OpenTurn, useOpenTurn } from "@/hooks/use-open-turn";
import { type Panes, usePanes } from "@/hooks/use-panes";
import { type Preferences, usePreferences } from "@/hooks/use-preferences";
import { usePreview } from "@/hooks/use-preview";
import {
  type Accounts,
  useProviderAccounts,
} from "@/hooks/use-provider-accounts";
import { type Queue, useQueue } from "@/hooks/use-queue";
import { useReconciledVideos } from "@/hooks/use-reconciled-videos";
import {
  type SettingsDialog,
  useSettingsDialog,
} from "@/hooks/use-settings-dialog";
import { type Tools, useTools } from "@/hooks/use-tools";
import { type Updates, useUpdates } from "@/hooks/use-updates";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";
import type { VideoFormat } from "@/lib/studio/formats";
import type { StudioSettings } from "@/lib/studio/settings";
import type { ProjectDraft, PromptFrame } from "@/shared/ipc";

export type Studio = ClaudeEffort &
  StudioModels &
  Panes &
  Workspace & {
    accounts: Accounts;
    composer: Composer;
    drops: FileDrops;
    environment: Environment;
    library: Library;
    newProject: NewProject;
    newVideo: NewVideo;
    preferences: Preferences;
    queue: Queue;
    settings: StudioSettings | null;
    settingsDialog: SettingsDialog;
    tools: Tools;
    turn: OpenTurn;
    updates: Updates;
  };

const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const value = use(StudioContext);
  if (value === null) {
    throw new Error("useStudio must be called inside <StudioProvider>.");
  }
  return value;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const settings = useHydratedSettings();
  const workspace = useWorkspace(settings);
  const model = useModels(settings);
  const accounts = useProviderAccounts();
  const effort = useClaudeEffort(settings);
  const preferences = usePreferences(settings);
  const settingsDialog = useSettingsDialog();
  const updates = useUpdates();

  // The build reading is the updater's, and it is deliberately shared: the two
  // features ask the same question — is this a released build, and which one —
  // and a second `studio_build` invoke would let them answer it differently.
  useCrashReporting({
    consent: preferences.crashReports,
    environment: updates.environment,
    isHydrated: settings !== null,
    version: updates.version,
  });

  const panes = usePanes(
    settings,
    workspace.projects.length > 0,
    workspace.isLoadingProjects
  );

  const { createProject } = workspace;
  const { showPane } = panes;
  const createAndShow = useCallback(
    async (draft: ProjectDraft, format: VideoFormat) => {
      const project = await createProject(draft, format);
      if (project !== null) {
        showPane("videos");
      }
      return project;
    },
    [createProject, showPane]
  );

  const newProject = useNewProject(createAndShow);

  const { addVideo } = workspace;
  const addAndShow = useCallback(
    async (name: string, format: VideoFormat) => {
      const video = await addVideo(name, format);
      if (video !== null) {
        showPane("videos");
      }
      return video;
    },
    [addVideo, showPane]
  );

  const newVideo = useNewVideo(addAndShow);
  const library = useLibrary(workspace.hasRunningTurns);

  const previewProjectId = previewTarget(workspace);
  const preview = usePreview(
    previewProjectId,
    workspace.openedVideo?.compositionId ?? null
  );

  useReconciledVideos(preview, previewProjectId, workspace.reconcile);

  const turn = useOpenTurn({
    changeMode: workspace.changeSessionMode,
    draftId: workspace.draftId,
    effort: effort.claudeEffort,
    models: model.models,
    playing: playingFrame(preview.composition, preview.frame),
    projectId: workspace.activeProject?.id ?? null,
    session: workspace.openedSession,
    turns: workspace,
    videoId: workspace.openedVideo?.id ?? null,
  });

  const opened = workspace.openedProject;

  const composer = useComposer({
    onEscape: turn.isRunning ? turn.stop : undefined,
    onSubmit: turn.send,
    projectId: opened?.id ?? null,
  });

  const queue = useQueue(turn, composer);

  const tools = useTools({
    composer,
    isMissing: opened?.missing ?? false,
    isShown: panes.isPreviewShown,
    isWaiting: turn.permission !== null || turn.source !== null,
    openedProjectId: opened?.id ?? null,
    preview,
    previewProjectId,
  });

  const environment = useEnvironment(
    opened === null || opened.missing ? null : opened.id,
    previewProjectId === opened?.id ? tools.preview.pick : null,
    turn.provider
  );

  const drops = useFileDrops({
    drop: composer.drop,
    isComposerOpen:
      opened !== null &&
      !opened.missing &&
      !environment.isBlocking &&
      turn.permission === null &&
      turn.source === null,
    paneView: panes.paneView,
    save: library.save,
    showPane,
  });

  const studio = useMemo(
    () => ({
      ...workspace,
      ...model,
      ...effort,
      ...panes,
      accounts,
      composer,
      drops,
      environment,
      library,
      newProject,
      newVideo,
      preferences,
      queue,
      settings,
      settingsDialog,
      tools,
      turn,
      updates,
    }),
    [
      accounts,
      composer,
      drops,
      effort,
      environment,
      library,
      model,
      newProject,
      newVideo,
      panes,
      preferences,
      queue,
      settings,
      settingsDialog,
      tools,
      turn,
      updates,
      workspace,
    ]
  );

  if (!workspace.isReady) {
    return <div className="h-full bg-background" data-tauri-drag-region />;
  }

  return <StudioContext value={studio}>{children}</StudioContext>;
}

function playingFrame(
  composition: string | null,
  frame: number
): PromptFrame | null {
  return composition === null ? null : { composition, frame };
}

function previewTarget(workspace: Workspace): string | null {
  const project = workspace.activeProject;

  return project === null ||
    project.missing ||
    workspace.scaffolds.has(project.id)
    ? null
    : project.id;
}
