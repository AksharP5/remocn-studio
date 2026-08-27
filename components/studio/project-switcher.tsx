"use client";

import {
  ChevronsUpDownIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  UnplugIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectCommands } from "@/hooks/use-project-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/shared/ipc";
import { ProjectMenu } from "./project-menu";

// The project left the body of the pane so videos could have it, and it is a
// switcher rather than a list: one project is open at a time, and the rest are
// somewhere to go, not something to look at.
export function ProjectSwitcher({
  commands,
  onNewProject,
  onOpenFolder,
  onSelect,
  project,
  projects,
}: {
  commands: ProjectCommands;
  onNewProject: () => void;
  onOpenFolder: () => void;
  onSelect: (projectId: string) => void;
  project: Project | null;
  projects: readonly Project[];
}) {
  const pick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      onSelect(event.currentTarget.dataset.projectId ?? "");
    },
    [onSelect]
  );

  return (
    <div className="flex items-center gap-1 px-2 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className="min-w-0 flex-1 justify-between bg-input/30 font-medium"
              variant="secondary"
            />
          }
        >
          <span
            className={cn(
              "min-w-0 truncate",
              project === null && "text-muted-foreground"
            )}
          >
            {project?.name ?? "No project open"}
          </span>
          <ChevronsUpDownIcon
            className="shrink-0 text-muted-foreground"
            data-icon="inline-end"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {projects.map((row) => (
            <DropdownMenuItem
              data-project-id={row.id}
              key={row.id}
              onClick={pick}
            >
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              {row.missing ? (
                <UnplugIcon className="size-3 shrink-0 text-muted-foreground" />
              ) : null}
            </DropdownMenuItem>
          ))}
          {projects.length === 0 ? null : <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={onNewProject}>
            <FolderPlusIcon />
            New project…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenFolder}>
            <FolderOpenIcon />
            Open a folder…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {project === null ? null : (
        <ProjectMenu commands={commands} project={project} />
      )}
    </div>
  );
}
