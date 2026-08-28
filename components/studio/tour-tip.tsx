"use client";

import { LightbulbIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverDescription,
  PopoverPrimitive,
  PopoverTitle,
} from "@/components/ui/popover";
import type { Tours } from "@/hooks/use-tours";
import { tourAnchor } from "@/lib/studio/tours";
import { cn } from "@/lib/utils";
import { useStudio } from "./studio-provider";

// One tip, anchored to the element it is about, over a dimming backdrop so it
// is the one thing asking for attention. Clicking outside the card closes the
// tip for this launch, exactly as clicking away always did.
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

  const showing = tip !== null && anchor !== null;

  // The backdrop is ours, not the popover's Backdrop: answering one tip and
  // showing the next remounts the popover, and a remounted backdrop would
  // replay a fade — a full-screen flash between consecutive tips. This one
  // stays mounted and does not animate at all: only the card has an entrance.
  // The hide carries a delay instead, so the frames between one tip settling
  // and the next resolving its anchor never start a fade-out. It takes no
  // pointer events; the popover's own outside-press is the close.
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 z-40 bg-black/50",
          showing
            ? "opacity-100"
            : "opacity-0 transition-opacity delay-150 duration-200"
        )}
        data-slot="tour-backdrop"
      />
      {showing ? (
        // Not the shared PopoverPopup: its positioner transitions top/left,
        // which reads as the card sliding in from wherever the first
        // unmeasured paint put it. This positioner never animates position;
        // the popup fades and grows out of its anchor-facing origin instead.
        <Popover onOpenChange={onOpenChange} open>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Positioner
              align={tip.align}
              anchor={anchor}
              className="z-50 max-w-(--available-width)"
              data-slot="tour-positioner"
              side={tip.side}
              sideOffset={8}
            >
              <PopoverPrimitive.Popup
                className="relative w-80 origin-(--transform-origin) rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg outline-none transition-[opacity,scale,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-starting-style:translate-y-1.5 data-ending-style:scale-98 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-200 motion-reduce:transition-none"
                data-tour-tip={tip.id}
                finalFocus={false}
                initialFocus={false}
              >
                <div className="flex flex-col gap-2">
                  <PopoverTitle className="flex items-center gap-2 font-heading font-medium text-sm leading-snug">
                    <LightbulbIcon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
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
              </PopoverPrimitive.Popup>
            </PopoverPrimitive.Positioner>
          </PopoverPrimitive.Portal>
        </Popover>
      ) : null}
    </>
  );
}
