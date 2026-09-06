"use client";

import { createContext, use, useCallback, useMemo } from "react";
import { type Account, useAccount } from "@/hooks/use-account";
import { useAppMenu } from "@/hooks/use-app-menu";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { type Composer, useComposer } from "@/hooks/use-composer";
import { useCrashReporting } from "@/hooks/use-crash-reporting";
import { type Docs, useDocs } from "@/hooks/use-docs";
import { type Environment, useEnvironment } from "@/hooks/use-environment";
import { type Feedback, useFeedback } from "@/hooks/use-feedback";
import { type FileDrops, useFileDrops } from "@/hooks/use-file-drops";
import { useHydratedSettings } from "@/hooks/use-hydrated-settings";
import { type Library, useLibrary } from "@/hooks/use-library";
import { type StudioModels, useModels } from "@/hooks/use-models";
import { type NewProject, useNewProject } from "@/hooks/use-new-project";
import { type NewVideo, useNewVideo } from "@/hooks/use-new-video";
import { type OpenTurn, useOpenTurn } from "@/hooks/use-open-turn";
import { type Panes, usePanes } from "@/hooks/use-panes";
import { type Preferences, usePreferences } from "@/hooks/use-preferences";
import { usePlayingFrame, usePreview } from "@/hooks/use-preview";
import { useProjectMenu } from "@/hooks/use-project-menu";
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
import { useSidecarStatus } from "@/hooks/use-sidecar-status";
import { type Tools, useTools } from "@/hooks/use-tools";
import { type Tours, useTours } from "@/hooks/use-tours";
import { type TrialCardState, useTrialCard } from "@/hooks/use-trial-card";
import { type Updates, useUpdates } from "@/hooks/use-updates";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";
import type { AppMenuModel } from "@/lib/studio/app-menu";
import type { VideoFormat } from "@/lib/studio/formats";
import type { StudioSettings } from "@/lib/studio/settings";
import { currentTasks } from "@/lib/studio/tasks";
import type { TourReveal } from "@/lib/studio/tours";
import type { ProjectDraft } from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import { ProjectDialogs } from "./project-dialogs";

