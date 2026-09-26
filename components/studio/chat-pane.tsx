"use client";

import { PanelLeftOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAssetOffer } from "@/hooks/use-asset-offer";
import type { Docs } from "@/hooks/use-docs";
import { useEntrance } from "@/hooks/use-entrance";
import type { Environment } from "@/hooks/use-environment";
import type { Library } from "@/hooks/use-library";
import { useLocateProject } from "@/hooks/use-locate-project";
import type { NewProject } from "@/hooks/use-new-project";
import type { NewVideo } from "@/hooks/use-new-video";
import { useNow } from "@/hooks/use-now";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { Queue } from "@/hooks/use-queue";
import { documentsByStage } from "@/lib/studio/documents";
import type { StudioSettings } from "@/lib/studio/settings";
import { currentTasks } from "@/lib/studio/tasks";
import { cn } from "@/lib/utils";
import type { HistorySession, Project } from "@/shared/ipc";
import { AssetOfferCard } from "./asset-offer-card";
import { AssetSourceCard } from "./asset-source-card";
import { ChatResult } from "./chat-result";
import { Composer } from "./composer";
import { DockStack } from "./dock";
import { EnvironmentChecklist } from "./environment-checklist";
import { FailureText } from "./failure-text";
import { LogoMark } from "./logo-mark";
import { MarkdownProvider } from "./markdown";
import { NewProjectWizard } from "./new-project-wizard";
import { NewVideoWizard } from "./new-video-wizard";
import { AboveComposer, NoticeCard } from "./notice-card";
import { Pane, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { PermissionCard } from "./permission-card";
import { QueueDock } from "./queue-dock";
import { SoundPrompt } from "./sound-prompt";
import { Startup } from "./startup";
import { StartupBackdrop } from "./startup-backdrop";
import { useStudio } from "./studio-provider";
import { TaskDock } from "./task-dock";
import { TemplateList } from "./template-list";
import { Transcript } from "./transcript";
import { WriteFailureCard } from "./write-failure-card";

const PLACEHOLDERS = ["one", "two", "three"];
const TICK = "1 second";

export function ChatPane() {
  const {
    activeSession,
    docs,
    environment,
    isPreviewShown,
    isLoadingProjects,
    isProjectsShown,
    library,
    listError,
    newProject,
    newVideo,
    openedProject,
    openFolder,
    preferences,
    queue,
    relocateProject,
    reloadProjects,
    settings,
    toggleProjects,
    turn,
  } = useStudio();
  const { locate } = useLocateProject(
    openedProject?.id ?? null,
    relocateProject
  );

  return (
    <Pane>
      <PaneHeader
        className={cn(
          "transition-[padding] duration-base ease-out motion-reduce:transition-none",
          isProjectsShown ? undefined : "pl-(--titlebar-inline-inset)"
        )}
        data-tauri-drag-region
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-1",
            !isPreviewShown && "pr-28"
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center overflow-hidden transition-[width,margin,opacity,scale] duration-base ease-out motion-reduce:transition-none",
              isProjectsShown
                ? "-mr-1 w-0 scale-75 opacity-0"
                : "mr-0 w-8 scale-100 opacity-100 sm:w-7"
            )}
            inert={isProjectsShown}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Show the project list"
                    className="shrink-0 text-muted-foreground"
                    onClick={toggleProjects}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <PanelLeftOpenIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Show the project list
              </TooltipContent>
            </Tooltip>
          </div>
          <PaneTitle>{titleOf(openedProject, activeSession)}</PaneTitle>
        </div>
      </PaneHeader>

      {turn.isLoadingTranscript ? (
        <LoadingTranscript />
      ) : (
        <Conversation
          cwd={openedProject?.path ?? null}
          docs={docs}
          environment={environment}
          hasProject={openedProject !== null}
          isLoadingProjects={isLoadingProjects}
          library={library}
          listError={listError}
          missing={openedProject?.missing ?? false}
          newProject={newProject}
          newVideo={newVideo}
          offersEnabled={preferences.assetOffers}
          onLocate={locate}
          onOpenFolder={openFolder}
          onRetryProjects={reloadProjects}
          projectName={openedProject?.name ?? null}
          queue={queue}
          settings={settings}
          turn={turn}
        />
      )}
    </Pane>
  );
}

function titleOf(
  project: Project | null,
  session: HistorySession | null
): string {
  if (project === null) {
    return "Chat";
  }
  return session?.title ?? "New chat";
}

