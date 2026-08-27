"use client";

import {
  ClapperboardIcon,
  ComponentIcon,
  LibraryBigIcon,
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
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
import type { ProjectCommands } from "@/hooks/use-project-menu";
import type { ScaffoldState } from "@/hooks/use-scaffold";
import type { VideoCommands } from "@/hooks/use-video-menu";
import { type PaneGroup, paneSections } from "@/lib/studio/groups";
import { isPaneView, type PaneView } from "@/lib/studio/pane-view";
import type { TourId } from "@/lib/studio/tours";
import { cn } from "@/lib/utils";
import { isMediaAsset } from "@/shared/library";
import { AssetsPane } from "./assets-pane";
import { AssetsScopeSwitch } from "./assets-scope";
import { ComponentsPane } from "./components-pane";
import { LogoWordmark } from "./logo-mark";
import { ProjectSwitcher } from "./project-switcher";
import { StockPane } from "./stock-pane";
import { useStudio } from "./studio-provider";
import { UpdateStatus } from "./update-status";
import { VideoGroup } from "./video-group";

const PLACEHOLDERS = ["one", "two", "three", "four"];

// `tour` names the tip that points at the row — the videos row is where a
// chat running in the background is read, and the assets row is the library.
const VIEW_ITEMS: readonly {
  icon: typeof ComponentIcon;
  label: string;
  tour?: TourId;
  view: PaneView;
}[] = [
  {
    icon: ClapperboardIcon,
    label: "Videos",
    tour: "sessions",
    view: "videos",
  },
  { icon: LibraryBigIcon, label: "Assets", tour: "library", view: "assets" },
  { icon: ComponentIcon, label: "Components", view: "components" },
];

export function ProjectsPane() {
  const {
    actionError,
    activeProject,
    activeSession,
    composer,
    drops,
    expandedVideos,
    folderError,
    groups,
    isLoadingProjects,
    isLoadingVideos,
    library,
    newProject,
    newVideo,
    onNewSession,
    onRemoveSession,
    onRetryScaffold,
    onSelectSession,
    onToggleVideo,
    openFolder,
    paneSlide,
    paneView,
    projects,
    projectsError,
    relocateProject,
    registerVideo,
    reloadVideos,
    removeProject,
    removeVideo,
    renameProject,
    renameVideo,
    scaffolds,
    selectProject,
    sessionsError,
    settingsDialog,
    showPane,
    toggleProjects,
    videosError,
  } = useStudio();

  const now = useNow();
  const paneError = actionError ?? folderError;
  const commands: ProjectCommands = useMemo(
    () => ({ relocateProject, removeProject, renameProject }),
    [relocateProject, removeProject, renameProject]
  );
  const videoCommands: VideoCommands = useMemo(
    () => ({ registerVideo, removeVideo, renameVideo }),
    [registerVideo, removeVideo, renameVideo]
  );
  const pickable = useMemo(
    () => [...library.assets, ...library.bundled],
    [library.assets, library.bundled]
  );
  const onPickAsset = usePickAsset(pickable, composer.pick);
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

  let content = (
    <>
      <h2 className="sr-only">Videos</h2>
      <ProjectSwitcher
        commands={commands}
        onNewProject={newProject.open}
        onOpenFolder={openFolder}
        onSelect={selectProject}
        project={activeProject}
        projects={projects}
      />
      <NewVideoAction
        isDisabled={activeProject === null || activeProject.missing}
        onNewVideo={newVideo.open}
      />
      {activeProject === null ? null : (
        <Scaffolding
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
        onRemoveSession={onRemoveSession}
        onRetry={reloadVideos}
        onSelectSession={onSelectSession}
        onToggle={onToggleVideo}
      />
    </>
  );

  if (paneView === "assets") {
    content = (
      <>
        <h2 className="sr-only">Assets</h2>
        <AssetsScopeSwitch scope={assetsScope} />
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
          <StockPane
            kind={stockKind}
            onOpenSettings={settingsDialog.open}
            onSaved={library.refresh}
          />
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
            <UpdateStatus />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground"
              onClick={settingsDialog.open}
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

        <SidebarContent>
          <SidebarGroup
            className={cn(
              paneSlide === "push" && "animate-screen-in",
              paneSlide === "pop" && "animate-screen-back"
            )}
            data-pane-slide
            key={paneView}
          >
            <SidebarGroupContent>{content}</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

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
              className="relative pl-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground active:bg-sidebar-accent/40 active:text-sidebar-foreground data-active:bg-transparent data-active:font-normal data-active:text-sidebar-foreground"
              data-tour={item.tour}
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
    <div className="px-2 pb-2">
      <Button
        className="w-full bg-input/30"
        disabled={isDisabled}
        onClick={onNewVideo}
        variant="secondary"
      >
        <PlusIcon data-icon="inline-start" />
        New Video
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
          <EmptyDescription className="break-words">{error}</EmptyDescription>
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
      onRemoveSession={onRemoveSession}
      onSelectSession={onSelectSession}
      onToggle={onToggle}
    />
  );

  return (
    <>
      {active.length === 0 ? null : (
        <SidebarMenu>{active.map(item)}</SidebarMenu>
      )}

      {active.length === 0 && gone.length === 0 ? (
        <p className="px-3 py-2 text-muted-foreground text-xs">
          No videos yet.
        </p>
      ) : null}

      {gone.length === 0 ? null : (
        <>
          <h3
            className="mt-2 flex h-8 shrink-0 items-center px-2 font-medium text-sidebar-foreground/70 text-xs"
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

// Scaffolding belongs to the project, so it reports under the switcher rather
// than on a video: the template and the install are what the whole folder is
// waiting for, not one composition in it.
function Scaffolding({
  onRetry,
  projectId,
  scaffold,
}: {
  onRetry: (event: MouseEvent<HTMLButtonElement>) => void;
  projectId: string;
  scaffold: ScaffoldState | undefined;
}) {
  if (scaffold === undefined) {
    return null;
  }

  if (scaffold.isRunning) {
    return (
      <p className="flex items-center gap-2 px-3 py-1 text-muted-foreground text-xs">
        <Spinner className="size-3" />
        {DOING[scaffold.step]}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-1">
      <p className="text-destructive text-xs">{FAILED[scaffold.step]}</p>
      {scaffold.error === null ? null : (
        <p className="line-clamp-3 break-all font-mono text-2xs text-muted-foreground">
          {scaffold.error}
        </p>
      )}
      <Button
        className="self-start text-xs"
        onClick={onRetry}
        size="sm"
        value={projectId}
        variant="outline"
      >
        Retry
      </Button>
    </div>
  );
}
