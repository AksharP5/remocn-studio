"use client";

import { createContext, use, useCallback, useMemo } from "react";
import { type Account, useAccount } from "@/hooks/use-account";
import { useAppMenu } from "@/hooks/use-app-menu";
import { type ClaudeEffort, useClaudeEffort } from "@/hooks/use-claude-effort";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useCommands } from "@/hooks/use-commands";
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
import {
  type NotificationConsent,
  useNotificationConsent,
} from "@/hooks/use-notification-consent";
import { type Onboarding, useOnboarding } from "@/hooks/use-onboarding";
import { type OpenTurn, useOpenTurn } from "@/hooks/use-open-turn";
import { type Panes, usePanes } from "@/hooks/use-panes";
import {
  type PlanHandle,
  useFollowPlanTier,
  usePlanTier,
} from "@/hooks/use-plan-tier";
import { type Preferences, usePreferences } from "@/hooks/use-preferences";
import { usePlayingFrame, usePreview } from "@/hooks/use-preview";
import { usePreviewPresentation } from "./preview-presentation";
import { useProjectMenu } from "@/hooks/use-project-menu";
import {
  type Accounts,
  useProviderAccounts,
} from "@/hooks/use-provider-accounts";
import { type Queue, useQueue } from "@/hooks/use-queue";
import { useReconciledVideos } from "@/hooks/use-reconciled-videos";
import { type SettingsView, useSettingsView } from "@/hooks/use-settings-view";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useSidecar } from "@/hooks/use-sidecar";
import { useSidecarStatus } from "@/hooks/use-sidecar-status";
import { useStudioAttention } from "@/hooks/use-studio-attention";
import { useTemplateLinks } from "@/hooks/use-template-links";
import {
  PRO_ONLY,
  PRO_ONLY_UPGRADE,
  type Tools,
  useTools,
} from "@/hooks/use-tools";
import { type TrialCardState, useTrialCard } from "@/hooks/use-trial-card";
import { type Updates, useUpdates } from "@/hooks/use-updates";
import { useWorkspace, type Workspace } from "@/hooks/use-workspace";
import type { VideoFormat } from "@/lib/studio/formats";
import type { StudioSettings } from "@/lib/studio/settings";
import type { PlanTier } from "@/shared/entitlement";
import type { ProjectDraft } from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import { CommandPalette } from "./command-palette";
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
    notifications: NotificationConsent;
    preferences: Preferences;
    queue: Queue;
    settings: StudioSettings | null;
    settingsView: SettingsView;
    tools: Tools;
    onboarding: Onboarding;
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
  plan,
  settings,
  workspace,
}: {
  children: React.ReactNode;
  plan?: PlanHandle;
  settings?: StudioSettings | null;
  workspace?: Workspace;
}) {
  if (workspace === undefined) {
    return <HydratedStudioProvider>{children}</HydratedStudioProvider>;
  }

  return (
    <StudioStateProvider
      plan={plan ?? null}
      settings={settings ?? null}
      workspace={workspace}
    >
      {children}
    </StudioStateProvider>
  );
}

function HydratedStudioProvider({ children }: { children: React.ReactNode }) {
  const settings = useHydratedSettings();
  const plan = usePlanTier();
  const workspace = useWorkspace(settings, plan.read);

  return (
    <StudioStateProvider plan={plan} settings={settings} workspace={workspace}>
      {children}
    </StudioStateProvider>
  );
}

