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
import { useOnboardingVideo } from "@/hooks/use-onboarding-video";
import {
  ONBOARDING_CHAPTERS,
  type OnboardingChapter,
} from "@/lib/studio/onboarding";
import { cn } from "@/lib/utils";
import { useStudio } from "./studio-provider";

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
  const { chapter, index } = onboarding;
  return (
    <>
      <Dialog
        disablePointerDismissal
        onOpenChange={onboarding.onOpenChange}
        open={onboarding.isOpen && !suspended}
      >
        <DialogContent
          aria-describedby={undefined}
          bottomStickOnMobile={false}
          className="group/onboarding max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-hidden duration-240 ease-[cubic-bezier(0.19,1,0.22,1)] data-[motion=instant]:transition-none data-ending-style:duration-150 motion-reduce:transition-opacity motion-reduce:duration-150 motion-reduce:sm:data-ending-style:scale-100 motion-reduce:sm:data-starting-style:scale-100"
          closeProps={{
            className: "absolute top-1.5 end-2 size-11 sm:size-10",
          }}
          data-motion={onboarding.motion}
          onKeyDownCapture={onboarding.onKeyDownCapture}
        >
          <header className="shrink-0 border-b px-4 py-4 pr-14">
            <DialogTitle className="font-sans text-base tracking-normal">
              Explore Studio
            </DialogTitle>
          </header>
          <div className="flex min-h-0 flex-1 max-md:flex-col">
            <nav
              aria-label="Studio features"
              className="w-48 shrink-0 overflow-y-auto border-r p-2 max-md:hidden"
            >
              <div className="relative isolate flex flex-col gap-1">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-10 rounded-md bg-foreground/10 transition-transform duration-240 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-data-[motion=instant]/onboarding:transition-none motion-reduce:transition-none"
                  style={{ transform: `translateY(${index * 2.75}rem)` }}
                />
                {ONBOARDING_CHAPTERS.map((item, position) => (
                  <button
                    aria-current={item.id === chapter.id ? "step" : undefined}
                    className={cn(
                      "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-inset",
                      item.id === chapter.id
                        ? "text-foreground"
                        : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                    )}
                    key={item.id}
                    onClick={onboarding.onChapterClick}
                    type="button"
                    value={item.id}
                  >
                    <span className="font-mono tabular-nums">
                      {String(position + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="border-b p-3 md:hidden">
                <label className="sr-only" htmlFor="onboarding-chapter">
                  Choose a chapter
                </label>
                <select
                  className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-base"
                  id="onboarding-chapter"
                  name="chapter"
                  onChange={onboarding.onChapterChange}
                  value={chapter.id}
                >
                  {ONBOARDING_CHAPTERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              {onboarding.isOpen && !suspended ? (
                <ChapterVideo chapter={chapter} key={chapter.id} />
              ) : null}
            </div>
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2">
            <Button
              className="h-11 sm:h-10"
              onClick={onboarding.close}
              size="sm"
              variant="ghost"
            >
              Skip
            </Button>
            <div className="flex items-center gap-2">
              <div className="px-1 text-foreground/80 text-sm tabular-nums">
                {index + 1} / {ONBOARDING_CHAPTERS.length}
              </div>
              <Button
                aria-label="Previous chapter"
                className="size-11 sm:size-10"
                disabled={index === 0}
                onClick={onboarding.previous}
                size="icon-sm"
                variant="outline"
              >
                <ArrowLeftIcon />
              </Button>
              <Button
                className="h-11 sm:h-10"
                onClick={onboarding.next}
                size="sm"
              >
                {index === ONBOARDING_CHAPTERS.length - 1 ? (
                  <>
                    Done <CheckIcon />
                  </>
                ) : (
                  <>
                    Next <ArrowRightIcon />
                  </>
                )}
              </Button>
            </div>
          </footer>
          {onboarding.saveError ? <SaveNotice onboarding={onboarding} /> : null}
        </DialogContent>
      </Dialog>
      {onboarding.saveError && !onboarding.isOpen ? (
        <div className="fixed right-4 bottom-4 z-50 max-w-sm rounded-xl border bg-popover shadow-lg">
          <SaveNotice onboarding={onboarding} />
        </div>
      ) : null}
    </>
  );
}

function SaveNotice({ onboarding }: { onboarding: Onboarding }) {
  return (
    <div className="flex items-center gap-3 border-t px-4 py-2" role="alert">
      <p className="text-sm">
        Your place couldn't be saved. The overview may return next time.
      </p>
      <Button onClick={onboarding.retrySave} size="sm" variant="outline">
        Retry
      </Button>
    </div>
  );
}

export function ChapterVideo({ chapter }: { chapter: OnboardingChapter }) {
  const video = useOnboardingVideo();
  const base = `/onboarding/${chapter.id}`;
  return (
    <section
      aria-label={chapter.label}
      className="motion-reduce:translate-none motion-reduce:starting:translate-none p-3 duration-200 ease-[cubic-bezier(0.19,1,0.22,1)] group-data-[motion=backward]/onboarding:starting:opacity-0 group-data-[motion=forward]/onboarding:starting:opacity-0 group-data-[motion=backward]/onboarding:transition-[opacity,translate] group-data-[motion=forward]/onboarding:transition-[opacity,translate] motion-safe:group-data-[motion=backward]/onboarding:starting:-translate-x-2 motion-safe:group-data-[motion=forward]/onboarding:starting:translate-x-2 motion-reduce:transition-opacity"
    >
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          aria-label={`${chapter.label} demonstration`}
          className="aspect-[1990/1080] max-h-[60dvh] w-full object-contain"
          controls
          height={1080}
          muted
          onError={video.onError}
          playsInline
          poster={`${base}.jpg`}
          preload="metadata"
          ref={video.videoRef}
          src={`${base}.mp4`}
          width={1990}
        />
        {video.failed ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-4 text-center text-white"
            role="alert"
          >
            <p className="text-sm">This video couldn’t load.</p>
            <Button onClick={video.retry} size="sm" variant="secondary">
              <RotateCcwIcon /> Retry video
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
