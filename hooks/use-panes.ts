"use client";

import { Effect } from "effect";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type PaneView,
  type SlideDirection,
  slideDirection,
} from "@/lib/studio/pane-view";
import { fitPanes, showsPreview } from "@/lib/studio/panes";
import {
  type StudioSettings,
  savePaneView,
  savePreviewPane,
  saveProjectsPane,
} from "@/lib/studio/settings";
import { useWindowWidth } from "./use-window-width";

export interface Panes {
  hasProjectsRoom: boolean;
  hidePreview: () => void;
  isChatPeeking: boolean;
  isChatShown: boolean;
  isPreviewShown: boolean;
  isProjectsPeeking: boolean;
  isProjectsShown: boolean;
  paneSlide: SlideDirection;
  paneView: PaneView;
  peekProjects: (isOpen: boolean) => void;
  showPane: (view: PaneView) => void;
  toggleChat: () => void;
  togglePreview: () => void;
  toggleProjects: () => void;
}

export function usePanes(
  settings: StudioSettings | null,
  hasProjects: boolean,
  isLoadingProjects: boolean
): Panes {
  const [preview, setPreview] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<boolean | null>(null);
  const [view, setView] = useState<PaneView | null>(null);
  const [projectsPeek, setProjectsPeek] = useState(false);
  const [chatPeek, setChatPeek] = useState(false);
  const cameFrom = useRef<PaneView | null>(null);
  const windowWidth = useWindowWidth();

  const isPreviewShown = showsPreview(
    preview ?? settings?.previewPane ?? null,
    hasProjects,
    isLoadingProjects
  );
  const fit = fitPanes(windowWidth, isPreviewShown);
  const isProjectsShown =
    (projects ?? settings?.projectsPane ?? true) && fit.projects;
  const isChatShown = fit.chat;

  if (isProjectsShown && projectsPeek) {
    setProjectsPeek(false);
  }
  if (isChatShown && chatPeek) {
    setChatPeek(false);
  }

  const togglePreview = useCallback(() => {
    const next = !isPreviewShown;
    setPreview(next);
    Effect.runFork(savePreviewPane(next));
  }, [isPreviewShown]);

  // Not `togglePreview`: the panel reports a collapse, not a change of mind,
  // so saying it twice must be free. The write stays outside the updater, which
  // StrictMode invokes twice in dev.
  const hidePreview = useCallback(() => {
    if (!isPreviewShown) {
      return;
    }
    setPreview(false);
    Effect.runFork(savePreviewPane(false));
  }, [isPreviewShown]);

  const toggleProjects = useCallback(() => {
    if (projectsPeek) {
      setProjectsPeek(false);
      return;
    }
    if (!(isProjectsShown || fit.projects)) {
      setProjectsPeek(true);
      return;
    }
    const next = !isProjectsShown;
    setProjects(next);
    Effect.runFork(saveProjectsPane(next));
  }, [fit.projects, isProjectsShown, projectsPeek]);

  const peekProjects = useCallback((isOpen: boolean) => {
    setProjectsPeek(isOpen);
  }, []);

  const toggleChat = useCallback(() => {
    setChatPeek((open) => !open);
  }, []);

  const paneView = view ?? settings?.paneView ?? "videos";
  const held = useRef(paneView);
  held.current = paneView;

  const showPane = useCallback((next: PaneView) => {
    if (next === held.current) {
      return;
    }
    cameFrom.current = held.current;
    setView(next);
    Effect.runFork(savePaneView(next));
  }, []);

  const paneSlide = slideDirection(cameFrom.current, paneView);

  return useMemo(
    () => ({
      hasProjectsRoom: fit.projects,
      hidePreview,
      isChatPeeking: chatPeek && !isChatShown,
      isChatShown,
      isPreviewShown,
      isProjectsPeeking: projectsPeek && !isProjectsShown,
      isProjectsShown,
      paneSlide,
      paneView,
      peekProjects,
      showPane,
      toggleChat,
      togglePreview,
      toggleProjects,
    }),
    [
      chatPeek,
      fit.projects,
      hidePreview,
      isChatShown,
      isPreviewShown,
      isProjectsShown,
      paneSlide,
      paneView,
      peekProjects,
      projectsPeek,
      showPane,
      toggleChat,
      togglePreview,
      toggleProjects,
    ]
  );
}
