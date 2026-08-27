"use client";

import { LightbulbIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
} from "@/components/ui/popover";
import type { Tours } from "@/hooks/use-tours";
import { tourAnchor } from "@/lib/studio/tours";
import { useStudio } from "./studio-provider";

// One tip, anchored to the element it is about. It is deliberately *not* a
// modal and not an overlay over the app: the three panes stay resizable and
// usable underneath, which is the whole reason there is no tour library here.
export function TourTip() {
  const { tours } = useStudio();

  return <TourCard tours={tours} />;
}

// Split from the context so the card can be rendered against a plain object:
// what it does with an anchor that is not on the page is worth pinning.
export function TourCard({ tours }: { tours: Tours }) {
  const { close, dismiss, reveal, tip } = tours;
  const [anchor, setAnchor] = useState<Element | null>(null);

  // The tip only becomes available once the thing it points at is on screen,
  // so this resolves after that commit and finds it. A miss shows nothing
  // rather than floating a card in the middle of the window.
  useEffect(() => {
    setAnchor(tip === null ? null : document.querySelector(tourAnchor(tip.id)));
  }, [tip]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        close();
      }
    },
    [close]
  );

  if (tip === null || anchor === null) {
    return null;
  }

  return (
    <Popover onOpenChange={onOpenChange} open>
      <PopoverPopup
        align={tip.align}
        anchor={anchor}
        className="w-80"
        data-tour-tip={tip.id}
        finalFocus={false}
        initialFocus={false}
        side={tip.side}
        sideOffset={8}
      >
        <div className="flex flex-col gap-2">
          <PopoverTitle className="flex items-center gap-2 font-heading font-medium text-sm leading-snug">
            <LightbulbIcon aria-hidden="true" className="size-4 shrink-0" />
            {tip.title}
          </PopoverTitle>

          <PopoverDescription className="text-pretty text-muted-foreground text-xs leading-relaxed">
            {tip.body}
          </PopoverDescription>

          <div className="flex items-center justify-end gap-1">
            {reveal === null || tip.action === null ? null : (
              <Button onClick={reveal} size="sm" variant="ghost">
                {tip.action.label}
              </Button>
            )}
            <Button onClick={dismiss} size="sm" variant="outline">
              Got it
            </Button>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