export type Studio = ClaudeEffort &
  StudioModels &
  Panes &
  Workspace & {
    account: Account;
    accounts: Accounts;
    composer: Composer;
    docs: Docs;
    drops: FileDrops;
    environment: Environment;
    feedback: Feedback;
    library: Library;
    newProject: NewProject;
    newVideo: NewVideo;
    preferences: Preferences;
    queue: Queue;
    settings: StudioSettings | null;
    settingsDialog: SettingsDialog;
    tools: Tools;
    tours: Tours;
    trialCard: TrialCardState;
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

export function StudioProvider({
  children,
  settings,
  workspace,
}: {
  children: React.ReactNode;
  settings?: StudioSettings | null;
  workspace?: Workspace;
}) {
  if (workspace === undefined) {
    return <HydratedStudioProvider>{children}</HydratedStudioProvider>;
  }

  return (
    <StudioStateProvider settings={settings ?? null} workspace={workspace}>
      {children}
    </StudioStateProvider>
  );
}

function HydratedStudioProvider({ children }: { children: React.ReactNode }) {
  const settings = useHydratedSettings();
  const workspace = useWorkspace(settings);

  return (
    <StudioStateProvider settings={settings} workspace={workspace}>
      {children}
    </StudioStateProvider>
  );
}

function StudioStateProvider({
  children,
  settings,
  workspace,
}: {
  children: React.ReactNode;
  settings: StudioSettings | null;
  workspace: Workspace;
}) {
  const model = useModels(settings);
  const account = useAccount();
  const trialCard = useTrialCard({ account, settings });
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

  const {
    activeProject,
    openFolder,
    projects,
    relocateProject,
    removeProject,
    renameProject,
    selectProject,
  } = workspace;

  const projectCommands = useMemo(
    () => ({ relocateProject, removeProject, renameProject }),
    [relocateProject, removeProject, renameProject]
  );
  const projectMenu = useProjectMenu(activeProject, projectCommands);

  const menuModel = useMemo<AppMenuModel>(
    () => ({
      canCreateVideo: activeProject !== null && !activeProject.missing,
      onLocateProject: projectMenu.locate,
      onNewProject: newProject.open,
      onNewVideo: newVideo.open,
      onOpenFolder: openFolder,
      onRemoveProject: projectMenu.openRemove,
      onRenameProject: projectMenu.openRename,
      onRevealProject: projectMenu.reveal,
      onSelectProject: selectProject,
      open:
        activeProject === null
          ? null
          : {
              id: activeProject.id,
              isActive: true,
              isMissing: activeProject.missing,
              name: activeProject.name,
            },
      projects: projects.map((row) => ({
        id: row.id,
        isActive: row.id === activeProject?.id,
        isMissing: row.missing,
        name: row.name,
      })),
    }),
    [
      activeProject,
      newProject.open,
      newVideo.open,
      openFolder,
      projectMenu.locate,
      projectMenu.openRemove,
      projectMenu.openRename,
      projectMenu.reveal,
      projects,
      selectProject,
    ]
  );
  useAppMenu(menuModel);

  const library = useLibrary(workspace.hasRunningTurns);

  // The preview follows the sidecar: its request is long-lived, so a crash
  // fails it and nothing else would bring it back. Only the phase is taken, and
  // it stays out of the context value — putting the whole `Sidecar` in there
  // changed the value's identity on every status event and re-rendered every
  // consumer of the studio for a reading only this one hook wants.
  const sidecarPhase = useSidecarStatus()?.phase ?? "unknown";

  const previewProjectId = previewTarget(workspace);
  const preview = usePreview(
    previewProjectId,
    workspace.openedVideo?.compositionId ?? null,
    sidecarPhase
  );

  useReconciledVideos(preview, previewProjectId, workspace.reconcile);

  const playing = usePlayingFrame(preview);

  const turn = useOpenTurn({
    changeMode: workspace.changeSessionMode,
    draftId: workspace.draftId,
    effort: effort.claudeEffort,
    models: model.models,
    playing,
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

  // The documents are the open chat's video's, which is what makes the pane's
  // two modes agree with everything else about which video is on screen.
  const docs = useDocs({
    entries: turn.entries,
    isTurnRunning: workspace.hasRunningTurns,
    projectId: opened?.id ?? null,
    videoId: workspace.openedVideo?.id ?? null,
  });

  const tools = useTools({
    composer,
    isDocs: docs.mode === "docs",
    isMissing: opened?.missing ?? false,
    isShown: panes.isPreviewShown,
    isWaiting: turn.permission !== null || turn.source !== null,
    onArm: trialCard.reopen,
    openedProjectId: opened?.id ?? null,
    preview,
    previewProjectId,
  });

  const environment = useEnvironment(
    opened === null || opened.missing ? null : opened.id,
    previewProjectId === opened?.id ? tools.preview.pick : null,
    turn.provider
  );

  const feedback = useFeedback({
    environment: updates.environment,
    os: updates.os,
    provider: PROVIDER_INFO[turn.provider].name,
    version: updates.version,
  });

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

  // The tips are told what is on screen, not who is on screen: every field is
  // a state the studio already keeps, so the catalog's conditions stay a pure
  // function over them.
  const onReveal = useCallback(
    (reveal: TourReveal) => {
      if (reveal === "assets" || reveal === "components") {
        showPane(reveal);
      }
    },
    [showPane]
  );

  const tours = useTours({
    onReveal,
    settings,
    stage: {
      hasMedia:
        composer.attachments.items.length > 0 ||
        composer.media.items.length > 0,
      hasPlan: currentTasks(turn.entries).length > 0,
      hasPreviewTools: tools.inspect.canInspect,
      hasProject: opened !== null && !opened.missing,
      isBlocked:
        turn.permission !== null ||
        turn.source !== null ||
        environment.isBlocking ||
        newProject.isOpen ||
        newVideo.isOpen ||
        settingsDialog.isOpen ||
        trialCard.card !== null,
      isPaneShown: panes.isProjectsShown,

      isRunning: workspace.hasRunningTurns,
    },
  });

  const studio = useMemo(
    () => ({
      ...workspace,
      ...model,
      ...effort,
      ...panes,
      account,
      accounts,
      composer,
      docs,
      drops,
      environment,
      feedback,
      library,
      newProject,
      newVideo,
      preferences,
      queue,
      settings,
      settingsDialog,
      tools,
      tours,
      trialCard,
      turn,
      updates,
    }),
    [
      account,
      accounts,
      composer,
      docs,
      drops,
      effort,
      environment,
      feedback,
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
      tours,
      trialCard,
      turn,
      updates,
      workspace,
    ]
  );

  if (!workspace.isReady) {
    return null;
  }

  return (
    <StudioContext value={studio}>
      {children}
      <ProjectDialogs menu={projectMenu} project={activeProject} />
    </StudioContext>
  );
}

function previewTarget(workspace: Workspace): string | null {
  const project = workspace.activeProject;

  return project === null ||
    project.missing ||
    workspace.scaffolds.has(project.id)
    ? null
    : project.id;
}
