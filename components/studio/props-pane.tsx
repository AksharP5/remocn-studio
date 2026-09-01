"use client";

import {
  ChevronRightIcon,
  CornerDownLeftIcon,
  LibraryBigIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComment } from "@/hooks/use-comment";
import type { PendingComment } from "@/hooks/use-inspect";
import { useWheelScroll } from "@/hooks/use-wheel-scroll";
import { relativeTo } from "@/lib/studio/activity";
import type { TuningField, TuningTarget } from "@/lib/studio/preview";
import { chainLabel } from "@/lib/studio/tuning";
import { cn } from "@/lib/utils";
import type { PromptElement, TuningValue } from "@/shared/ipc";
import { DialKitSurface } from "./dialkit-surface";
import { Pane, PaneActions, PaneBody, PaneHeader, PaneTitle } from "./pane";
import { useStudio } from "./studio-provider";
import { TuningRow } from "./tuning-controls";

// A design tool's order: where the thing is, how it is composited, how it
// reads, what it is painted with, then its own parameters and its timing.
const GROUP_ORDER = [
  "Transform",
  "Layer",
  "Typography",
  "Fill",
  "Stroke",
  "Parameters",
  "Entry",
  "Exit",
  "Effects",
  "Timing",
];

export function PropsPane() {
  const { openedProject, tools } = useStudio();
  const { inspect } = tools;
  const { card } = inspect;

  if (card === null || card.tuning === null) {
    return null;
  }

  return (
    <PropsPanel
      card={card}
      cwd={openedProject?.path ?? null}
      fields={card.tuning.fields}
      name={card.tuning.componentName}
      onCancel={inspect.cancelComment}
      onChange={inspect.changeTuning}
      onOpenTarget={inspect.openTarget}
      onReset={inspect.resetTuning}
      onSubmit={inspect.submitComment}
      refusal={inspect.tuningRefusal}
    />
  );
}

