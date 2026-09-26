"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Onboarding } from "@/hooks/use-onboarding";
import { useOnboardingStill } from "@/hooks/use-onboarding-still";
import { useSaveErrorToast } from "@/hooks/use-save-error-toast";
import {
  ONBOARDING_CHAPTERS,
  type OnboardingChapter,
} from "@/lib/studio/onboarding";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";
import { useStudio } from "./studio-provider";

const ENTER =
  "motion-reduce:translate-none motion-reduce:starting:translate-none duration-base ease-out group-data-[motion=backward]/onboarding:starting:opacity-0 group-data-[motion=forward]/onboarding:starting:opacity-0 group-data-[motion=backward]/onboarding:transition-[opacity,translate] group-data-[motion=forward]/onboarding:transition-[opacity,translate] motion-safe:group-data-[motion=backward]/onboarding:starting:-translate-x-3 motion-safe:group-data-[motion=forward]/onboarding:starting:translate-x-3 motion-reduce:transition-opacity";

const DEAL =
  "absolute inset-0 transition-[opacity,translate] duration-base ease-out starting:translate-y-4 starting:opacity-0 group-data-[motion=instant]/onboarding:transition-none motion-reduce:starting:translate-y-0";

function step(position: number) {
  return String(position + 1).padStart(2, "0");
}

export function OnboardingDialog({
  suspended = false,
}: {
  suspended?: boolean;
}) {
  const { onboarding } = useStudio();
  return <OnboardingOverview onboarding={onboarding} suspended={suspended} />;
}

