"use client";

import { MousePointerClickIcon, XIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Selection } from "@/hooks/use-selections";
import { relativeTo } from "@/lib/studio/activity";
import { frameTime } from "@/lib/studio/time";
import { titleOf } from "@/lib/studio/tuning";
import type { PromptElement } from "@/shared/ipc";

export function SelectionRow({
  cwd,
  items,
  onOpen,
  onRemove,
  onReset,
  onSeek,
}: {
  cwd: string | null;
  items: readonly Selection[];
  onOpen: (index: number) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onReset: (index: number) => void;
  onSeek: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-1">
      {items.map((item, index) => (
        <SelectionChip
          cwd={cwd}
          index={index}
          item={item}
          key={item.id}
          onOpen={onOpen}
          onRemove={onRemove}
          onReset={onReset}
          onSeek={onSeek}
        />
      ))}
    </div>
  );
}

function SelectionChip({
  cwd,
  index,
  item,
  onOpen,
  onRemove,
  onReset,
  onSeek,
}: {
  cwd: string | null;
  index: number;
  item: Selection;
  onOpen: (index: number) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
  onReset: (index: number) => void;
  onSeek: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { element } = item;
  const changes = element.tuningChanges?.length ?? 0;
  const show = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (changes > 0 && !item.stale) {
        onOpen(index);
        return;
      }
      onSeek(event);
    },
    [changes, index, item.stale, onOpen, onSeek]
  );
  const remove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      onReset(index);
      onRemove(event);
    },
    [index, onRemove, onReset]
  );

  return (
    <span className="flex items-center rounded-md border bg-muted pr-0.5 text-xs">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={`Show ${labelOf(item)} at ${frameTime(element.frame, element.fps)}`}
              className="gap-1 font-normal"
              onClick={show}
              size="xs"
              value={String(index)}
              variant="ghost"
            />
          }
        >
          <MousePointerClickIcon className="text-reference" />
          <span className="text-reference tabular-nums">{index + 1}</span>
          <span className="max-w-32 truncate">{labelOf(item)}</span>
          {changes > 0 ? (
            <span className="text-muted-foreground tabular-nums">
              · {item.stale ? "Preview changed" : `${changes} changes`}
            </span>
          ) : null}
          <span className="text-muted-foreground tabular-nums">
            {frameTime(element.frame, element.fps)}
          </span>
        </TooltipTrigger>
        <TooltipContent>{`${labelOf(item)} · ${whereOf(element, cwd)}`}</TooltipContent>
      </Tooltip>

      <Button
        aria-label={`Remove ${labelOf(item)}`}
        className="relative size-5 after:absolute after:-inset-1"
        onClick={remove}
        size="icon-xs"
        value={String(index)}
        variant="ghost"
      >
        <XIcon />
      </Button>
    </span>
  );
}

// The pane names a component by what it *declares* — `componentName` on
// `withSchema`, or the `name` Remotion carries on the schema — and the chip is
// the only thing left on screen after the pane closes, so it has to agree.
// Reading grab's source resolution instead named the wrapped function:
// `TitleBase`, an implementation detail that is not exported, never appears in
// the pane, and is not a name the person has seen. `open` is the link the pane
// was on when Add was pressed, which is the one they were working in.
function labelOf(item: Selection): string {
  const target = item.tuning?.targets[item.tuning.open];

  return target === undefined ? plainLabel(item.element) : titleOf(target);
}

function plainLabel(element: PromptElement): string {
  return element.component ?? element.scene?.name ?? "Element";
}

function whereOf(element: PromptElement, cwd: string | null): string {
  if (element.file === null) {
    return "No source location — the markup and frame travel without one.";
  }

  return [relativeTo(element.file, cwd), element.line, element.column]
    .filter((part) => part !== null)
    .join(":");
}
