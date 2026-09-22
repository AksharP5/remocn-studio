"use client";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useCallback } from "react";
export function GroupHeading({
  count,
  label,
  group,
  isOpen,
  onToggle,
}: {
  count: number;
  label?: string;
  group: string;
  isOpen: boolean;
  onToggle?: (group: string) => void;
}) {
  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onToggle?.(event.currentTarget.value);
    },
    [onToggle]
  );

  return (
    <h3 className="pb-1.5 font-medium text-foreground text-sm">
      <button
        aria-expanded={isOpen}
        className="-mx-1 flex min-h-7 w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-sm px-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-10"
        onClick={toggle}
        type="button"
        value={group}
      >
        {isOpen ? (
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">{label ?? group}</span>
        {isOpen ? null : (
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {count}
          </span>
        )}
      </button>
    </h3>
  );
}
