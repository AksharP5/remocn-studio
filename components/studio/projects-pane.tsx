"use client";

import {
  ClapperboardIcon,
  ComponentIcon,
  LibraryBigIcon,
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { stockKindOf, useAssetsScope } from "@/hooks/use-assets-scope";

import { useNow } from "@/hooks/use-now";
import { usePickAsset } from "@/hooks/use-pick-asset";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import type { VideoCommands } from "@/hooks/use-video-menu";
import { type PaneGroup, paneSections } from "@/lib/studio/groups";
import { isPaneView, type PaneView } from "@/lib/studio/pane-view";
import { runningTime } from "@/lib/studio/time";
import { cn } from "@/lib/utils";
import { isMediaAsset } from "@/shared/library";
import { AssetsPane } from "./assets-pane";
import { AssetsScopeSwitch } from "./assets-scope";
import { ComponentsPane } from "./components-pane";
import { FailureDetails, FailureText } from "./failure-text";
import { LogoWordmark } from "./logo-mark";
import { PaneScreen } from "./pane-screen";
import { StockPane } from "./stock-pane";
import { useStudio } from "./studio-provider";
import { VideoGroup } from "./video-group";

const PLACEHOLDERS = ["one", "two", "three", "four"];

const VIEW_ITEMS: readonly {
  icon: typeof ComponentIcon;
  label: string;
  view: PaneView;
}[] = [
  {
    icon: ClapperboardIcon,
    label: "Videos",
    view: "videos",
  },
  { icon: LibraryBigIcon, label: "Assets", view: "assets" },
  {
    icon: ComponentIcon,
    label: "Components",
    view: "components",
  },
];

export function ProjectsPane() {
  const {
    actionError,
    activeProject,
    activeSession,
    composerActions,
    drops,
    expandedVideos,
    feedback,
    folderError,
    groups,
    isLoadingProjects,
    isLoadingVideos,
    library,
    newVideo,
    onNewSession,
    onOpenVideo,
    onCancelScaffold,
    onRemoveSession,
    onRetryScaffold,
    onSelectSession,
    onToggleVideo,
    paneSlide,
    paneView,
    projectsError,
    registerVideo,
    reloadVideos,
    removeVideo,
    renameVideo,
    scaffolds,
    sessionsError,
    settingsView,
    showPane,
    toggleProjects,
    videosError,
  } = useStudio();

  const now = useNow();
  const paneError = actionError ?? folderError;
  const videoCommands: VideoCommands = useMemo(
    () => ({ registerVideo, removeVideo, renameVideo }),
    [registerVideo, removeVideo, renameVideo]
  );
  const pickable = useMemo(
    () => [...library.assets, ...library.bundled],
    [library.assets, library.bundled]
  );
  const onPickAsset = usePickAsset(pickable, composerActions.pick);
  const assetsScope = useAssetsScope();
  const stockKind = stockKindOf(assetsScope.scope);

  const media = useMemo(
    () => library.assets.filter((asset) => isMediaAsset(asset.type)),
    [library.assets]
  );
  const components = useMemo(
    () => library.assets.filter((asset) => !isMediaAsset(asset.type)),
    [library.assets]
  );

  // Pinned above the scroller rather than scrolled with the list: the one
  // action that starts a video must not be the first thing a long list takes
  // off screen.
  let content = (
    <PaneScreen
      pinned={
        <NewVideoAction
          isDisabled={activeProject === null || activeProject.missing}
          onNewVideo={newVideo.open}
        />
      }
    >
      <h2 className="sr-only">Videos</h2>
      {activeProject === null ? null : (
        <Scaffolding
          onCancel={onCancelScaffold}
          onRetry={onRetryScaffold}
          projectId={activeProject.id}
          scaffold={scaffolds.get(activeProject.id)}
        />
      )}
      <VideosBody
        activeSessionId={activeSession?.id ?? null}
        commands={videoCommands}
        error={projectsError ?? videosError ?? sessionsError}
        expanded={expandedVideos}
        groups={groups}
        hasProject={activeProject !== null}
        isLoading={isLoadingProjects || isLoadingVideos}
        now={now}
        onNewSession={onNewSession}
        onOpen={onOpenVideo}
        onRemoveSession={onRemoveSession}
        onRetry={reloadVideos}
        onSelectSession={onSelectSession}
        onToggle={onToggleVideo}
      />
    </PaneScreen>
  );

  if (paneView === "assets") {
    content = (
      <>
        <h2 className="sr-only">Assets</h2>
        {/* Above the pane rather than inside it, so the switch sits over the
            search field the pane pins and neither of them scrolls. */}
        <div className="px-2 pt-2">
          <AssetsScopeSwitch scope={assetsScope} />
        </div>
        {stockKind === null ? (
          <AssetsPane
            assets={media}
            error={library.error}
            isLoading={library.isLoading}
            isOver={drops.library.isOver}
            onPick={onPickAsset}
            onRemove={library.onRemove}
            onRetry={library.reload}
          />
        ) : (
          <StockPane kind={stockKind} onSaved={library.refresh} />
        )}
      </>
    );
  }

  if (paneView === "components") {
    content = (
      <>
        <h2 className="sr-only">Components</h2>
        <ComponentsPane
          assets={components}
          bundled={library.bundled}
          error={library.error}
          isLoading={library.isLoading}
          onPick={onPickAsset}
          onRemove={library.onRemove}
          onRetry={library.reload}
        />
      </>
    );
  }

  const footer = (
    <>
      {paneError === null ? null : (
        <p className="shrink-0 break-words px-3 py-2 text-destructive text-xs">
          {paneError}
        </p>
      )}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground"
              onClick={feedback.send}
            >
              <MessageSquareIcon />
              Send feedback
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground"
              onClick={settingsView.open}
            >
              <SettingsIcon />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );

  return (
    // `collapsible="none"` is what makes this a sidebar inside a resizable
    // panel rather than one fixed to the window: it drops the off-canvas gap
    // element and the mobile Sheet, and renders a plain flex column. The
    // provider is still required — every menu part reads its context.
    <SidebarProvider className="h-full min-h-0">
      {/* The shell owns the titlebar band, so the pane must not paint over
          it: the shell's background is already the sidebar colour, and the
          band fades away behind the brand row instead of being cut at the
          pane's top edge. */}
      <Sidebar
        className="w-full bg-transparent"
        collapsible="none"
        ref={drops.library.ref}
      >
        <SidebarHeader className="gap-0 p-0">
          <SidebarBrand onHide={toggleProjects} />
          <PaneViewMenu onShow={showPane} view={paneView} />
        </SidebarHeader>

        {/* The view is one column: what is pinned stays put and only the
            list below it scrolls, so the slide animation belongs to the
            column rather than to the scrolling half of it. */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            paneSlide === "push" && "animate-screen-in",
            paneSlide === "pop" && "animate-screen-back"
          )}
          data-pane-slide
          key={paneView}
        >
          {content}
        </div>

        {footer}
      </Sidebar>
    </SidebarProvider>
  );
}

