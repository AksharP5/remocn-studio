"use client";
import { PanelRightOpenIcon } from "lucide-react";
import { memo } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFrozenWidth } from "@/hooks/use-frozen-width";
import { usePlatformAttribute } from "@/hooks/use-platform";
import { usePreviewCollapse } from "@/hooks/use-preview-collapse";
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse";
import { useBoot } from "@/hooks/use-splash";
import { panelIdsOf } from "@/lib/studio/panes";
import { layoutStorage } from "@/lib/studio/settings";
import { cn } from "@/lib/utils";
import { ChatPane } from "./chat-pane";
import { CrashBoundary } from "./crash-boundary";
import { OnboardingDialog } from "./onboarding-dialog";
import { PreviewPane } from "./preview-pane";
import { ProjectsPane } from "./projects-pane";
import { QuitGuard } from "./quit-guard";
import { SettingsPage } from "./settings-page";
import { Splash } from "./splash";
import { StudioProvider, useStudio, useStudioBoot } from "./studio-provider";
import { Titlebar } from "./titlebar";

const SHELL_LAYOUT_ID = "shell";

export function AppShell() {
  usePlatformAttribute();

  return (
    <CrashBoundary>
      <StudioBoot />
    </CrashBoundary>
  );
}

function StudioBoot() {
  const { isBooting, onGone } = useBoot();

  return (
    <StudioProvider splash={<BootSplash onGone={onGone} />}>
      <TooltipProvider delay={500}>
        <ToastProvider>
          <AnchoredToastProvider>
            <ShellLayout isBooting={isBooting} />
            <SettingsPage />
            <OnboardingDialog suspended={isBooting} />
            <QuitGuard />
          </AnchoredToastProvider>
        </ToastProvider>
      </TooltipProvider>
    </StudioProvider>
  );
}

function BootSplash({ onGone }: { onGone: () => void }) {
  return <Splash isSettled={useStudioBoot()} onGone={onGone} />;
}

const StillChatPane = memo(ChatPane);

const StillPreviewPane = memo(PreviewPane);

const PANE_SLIDE =
  "transition-[flex-grow] duration-250 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none";

/* The preview holds the compiled bundle in an iframe, and an iframe that
   changes size every frame of a pane slide is a cross-document layout plus
   the Player rescaling its canvas — the lag the sidebar collapse had. While
   either slide runs, the pane keeps the width it had, pinned to its static
   right edge and clipped, and reflows once when the animation settles. */
function FrozenPane({
  children,
  isFrozen,
}: {
  children: React.ReactNode;
  isFrozen: boolean;
}) {
  const frozen = useFrozenWidth(isFrozen);

  return (
    <div className="flex h-full w-full justify-end overflow-hidden">
      <div
        className={cn("h-full", frozen.width === null ? "w-full" : "shrink-0")}
        ref={frozen.ref}
        style={frozen.width === null ? undefined : { width: frozen.width }}
      >
        {children}
      </div>
    </div>
  );
}

function ShellPanes({
  className,
  isSliding,
}: {
  className?: string;
  isSliding: boolean;
}) {
  const { hidePreview, isPreviewShown } = useStudio();
  const collapse = usePreviewCollapse(isPreviewShown, hidePreview);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_LAYOUT_ID,
    onlySaveAfterUserInteractions: true,
    panelIds: panelIdsOf(true),
    storage: layoutStorage,
  });

  return (
    <ResizablePanelGroup
      className={cn("min-h-0", className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel
        className={cn(
          "studio-boot-transition",
          collapse.isAnimating && PANE_SLIDE
        )}
        defaultSize="56%"
        groupResizeBehavior={
          isPreviewShown ? "preserve-pixel-size" : "preserve-relative-size"
        }
        id="chat"
        minSize="380px"
      >
        <StillChatPane />
      </ResizablePanel>

      <ResizableHandle
        className={cn(
          "studio-boot-transition bg-pane-border transition-opacity duration-250",
          isPreviewShown ? "opacity-100" : "opacity-0"
        )}
        disabled={!isPreviewShown}
      />

      <ResizablePanel
        className={cn(collapse.isAnimating && PANE_SLIDE)}
        collapsedSize="0%"
        collapsible
        defaultSize="44%"
        id="preview"
        minSize="360px"
        onResize={collapse.onResize}
        panelRef={collapse.panelRef}
      >
        {collapse.isMounted ? (
          <FrozenPane isFrozen={isSliding || collapse.isAnimating}>
            <StillPreviewPane />
          </FrozenPane>
        ) : null}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function ShellLayout({ isBooting }: { isBooting: boolean }) {
  const { isProjectsShown, mood, preferences, projects, settingsView } =
    useStudio();
  const collapse = useSidebarCollapse(isProjectsShown);

  return (
    // `inert` while Settings covers it: the shell keeps its state — the
    // preview's iframe, a running turn — but takes no key and no focus.
    <div
      className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-sidebar"
      data-studio-booting={isBooting ? "true" : undefined}
      inert={settingsView.isOpen || undefined}
    >
      {/* The band belongs to the window, not the sidebar: it runs the full
          width underneath, and the content card rides over it — so there is
          no seam where the sidebar ends. */}
      <div className="absolute inset-x-0 top-0">
        <Titlebar
          className="h-24"
          isBooting={isBooting}
          isStill={!preferences.titlebarMotion}
          mood={
            projects.length === 0 || !preferences.titlebarShader ? null : mood
          }
        />
      </div>

      <div
        className={cn(
          "studio-boot-transition relative z-10 grid min-h-0 flex-1 transition-[grid-template-columns] duration-250 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
          collapse.isExpanded
            ? "grid-cols-[18rem_minmax(0,1fr)]"
            : "grid-cols-[0rem_minmax(0,1fr)]"
        )}
        onTransitionEnd={collapse.onTransitionEnd}
      >
        {/* The sidebar is not a panel: it holds fixed-width rows and a card
            grid that gain nothing from resizing, so it only ever collapses —
            one width, no handle, nothing for the layout store to remember.
            Its top offset tucks the brand row under the traffic lights,
            inside the band's glow. */}
        <div className="flex min-h-0 overflow-hidden">
          {collapse.isMounted ? (
            <div className="mt-12 w-72 shrink-0" inert={!isProjectsShown}>
              <ProjectsPane />
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "studio-boot-transition relative my-2 mr-2 flex min-h-0 min-w-0 overflow-hidden rounded-xl border border-pane-border bg-background transition-[margin] duration-250 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
            isProjectsShown ? "ml-0" : "ml-2"
          )}
        >
          <ShellPanes className="flex-1" isSliding={collapse.isAnimating} />
          <ShowPreviewButton />
        </div>
      </div>
    </div>
  );
}

function ShowPreviewButton() {
  const { isPreviewShown, togglePreview } = useStudio();

  return (
    <div
      aria-hidden={isPreviewShown}
      className={cn(
        "studio-boot-transition absolute top-0 right-2 flex h-10 items-center transition-opacity duration-150 ease-out",
        isPreviewShown ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      inert={isPreviewShown}
    >
      <Button
        aria-expanded={isPreviewShown}
        aria-label="Show the preview"
        onClick={togglePreview}
        size="sm"
      >
        <PanelRightOpenIcon data-icon="inline-start" />
        Preview
      </Button>
    </div>
  );
}