export function OnboardingOverview({
  onboarding,
  suspended = false,
}: {
  onboarding: Onboarding;
  suspended?: boolean;
}) {
  const { chapter, index, onCover } = onboarding;
  useSaveErrorToast(onboarding.saveError, onboarding.retrySave);
  const shown = onboarding.isOpen && !suspended;
  const last = index === ONBOARDING_CHAPTERS.length - 1;
  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={onboarding.onOpenChange}
      open={shown}
    >
      <DialogContent
        aria-describedby={undefined}
        bottomStickOnMobile={false}
        className="group/onboarding row-span-3 row-start-1 max-h-[calc(100dvh-2rem)] w-[min(68rem,calc(100vw-2rem))] max-w-none self-center overflow-hidden duration-base ease-out data-[motion=instant]:transition-none data-ending-style:duration-fast motion-reduce:transition-opacity motion-reduce:duration-fast motion-reduce:sm:data-ending-style:scale-100 motion-reduce:sm:data-starting-style:scale-100"
        closeProps={{
          className: "absolute top-3 end-3 z-20 size-11 sm:size-10",
        }}
        data-motion={onboarding.motion}
        onKeyDownCapture={onboarding.onKeyDownCapture}
      >
        <DialogTitle className="sr-only">Explore Studio</DialogTitle>
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none]">
          {shown && onCover ? <Cover /> : null}
          {shown && !onCover ? (
            <Chapter chapter={chapter} index={index} key={chapter.id} />
          ) : null}
        </div>
        <footer className="relative flex shrink-0 items-center justify-between gap-4 border-t bg-popover px-3 py-2 sm:px-4">
          <nav aria-label="Studio features" className="flex items-center">
            {ONBOARDING_CHAPTERS.map((item, position) => (
              <button
                aria-current={
                  !onCover && item.id === chapter.id ? "step" : undefined
                }
                aria-label={`${step(position)} ${item.label}`}
                className="group/segment flex h-11 w-8 items-center px-1 outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-inset sm:w-10"
                key={item.id}
                onClick={onboarding.onChapterClick}
                title={item.label}
                type="button"
                value={item.id}
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors duration-fast",
                    !onCover && position === index && "bg-foreground",
                    !onCover &&
                      position < index &&
                      "bg-foreground/45 group-hover/segment:bg-foreground/70",
                    (onCover || position > index) &&
                      "bg-foreground/15 group-hover/segment:bg-foreground/40"
                  )}
                />
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              className="h-11 sm:h-10"
              onClick={onboarding.close}
              size="sm"
              variant="ghost"
            >
              Skip
            </Button>
            {onCover ? null : (
              <Button
                aria-label="Previous chapter"
                className="size-11 sm:size-10"
                onClick={onboarding.previous}
                size="icon-sm"
                variant="outline"
              >
                <ArrowLeftIcon />
              </Button>
            )}
            <Button
              className="h-11 sm:h-10"
              onClick={onCover ? onboarding.start : onboarding.next}
              size="sm"
            >
              {onCover ? "Take the tour" : null}
              {!onCover && last ? "Done" : null}
              {onCover || last ? null : "Next"}
              {!onCover && last ? <CheckIcon /> : <ArrowRightIcon />}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Cover() {
  return (
    <section
      aria-label="Welcome"
      className="grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
    >
      <div className="flex flex-col justify-center gap-7 px-8 pt-18 pb-8 md:pr-8">
        <LogoMark className="size-8 text-foreground" />
        <div className="flex flex-col gap-3">
          <h2 className="text-balance font-heading font-semibold text-4xl leading-[1.08] tracking-tight">
            Welcome to Remocn Studio
          </h2>
          <p className="text-pretty text-base text-muted-foreground leading-normal">
            Six things that make it more than a chat. A minute, and you can skip
            any of it.
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="px-8 pt-18 pb-8 max-md:hidden md:pl-0">
        <div className="relative aspect-[1990/1080]">
          <DealtStill
            className="translate-x-[5%] -translate-y-[4%] rotate-[4deg] scale-[0.86] opacity-40 delay-150"
            id="export"
          />
          <DealtStill
            className="translate-x-[2.5%] -translate-y-[2%] rotate-[2deg] scale-[0.92] opacity-70 delay-75"
            id="snapshot"
          />
          <DealtStill className="-rotate-1 scale-[0.96]" id="inspect" />
        </div>
      </div>
    </section>
  );
}

function DealtStill({ className, id }: { className?: string; id: string }) {
  return (
    <div
      className={cn(
        DEAL,
        "overflow-hidden rounded-xl bg-black shadow-[0_24px_64px_-12px_rgb(0_0_0/0.6)] outline outline-1 outline-[oklch(1_0_0/0.1)] -outline-offset-1",
        className
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: a bundled file in a static export, which next/image adds nothing to */}
      <img
        alt=""
        className="size-full object-cover"
        height={1080}
        src={`/onboarding/${id}.webp`}
        width={1990}
      />
    </div>
  );
}

function Chapter({
  chapter,
  index,
}: {
  chapter: OnboardingChapter;
  index: number;
}) {
  return (
    <section
      aria-label={chapter.label}
      className="grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
    >
      <div className={cn("flex flex-col gap-5 px-8 pt-18 pb-8 md:pr-8", ENTER)}>
        <div className="flex flex-col gap-3">
          <p className="flex items-baseline gap-2.5 text-sm">
            <span className="font-mono text-muted-foreground text-xs tabular-nums">
              {step(index)}
            </span>
            <span className="font-medium text-foreground/80">
              {chapter.label}
            </span>
          </p>
          <h2 className="text-balance font-heading font-semibold text-[1.75rem] leading-[1.15] tracking-tight">
            {chapter.title}
          </h2>
        </div>
        <p className="text-pretty text-[0.9375rem] text-muted-foreground leading-relaxed">
          {chapter.body}
        </p>
      </div>
      <div className={cn("px-8 pt-18 pb-8 max-md:pt-0 md:pl-0", ENTER)}>
        <ChapterStill chapter={chapter} />
      </div>
    </section>
  );
}

export function ChapterStill({ chapter }: { chapter: OnboardingChapter }) {
  const still = useOnboardingStill();
  return (
    <div className="relative overflow-hidden rounded-xl bg-black shadow-[0_24px_64px_-12px_rgb(0_0_0/0.6)] outline outline-1 outline-[oklch(1_0_0/0.1)] -outline-offset-1">
      {/* biome-ignore lint/performance/noImgElement: a bundled file in a static export, which next/image adds nothing to */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the browser reporting a dead path, not an interaction */}
      <img
        alt={`${chapter.label} in Studio`}
        className="aspect-[1990/1080] w-full object-contain"
        height={1080}
        key={still.attempt}
        onError={still.onError}
        src={`/onboarding/${chapter.id}.webp`}
        width={1990}
      />
      {still.failed ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-4 text-center text-white"
          role="alert"
        >
          <p className="text-sm">This picture couldn’t load.</p>
          <Button onClick={still.retry} size="sm" variant="secondary">
            <RotateCcwIcon /> Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
