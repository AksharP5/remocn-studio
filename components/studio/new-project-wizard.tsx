"use client";

import { ChevronLeftIcon, FolderOpenIcon } from "lucide-react";
import { MiddleTruncation } from "@/components/middle-truncation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewProject } from "@/hooks/use-new-project";
import { cn } from "@/lib/utils";
import { FormatPicker } from "./format-picker";
import { Scrim } from "./scrim";

const RATIO_LABEL = "new-project-ratio";

export function NewProjectWizard({
  control,
  entrance,
}: {
  control: NewProject;
  entrance: string | null;
}) {
  return (
    <div className={cn("flex w-full min-w-0 flex-1 flex-col", entrance)}>
      <Scrim className="@container m-auto flex w-full min-w-0 flex-col gap-6">
        <div className="flex flex-col items-start gap-3">
          <Button
            className="-ml-2 text-muted-foreground"
            onClick={control.close}
            size="sm"
            variant="ghost"
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Back
          </Button>

          <div className="flex flex-col gap-1">
            <h3 className="text-balance font-semibold text-2xl leading-tight tracking-tight">
              New project
            </h3>
            <p className="text-pretty text-muted-foreground text-sm/relaxed">
              A folder is created for it, with your first video inside. More
              videos live in the same project and share its components.
            </p>
          </div>
        </div>

        <form
          className="flex min-w-0 flex-col gap-6"
          onSubmit={control.onSubmit}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-project-name">Name</Label>
            {/* A folder name is a slug, not prose or an identity: spelling
                suggestions, autofill and a password manager's overlay are all
                noise on top of a field where they can never be right. */}
            <Input
              autoComplete="off"
              autoFocus
              data-1p-ignore
              data-lpignore="true"
              id="new-project-name"
              onChange={control.onNameChange}
              placeholder="launch-film"
              spellCheck="false"
              value={control.name}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="new-project-location">Location</Label>
            <Button
              className="w-full min-w-0 justify-start font-normal"
              id="new-project-location"
              onClick={control.pickParent}
              type="button"
              variant="outline"
            >
              <FolderOpenIcon data-icon="inline-start" />
              <MiddleTruncation className="min-w-0 flex-1 text-left">
                {control.parent ?? "Choose a folder…"}
              </MiddleTruncation>
            </Button>
          </div>

          <FormatPicker
            id={RATIO_LABEL}
            onChange={control.onFormatChange}
            value={control.format}
          />

          <div className="flex justify-end">
            <Button disabled={!control.canCreate} type="submit">
              Create
            </Button>
          </div>
        </form>
      </Scrim>
    </div>
  );
}