function LoadingTranscript() {
  return (
    <PaneBody>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6">
        {PLACEHOLDERS.map((placeholder) => (
          <Skeleton className="h-16 w-full rounded-xl" key={placeholder} />
        ))}
      </div>
    </PaneBody>
  );
}

function Conversation({
  cwd,
  docs,
  environment,
  hasProject,
  isLoadingProjects,
  library,
  listError,
  missing,
  newProject,
  newVideo,
  offersEnabled,
  onLocate,
  onOpenFolder,
  onRetryProjects,
  projectName,
  queue,
  settings,
  turn,
}: {
  cwd: string | null;
  docs: Docs;
  environment: Environment;
  hasProject: boolean;
  isLoadingProjects: boolean;
  library: Library;
  listError: string | null;
  missing: boolean;
  newProject: NewProject;
  newVideo: NewVideo;
  offersEnabled: boolean;
  onLocate: () => void;
  onOpenFolder: () => void;
  onRetryProjects: () => void;
  projectName: string | null;
  queue: Queue;
  settings: StudioSettings | null;
  turn: OpenTurn;
}) {
  const hasTranscript = turn.entries.length > 0 || turn.turnError !== null;
  const isCreating = newProject.isOpen || newVideo.isOpen;
  const isListFailed = !hasProject && listError !== null;
  const isStartup = !(
    isLoadingProjects ||
    hasProject ||
    hasTranscript ||
    isListFailed
  );
  const composerDisabled = [!hasProject, missing, environment.isBlocking].some(
    Boolean
  );
  const now = useNow(turn.isRunning ? TICK : null);
  const offer = useAssetOffer({
    enabled: offersEnabled,
    entries: turn.entries,
    isRunning: turn.isRunning,
    save: library.save,
  });

  return (
    // `isolate` keeps the backdrop's negative z-index inside the pane; without
    // a stacking context here it would sink behind the pane itself.
    <PaneBody className="relative isolate">
      {/* The shader is decoration on the two screens that replace the
          conversation, and nothing else, so it reads the same flags those
          screens do rather than a condition of its own that could drift into
          rendering behind a transcript. */}
      {isStartup || isCreating ? <StartupBackdrop /> : null}

      <MarkdownProvider>
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport
              aria-label={isCreating ? "New video" : "Conversation"}
            >
              <MessageScrollerContent
                className="mx-auto w-full max-w-2xl gap-3 px-4 py-4"
                data-selectable
              >
                <ConversationBody
                  cwd={cwd}
                  hasProject={hasProject}
                  hasTranscript={hasTranscript}
                  isLoadingProjects={isLoadingProjects}
                  listError={isListFailed ? listError : null}
                  newProject={newProject}
                  newVideo={newVideo}
                  now={now}
                  onOpenFolder={onOpenFolder}
                  onRetryProjects={onRetryProjects}
                  projectName={projectName}
                  turn={turn}
                />
                {isCreating ? null : (
                  <>
                    <ChatResult key={turn.openId} />
                    <AssetOfferCard offer={offer} />
                    <SoundPrompt disabled={composerDisabled} />
                  </>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </MarkdownProvider>

      {isCreating ? null : (
        <>
          <section
            aria-label="Action required"
            className="max-h-[min(35%,18rem)] shrink-0 overflow-y-auto"
          >
            {turn.permission === null ? null : (
              <AboveComposer>
                <PermissionCard
                  cwd={cwd}
                  key={turn.permission.id}
                  onAnswer={turn.answer}
                  permission={turn.permission}
                />
              </AboveComposer>
            )}
            {missing ? (
              <AboveComposer>
                <NoticeCard className="flex-row items-center justify-between gap-3">
                  <p className="min-w-0 break-all text-muted-foreground text-xs">
                    {cwd} is not on disk anymore.
                  </p>
                  <Button onClick={onLocate} size="sm" variant="outline">
                    Locate…
                  </Button>
                </NoticeCard>
              </AboveComposer>
            ) : null}

            <EnvironmentChecklist environment={environment} />

            {turn.source === null ? null : (
              <AboveComposer>
                <AssetSourceCard
                  key={turn.source.id}
                  onAnswer={turn.answerSource}
                  source={turn.source}
                />
              </AboveComposer>
            )}

            {turn.writes.card === null ? null : (
              <AboveComposer>
                <WriteFailureCard
                  failure={turn.writes.card}
                  onAnswer={turn.writes.answer}
                />
              </AboveComposer>
            )}
          </section>

          {/* Both drawers sit on top of the composer, collapsed to one line
              each and opening upwards. The plan reads the same `currentTasks`
              the transcript and the projects pane read, so the three cannot
              disagree about what the plan is; the queue sits under it, against
              the composer, because it is the composer's own outbox and a
              message you just queued must land where you were typing. */}
          <DockStack>
            <TaskDock
              documents={documentsByStage(docs.tabs)}
              onOpenDocument={docs.onReveal}
              settings={settings}
              stages={turn.stages}
              tasks={currentTasks(turn.entries)}
            />
            <QueueDock queue={queue} />
          </DockStack>

          <Composer
            canPickProvider={turn.canPickProvider}
            context={turn.context}
            cwd={cwd}
            disabled={composerDisabled}
            isRunning={turn.isRunning}
            isWaiting={Boolean(turn.permission ?? turn.source)}
            mode={turn.mode}
            onModeChange={turn.onModeChange}
            onProviderChange={turn.onProviderChange}
            onStop={turn.stop}
            provider={turn.provider}
            writesBlocked={turn.writesBlocked}
          />
        </>
      )}
    </PaneBody>
  );
}

function ConversationBody({
  cwd,
  hasProject,
  hasTranscript,
  isLoadingProjects,
  listError,
  newProject,
  newVideo,
  now,
  onOpenFolder,
  onRetryProjects,
  projectName,
  turn,
}: {
  cwd: string | null;
  hasProject: boolean;
  hasTranscript: boolean;
  isLoadingProjects: boolean;
  listError: string | null;
  newProject: NewProject;
  newVideo: NewVideo;
  now: number;
  onOpenFolder: () => void;
  onRetryProjects: () => void;
  projectName: string | null;
  turn: OpenTurn;
}) {
  const entrance = useEntrance(newProject.isOpen || newVideo.isOpen);

  if (newProject.isOpen) {
    return <NewProjectWizard control={newProject} entrance={entrance} />;
  }

  if (newVideo.isOpen) {
    return (
      <NewVideoWizard
        control={newVideo}
        entrance={entrance}
        project={projectName}
      />
    );
  }

  if (hasTranscript) {
    return (
      <Transcript
        cwd={cwd}
        entries={turn.entries}
        error={turn.turnError}
        isRunning={turn.isRunning}
        isWaiting={Boolean(turn.permission ?? turn.source)}
        live={turn.live}
        now={now}
        startedAt={turn.startedAt}
        workedMs={turn.workedMs}
      />
    );
  }

  if (isLoadingProjects) {
    return null;
  }

  // A list that failed is not a list that is empty. Onboarding here told a
  // returning person their projects were gone — and offered New Project,
  // which would have failed the same way with nothing connecting the two.
  if (listError !== null) {
    return <ProjectsFailed message={listError} onRetry={onRetryProjects} />;
  }

  return (
    <ChatEmptyState
      entrance={entrance}
      hasProject={hasProject}
      onNewProject={newProject.open}
      onOpenFolder={onOpenFolder}
    />
  );
}

function ProjectsFailed({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Empty className="items-start border-none text-left">
      <EmptyHeader className="max-w-none items-start text-left">
        <EmptyTitle className="text-balance text-2xl">
          The project list could not be read
        </EmptyTitle>
        <EmptyDescription>
          <FailureText
            fallback="Something went wrong while reading it."
            role="alert"
            text={message}
          />
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="items-start">
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function ChatEmptyState({
  entrance,
  hasProject,
  onNewProject,
  onOpenFolder,
}: {
  entrance: string | null;
  hasProject: boolean;
  onNewProject: () => void;
  onOpenFolder: () => void;
}) {
  const { composer } = useStudio();

  if (!hasProject) {
    return (
      <Startup
        entrance={entrance}
        onNewProject={onNewProject}
        onOpenFolder={onOpenFolder}
      />
    );
  }

  return (
    <Empty className="items-start border-none text-left">
      <EmptyHeader className="max-w-none items-start text-left">
        <EmptyMedia>
          <LogoMark className="size-8 text-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-balance text-2xl">
          What should we make?
        </EmptyTitle>
        {/* The panes are resizable, so this block is the app's only prose
            that reflows to arbitrary widths — `pretty` is what keeps a lone
            word off the last line as the divider moves. */}
        <EmptyDescription className="text-pretty">
          Describe the video you want to create, or what you want to change.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-full items-start">
        <TemplateList className="-mx-3 w-auto" onPick={composer.fill} />
      </EmptyContent>
    </Empty>
  );
}