function StudioStateProvider({
  children,
  plan,
  settings,
  workspace,
}: {
  children: React.ReactNode;
  plan: PlanHandle | null;
  settings: StudioSettings | null;
  workspace: Workspace;
}) {
  const model = useModels(settings);
  const account = useAccount();
  useFollowPlanTier(plan, account.tier);
  const trialCard = useTrialCard({ account, settings });
  const accounts = useProviderAccounts();
  const effort = useClaudeEffort(settings);
  const preferences = usePreferences(settings);
  const notifications = useNotificationConsent(settings);
  const settingsView = useSettingsView(workspace.activeProject?.id ?? null);
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

  const { openTemplate } = workspace;
  const showVideos = useCallback(() => showPane("videos"), [showPane]);
  useTemplateLinks({ onOpened: showVideos, openTemplate });

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

  const openProjectSettings = useCallback(() => {
    if (activeProject !== null) {
      settingsView.openProject(activeProject.id);
    }
  }, [activeProject, settingsView.openProject]);

  const library = useLibrary(workspace.hasRunningTurns);

  // The preview follows the sidecar: its request is long-lived, so a crash
  // fails it and nothing else would bring it back. Only the phase is taken, and
  // it stays out of the context value — putting the whole `Sidecar` in there
  // changed the value's identity on every status event and re-rendered every
  // consumer of the studio for a reading only this one hook wants.
  const sidecarPhase = useSidecarStatus()?.phase ?? "unknown";

  const previewProjectId = previewTarget(workspace);
  const previewPresentation = usePreviewPresentation();
  const preview = usePreview(
    previewProjectId,
    workspace.openedVideo?.compositionId ?? null,
    sidecarPhase,
    workspace.projects.find((project) => project.id === previewProjectId)?.path,
    previewPresentation
  );

  useReconciledVideos(preview, previewProjectId, workspace.reconcile);

  const playing = usePlayingFrame(preview);

  const turn = useOpenTurn({
    changeMode: workspace.changeSessionMode,
    draftId: workspace.draftId,
    effort: effort.claudeEffort,
    models: model.models,
    plan: planReaderOf(plan),
    playing,
    projectId: workspace.activeProject?.id ?? null,
    session: workspace.openedSession,
    turns: workspace,
    videoId: workspace.openedVideo?.id ?? null,
  });

  const opened = workspace.openedProject;
  const openedId = opened?.id ?? null;
  const openedMissing = opened?.missing ?? false;
  const openedVideoId = workspace.openedVideo?.id ?? null;
  const openedSessionId = workspace.openedSession?.id ?? null;

  const composer = useComposer({
    onEscape: turn.isRunning ? turn.stop : undefined,
    onSubmit: turn.send,
    projectId: openedId,
  });

  const queue = useQueue(turn, composer);

  // The documents are the open chat's video's, which is what makes the pane's
  // two modes agree with everything else about which video is on screen.
  const docs = useDocs({
    entries: turn.entries,
    isTurnRunning: workspace.hasRunningTurns,
    projectId: openedId,
    videoId: openedVideoId,
  });

  const tools = useTools({
    composer,
    isDocs: docs.mode === "docs",
    isLocked: trialCard.isOnFree,
    isMissing: openedMissing,
    isShown: panes.isPreviewShown,
    isWaiting: turn.permission !== null || turn.source !== null,
    lockedReason:
      account.phase.kind === "signedIn" ? PRO_ONLY_UPGRADE : PRO_ONLY,
    onArm: trialCard.reopen,
    openedProjectId: openedId,
    preview,
    previewProjectId,
    projectPath: workspace.projects.find(
      (project) => project.id === previewProjectId
    )?.path,
    // The pane reads the code of the project the *chat* is in, which is the
    // same one the preview is showing whenever the tools are available at all.
    writeProjectId: openedId,
  });

  const sidecar = useSidecar();

  const baseCommands = useCommands({
    canCreateVideo: activeProject !== null && !activeProject.missing,
    docsMode: docs.mode,
    exportUnavailable: tools.exporting.unavailable,
    groups: workspace.groups,
    inspectUnavailable: tools.inspect.unavailable,
    isPreviewShown: panes.isPreviewShown,
    isProjectsShown: panes.isProjectsShown,
    isTurnRunning: turn.isRunning,
    locateProject: projectMenu.locate,
    openExport: tools.exporting.open,
    openedSessionId,
    openedVideoId,
    openFolder,
    openNewProject: newProject.open,
    openNewVideo: newVideo.open,
    openProject: activeProject,
    openProjectSettings,
    openRemoveProject: projectMenu.openRemove,
    openRenameProject: projectMenu.openRename,
    openSettings: settingsView.open,
    openVideo: workspace.openVideo,
    paneView: panes.paneView,
    pickDocsMode: docs.pickMode,
    projects,
    restartSidecar: sidecar.restart,
    revealProject: projectMenu.reveal,
    selectProject,
    selectSession: workspace.selectSession,
    showPane,
    snapshotUnavailable: tools.snapshot.unavailable,
    stopTurn: turn.stop,
    toggleInspect: tools.inspect.toggle,
    togglePreview: panes.togglePreview,
    toggleProjects: panes.toggleProjects,
    toggleSnapshot: tools.snapshot.toggle,
  });
  const palette = useCommandPalette(baseCommands, openedSessionId);
  const isMenuInstalled = useAppMenu(palette.commands);
  useShortcuts(palette.commands, isMenuInstalled);

  useStudioAttention({
    exportState: tools.exporting.state,
    isEnabled: notifications.isOn,
    isEventEnabled: notifications.isEventEnabled,
    sessions: workspace.sessions,
    sidecarPhase,
    turns: workspace.turns,
    videos: workspace.videos,
  });

  const environment = useEnvironment(
    openedMissing ? null : openedId,
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
    enabled: !settingsView.isOpen,
    isComposerOpen:
      openedId !== null &&
      !openedMissing &&
      !environment.isBlocking &&
      turn.permission === null &&
      turn.source === null,
    paneView: panes.paneView,
    save: library.save,
    showPane,
  });

  const onboarding = useOnboarding({
    blocked:
      turn.permission !== null ||
      turn.source !== null ||
      environment.isBlocking ||
      environment.isChecking ||
      environment.isInstalling ||
      environment.isInstallingNode ||
      environment.isUpgrading ||
      environment.error !== null ||
      newProject.isOpen ||
      newVideo.isOpen ||
      trialCard.card !== null,
    hasProject:
      openedId !== null &&
      !openedMissing &&
      previewTarget(workspace) !== null &&
      environment.checks.length > 0,
    isRunning: workspace.hasRunningTurns,
    isSettingsOpen: settingsView.isOpen,
    settings,
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
      notifications,
      onboarding,
      preferences,
      queue,
      settings,
      settingsView,
      tools,
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
      notifications,
      panes,
      preferences,
      queue,
      settings,
      settingsView,
      tools,
      onboarding,
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
      <CommandPalette palette={palette} />
    </StudioContext>
  );
}

function planReaderOf(plan: PlanHandle | null): (() => PlanTier) | undefined {
  return plan === null ? undefined : plan.read;
}

function previewTarget(workspace: Workspace): string | null {
  const project = workspace.activeProject;

  return project === null ||
    project.missing ||
    workspace.scaffolds.has(project.id)
    ? null
    : project.id;
}