// The pane's views, as a vertical menu of their own: which of them is on
// screen is app state, not a row among the projects. No indicators ride on
// these items — the titlebar's mood is what says something is waiting.
function PaneViewMenu({
  onShow,
  view,
}: {
  onShow: (view: PaneView) => void;
  view: PaneView;
}) {
  const onSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const picked = event.currentTarget.value;
      if (isPaneView(picked)) {
        onShow(picked);
      }
    },
    [onShow]
  );

  // The active view carries a thin rail at the pane's edge and full-contrast
  // text — no filled background, so the menu reads as chrome rather than a
  // selected row. The weight never changes between states, or the labels
  // would shift as the selection moves.
  // Hover is a soft tint — the accent at 40% with full-contrast text — so
  // pointing at an item answers quietly while the rail stays the only mark
  // of the view that is actually open.
  return (
    <nav aria-label="Library views" className="px-2 pt-6 pb-4">
      <SidebarMenu>
        {VIEW_ITEMS.map((item) => (
          <SidebarMenuItem key={item.view}>
            <SidebarMenuButton
              className="relative pl-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground active:bg-sidebar-accent/40 active:text-sidebar-foreground data-active:bg-transparent data-active:font-normal data-active:text-sidebar-foreground dark:text-muted-foreground"
              isActive={view === item.view}
              onClick={onSelect}
              value={item.view}
            >
              {view === item.view ? (
                <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
              ) : null}
              <item.icon />
              {item.label}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}

// The traffic lights are cleared by the header's top inset, above this row, so
// the wordmark can sit on the same left edge as the group label and the project
// names below it rather than being pushed out of the column.
function SidebarBrand({ onHide }: { onHide: () => void }) {
  return (
    <div
      className="flex h-10 shrink-0 items-center justify-between gap-2 pr-2 pl-4"
      data-tauri-drag-region
    >
      <LogoWordmark className="pointer-events-none shrink-0" />
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Hide the project list"
                className="text-muted-foreground"
                onClick={onHide}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <PanelLeftCloseIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Hide the project list</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
// One primary action, and it is the only place a video is born by hand: the
// first video of a project comes with the project wizard, and a new chat under
// an existing video is a single click on its row.
function NewVideoAction({
  isDisabled,
  onNewVideo,
}: {
  isDisabled: boolean;
  onNewVideo: () => void;
}) {
  return (
    <div className="px-1">
      <Button
        className="w-full"
        disabled={isDisabled}
        onClick={onNewVideo}
        variant="default"
      >
        <PlusIcon data-icon="inline-start" />
        New Video…
      </Button>
    </div>
  );
}

function VideosBody({
  activeSessionId,
  commands,
  error,
  expanded,
  groups,
  hasProject,
  isLoading,
  now,
  onNewSession,
  onOpen,
  onRemoveSession,
  onRetry,
  onSelectSession,
  onToggle,
}: {
  activeSessionId: string | null;
  commands: VideoCommands;
  error: string | null;
  expanded: ReadonlySet<string>;
  groups: readonly PaneGroup[];
  hasProject: boolean;
  isLoading: boolean;
  now: number;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  if (error !== null) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-balance">
            History is unavailable
          </EmptyTitle>
          <EmptyDescription>
            <FailureText
              align="center"
              fallback="Something went wrong while reading the history."
              text={error}
            />
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </Empty>
    );
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        {PLACEHOLDERS.map((placeholder) => (
          <SidebarMenuItem key={placeholder}>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  if (!hasProject) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyTitle className="text-balance">No project open</EmptyTitle>
          <EmptyDescription>
            Create one, or open a folder you already have.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { active, gone } = paneSections(groups);

  const item = (group: PaneGroup) => (
    <VideoGroup
      activeSessionId={activeSessionId}
      commands={commands}
      group={group}
      isExpanded={expanded.has(group.video.id)}
      key={group.video.id}
      now={now}
      onNewSession={onNewSession}
      onOpen={onOpen}
      onRemoveSession={onRemoveSession}
      onSelectSession={onSelectSession}
      onToggle={onToggle}
    />
  );

  return (
    <>
      {active.length === 0 ? null : (
        <SidebarMenu className="gap-1">{active.map(item)}</SidebarMenu>
      )}

      {active.length === 0 && gone.length === 0 ? (
        <p className="px-3 py-2 text-muted-foreground text-xs">
          No videos yet.
        </p>
      ) : null}

      {gone.length === 0 ? null : (
        <>
          <h3
            className="mt-2 flex h-8 shrink-0 items-center px-2 font-medium text-sidebar-foreground/70 text-xs dark:text-muted-foreground"
            title="Nothing in this project renders these anymore. Their chats are still here."
          >
            Not in the code
          </h3>
          <SidebarMenu>{gone.map(item)}</SidebarMenu>
        </>
      )}
    </>
  );
}

const DOING: Record<ScaffoldState["step"], string> = {
  install: "Installing dependencies…",
  template: "Copying the template…",
};

const FAILED: Record<ScaffoldState["step"], string> = {
  install: "Could not install the dependencies.",
  template: "Could not copy the template.",
};

const CANCELLED: Record<ScaffoldState["step"], string> = {
  install: "The install was cancelled.",
  template: "Setting up the project was cancelled.",
};

// Scaffolding belongs to the project, so it reports under the switcher rather
// than on a video: the template and the install are what the whole folder is
// waiting for, not one composition in it.
function Scaffolding({
  onCancel,
  onRetry,
  projectId,
  scaffold,
}: {
  onCancel: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: (event: MouseEvent<HTMLButtonElement>) => void;
  projectId: string;
  scaffold: ScaffoldState | undefined;
}) {
  if (scaffold === undefined) {
    return null;
  }

  if (scaffold.isRunning) {
    return (
      <ScaffoldRunning
        onCancel={onCancel}
        projectId={projectId}
        scaffold={scaffold}
      />
    );
  }

  return (
    <div className="flex animate-fade-in flex-col gap-1.5 px-3 py-1">
      <p
        className={cn(
          "text-xs",
          scaffold.cancelled ? "text-muted-foreground" : "text-destructive"
        )}
        role={scaffold.cancelled ? "status" : "alert"}
      >
        {scaffold.cancelled ? CANCELLED[scaffold.step] : FAILED[scaffold.step]}
      </p>
      {scaffold.error === null ? null : (
        <FailureDetails details={scaffold.error} />
      )}
      <Button
        className="self-start text-xs"
        onClick={onRetry}
        size="sm"
        value={projectId}
        variant="outline"
      >
        Try again
      </Button>
    </div>
  );
}

function ScaffoldRunning({
  onCancel,
  projectId,
  scaffold,
}: {
  onCancel: (event: MouseEvent<HTMLButtonElement>) => void;
  projectId: string;
  scaffold: ScaffoldState;
}) {
  const now = useNow("1 second");

  return (
    <div
      className="flex animate-fade-in items-center gap-2 px-3 py-1 text-muted-foreground text-xs"
      role="status"
    >
      <Spinner className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{DOING[scaffold.step]}</span>
      <span className="shrink-0 tabular-nums">
        {runningTime(scaffold.startedAt, now)}
      </span>
      <Button
        className="-my-1 shrink-0 text-xs"
        onClick={onCancel}
        size="xs"
        value={projectId}
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}