export function PropsPanel({
  card,
  cwd,
  fields,
  name,
  onCancel,
  onChange,
  onOpenTarget,
  onReset,
  onSubmit,
  refusal,
}: {
  card: PendingComment;
  cwd: string | null;
  fields: readonly TuningField[];
  name: string;
  onCancel: () => void;
  onChange: (path: string, value: TuningValue) => void;
  onOpenTarget?: (index: number) => void;
  onReset: (paths?: readonly string[]) => void;
  onSubmit: (comment: string) => void;
  refusal: string | null;
}) {
  const comment = useComment(onSubmit, onCancel);
  const changes = countChanges(card);
  const groups = groupsOf(fields);
  const resetAll = useCallback(() => onReset(), [onReset]);

  return (
    <Pane>
      <PaneHeader>
        <PaneTitle className="truncate">{name}</PaneTitle>
        <PaneActions>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Close the properties panel"
                  className="text-muted-foreground"
                  onClick={onCancel}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <XIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Close and restore the original values
            </TooltipContent>
          </Tooltip>
        </PaneActions>
      </PaneHeader>

      <PaneBody className="gap-0 p-0">
        {card.targets.length < 2 || onOpenTarget === undefined ? null : (
          <TargetChain
            onOpen={onOpenTarget}
            open={card.open}
            targets={card.targets}
          />
        )}

        <div className="flex min-h-8 shrink-0 items-center gap-2 px-4 pb-2">
          <p
            className="min-w-0 flex-1 truncate text-muted-foreground text-xs"
            title={whereOf(card.element, cwd)}
          >
            {whereOf(card.element, cwd)}
          </p>
          {changes === 0 ? null : (
            <Button
              className="shrink-0 text-muted-foreground"
              onClick={resetAll}
              size="xs"
              variant="ghost"
            >
              <RotateCcwIcon />
              Reset all
            </Button>
          )}
        </div>

        <DialKitSurface
          key={card.tuning?.targetId ?? "untunable"}
          targetId={card.tuning?.targetId ?? "untunable"}
        >
          <ScrollArea className="min-h-0 flex-1">
            <div className="pb-4">
              {/* Full-width rules between sections, so the divider is a property
                  of the pane rather than an inset line inside the content. */}
              {groups.map(([group, grouped]) => (
                <section
                  className="border-border border-t px-4 py-3 first:border-t-0"
                  key={group}
                >
                  <h3 className="pb-2 font-medium text-foreground text-sm">
                    {group}
                  </h3>
                  <div className="flex flex-col gap-2.5">
                    {grouped.map((field) => (
                      <TuningRow
                        field={field}
                        key={field.path}
                        onChange={onChange}
                        onReset={onReset}
                        original={card.originals[field.targetId]?.[field.path]}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>
        </DialKitSurface>

        <div className="flex shrink-0 flex-col gap-2 border-t p-3">
          {refusal === null ? null : (
            <p className="text-destructive text-xs" role="alert">
              {refusal}
            </p>
          )}

          <Textarea
            aria-label="What should change about this element?"
            className="max-h-24 min-h-14 resize-none text-sm"
            onChange={comment.onChange}
            onKeyDown={comment.onKeyDown}
            placeholder="What should change?"
            ref={comment.ref}
            rows={2}
            value={comment.value}
          />

          <div className="flex items-center gap-1">
            <Button
              className="text-muted-foreground"
              onClick={comment.keep}
              size="xs"
              title="Ask Claude to put this in the asset library"
              variant="ghost"
            >
              <LibraryBigIcon />
              Save to library
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button onClick={onCancel} size="xs" variant="ghost">
                Cancel
              </Button>
              <Button onClick={comment.submit} size="xs">
                <CornerDownLeftIcon />
                {changes === 0 ? "Add" : `Add ${changes}`}
              </Button>
            </div>
          </div>
        </div>
      </PaneBody>
    </Pane>
  );
}

/**
 * The `Interactive`s around what was clicked, innermost first.
 *
 * Remotion's markup primitives nest inside the component that renders them, so
 * pointing at a word lands on an `Interactive.Div` while the component's own
 * parameters — its easing, its timing — sit one or more levels out. Folding
 * them all into one list was the first answer and it was wrong: selecting a
 * title then showed the parameters of the camera framing the whole scene. So
 * the chain is offered instead, and the pane opens on what was actually
 * pointed at.
 */
function TargetChain({
  onOpen,
  open,
  targets,
}: {
  onOpen: (index: number) => void;
  open: number;
  targets: readonly TuningTarget[];
}) {
  // The index rides on the button rather than in a closure, so the row does
  // not remint a handler per target on every render.
  const choose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onOpen(Number(event.currentTarget.value));
    },
    [onOpen]
  );

  // A wheel travels sideways here: the strip only scrolls that way, and with
  // no scrollbar to grab a plain mouse would otherwise have no way to reach
  // the chips clipped off the edge.
  const strip = useWheelScroll<HTMLElement>();

  return (
    // A strip of chips scrolls without a bar, the way the attachment row does:
    // at this height a native scrollbar is most of the strip, and the cue is
    // the chip itself, clipped at the edge.
    <nav
      aria-label="Which component to edit"
      className="scrollbar-none flex shrink-0 items-center gap-0.5 overflow-x-auto px-4 pb-2"
      ref={strip.ref}
    >
      {targets.map((target, index) => (
        <span className="flex items-center gap-0.5" key={target.targetId}>
          {index === 0 ? null : (
            <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/60" />
          )}
          <Button
            aria-current={index === open}
            className={cn(
              "h-6 shrink-0 px-1.5 text-xs",
              index === open ? "text-foreground" : "text-muted-foreground"
            )}
            onClick={choose}
            size="xs"
            value={String(index)}
            variant={index === open ? "secondary" : "ghost"}
          >
            {chainLabel(target.componentName)}
          </Button>
        </span>
      ))}
    </nav>
  );
}

function groupsOf(fields: readonly TuningField[]): [string, TuningField[]][] {
  const grouped = Map.groupBy(fields, (field) => field.group);

  return [...grouped].sort(([first], [second]) => {
    const left = GROUP_ORDER.indexOf(first);
    const right = GROUP_ORDER.indexOf(second);

    return (
      (left === -1 ? GROUP_ORDER.length : left) -
      (right === -1 ? GROUP_ORDER.length : right)
    );
  });
}

// Every target in the chain, not only the one on screen: an edit made before
// the pane was switched still goes to the agent, so it still has to be counted.
function countChanges(card: PendingComment): number {
  return card.targets.reduce(
    (total, target) =>
      total +
      target.fields.filter((field) => {
        const original = card.originals[target.targetId]?.[field.path];

        return (
          original !== undefined &&
          JSON.stringify(original) !== JSON.stringify(field.value)
        );
      }).length,
    0
  );
}

function whereOf(element: PromptElement, cwd: string | null): string {
  if (element.file === null) {
    return "no source";
  }

  const shown = relativeTo(element.file, cwd);

  return element.line === null ? shown : `${shown}:${element.line}`;
}
