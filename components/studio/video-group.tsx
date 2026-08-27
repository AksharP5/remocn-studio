"use client";

import {
  ChevronDown,
  ChevronRight,
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  FileQuestionIcon,
  SquarePenIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VideoCommands } from "@/hooks/use-video-menu";
import { useVisibleSessions } from "@/hooks/use-visible-sessions";
import type { Rollup as GroupRollup, PaneGroup } from "@/lib/studio/groups";
import { cn } from "@/lib/utils";
import { SessionItem } from "./session-item";
import { VideoMenu } from "./video-menu";

function VideoGroupBlock({
  activeSessionId,
  commands,
  group,
  isExpanded,
  now,
  onNewSession,
  onRemoveSession,
  onSelectSession,
  onToggle,
}: {
  activeSessionId: string | null;
  commands: VideoCommands;
  group: PaneGroup;
  isExpanded: boolean;
  now: number;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { hidden, isFull, toggle, visible } = useVisibleSessions(group);
  const { video } = group;
  const panelId = `video-${video.id}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-controls={panelId}
        aria-expanded={isExpanded}
        className="pr-14 font-medium hover:bg-sidebar-accent/40 active:bg-sidebar-accent/40"
        onClick={onToggle}
        value={video.id}
      >
        {isExpanded ? (
          <ChevronDown className="text-muted-foreground" />
        ) : (
          <ChevronRight className="text-muted-foreground" />
        )}
        {/* Only the name dims for a video the bundle no longer names: its
            chats are still worth reading, so the chevron and the menu keep
            full contrast. */}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            video.missing && "text-sidebar-foreground/70"
          )}
        >
          {video.name}
        </span>
        {video.missing ? (
          <Tooltip>
            <TooltipTrigger render={<span className="shrink-0" />}>
              <FileQuestionIcon className="size-3 text-muted-foreground" />
              <span className="sr-only">
                Nothing in this project renders {video.compositionId} anymore
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Nothing in this project renders {video.compositionId} anymore
            </TooltipContent>
          </Tooltip>
        ) : null}
        {isExpanded ? null : <Rollup rollup={group.rollup} />}
      </SidebarMenuButton>

      {/* `has-[[data-popup-open]]` keeps the cluster visible while its menu is
          open: the popup is portalled, so hover and focus-within both read
          false the moment it opens. */}
      <div className="absolute top-1 right-1 flex items-center opacity-0 focus-within:opacity-100 group-hover/menu-item:opacity-100 has-[[data-popup-open]]:opacity-100">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`New chat about ${video.name}`}
                className="relative after:absolute after:-inset-y-1 after:right-0 after:-left-1"
                disabled={video.missing}
                onClick={onNewSession}
                size="icon-xs"
                value={video.id}
                variant="ghost"
              />
            }
          >
            <SquarePenIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat here</TooltipContent>
        </Tooltip>

        <VideoMenu commands={commands} video={video} />
      </div>

      {isExpanded ? (
        // The sub-list keeps its semantics but drops its rail and indent: a
        // chat title lines up with the video name above it, one level.
        // `role="list"` survives preflight's list-style:none, which WKWebView
        // otherwise takes as a reason to drop list semantics entirely.
        <SidebarMenuSub
          className="mx-0 translate-x-0 gap-0.5 border-l-0 px-0"
          id={panelId}
          role="list"
        >
          {visible.map((row) => (
            <SidebarMenuSubItem key={row.session.id}>
              <SessionItem
                isActive={row.session.id === activeSessionId}
                now={now}
                onRemove={onRemoveSession}
                onSelect={onSelectSession}
                row={row}
              />
            </SidebarMenuSubItem>
          ))}

          {group.rows.length === 0 ? (
            <SidebarMenuSubItem className="py-1.5 pr-2 pl-7 text-muted-foreground text-xs">
              No chats yet
            </SidebarMenuSubItem>
          ) : null}

          {hidden > 0 || isFull ? (
            <SidebarMenuSubItem>
              <Button
                className="w-full justify-start pl-7 text-muted-foreground text-xs hover:bg-transparent hover:text-foreground"
                onClick={toggle}
                size="sm"
                variant="ghost"
              >
                {hidden > 0 ? `Show ${hidden} more` : "Show less"}
              </Button>
            </SidebarMenuSubItem>
          ) : null}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

export const VideoGroup = memo(VideoGroupBlock);

const ROLLUP_WORD: Record<GroupRollup["status"], string> = {
  failed: "failed",
  running: "running",
  unread: "unread",
  waiting: "waiting",
};

function Rollup({ rollup }: { rollup: GroupRollup | null }) {
  if (rollup === null) {
    return null;
  }

  const { count, status } = rollup;
  const label = `${count} ${count === 1 ? "chat" : "chats"} ${ROLLUP_WORD[status]}`;

  return (
    <span
      aria-label={label}
      className="flex shrink-0 items-center gap-1 font-normal text-2xs text-muted-foreground tabular-nums"
      role="img"
    >
      {status === "waiting" ? (
        <>
          <CircleQuestionMarkIcon className="size-4 shrink-0 text-sidebar-primary" />
          <span aria-hidden="true">{count}</span>
        </>
      ) : null}
      {status === "running" ? (
        <DotmSquare1
          ariaLabel=""
          className="shrink-0 text-sidebar-primary"
          dotSize={2}
          size={16}
        />
      ) : null}
      {status === "failed" ? (
        <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
      ) : null}
      {status === "unread" ? (
        <span className="size-1.5 rounded-full bg-sidebar-primary" />
      ) : null}
    </span>
  );
}
