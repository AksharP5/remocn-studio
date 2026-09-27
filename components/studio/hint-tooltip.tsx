"use client";

import type { ReactElement, ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HintTooltip({
  children,
  label,
  render,
  shortcut,
  side = "bottom",
}: {
  children: ReactNode;
  label: string;
  render: ReactElement;
  shortcut?: string;
  side?: "bottom" | "left" | "right" | "top";
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={render}>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span className="flex items-center gap-2">
          {label}
          {shortcut === undefined ? null : <Kbd>{shortcut}</Kbd>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
