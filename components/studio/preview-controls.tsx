"use client";

import {
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SliderPrimitive } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { PreviewTransport } from "@/hooks/use-preview-transport";
import { cn } from "@/lib/utils";
import { DOCK_ACTIONS } from "./dock-layout";

export function PreviewControls({
  transport,
  playShortcut = "Space",
  status,
}: {
  transport: PreviewTransport;
  playShortcut?: string;
  status?: ReactNode;
}) {
  const {
    buffering,
    canFullscreen,
    duration,
    error,
    frame,
    fullscreen,
    lastFrame,
    muted,
    next,
    playing,
    position,
    previous,
    ready,
    seekTo,
    setVolume,
    toggle,
    toggleFullscreen,
    toggleMute,
    volume,
  } = transport;

  return (
    <fieldset
      aria-label="Playback controls"
      className="@container flex min-w-0 shrink-0 flex-col gap-2"
    >
      <PlaybackSlider
        disabled={!ready || lastFrame === 0}
        end={ready ? duration : "--:--"}
        label="Video position"
        max={Math.max(1, lastFrame)}
        onChange={seekTo}
        start={ready ? position : "--:--"}
        title={`Frame ${frame + 1} of ${lastFrame + 1}`}
        value={frame}
        valueText={`${position}, frame ${frame + 1} of ${lastFrame + 1}`}
      />
      <div className={cn(DOCK_ACTIONS, "shrink-0 gap-1")}>
        <Button
          aria-label="Previous frame"
          className="size-8 text-muted-foreground sm:size-8"
          disabled={!ready || frame === 0}
          onClick={previous}
          size="icon"
          title="Previous frame (←)"
          variant="ghost"
        >
          <StepBackIcon />
        </Button>
        <Button
          aria-label={playing ? "Pause" : "Play"}
          className="size-8 sm:size-8"
          disabled={!ready}
          onClick={toggle}
          size="icon"
          title={`${playing ? "Pause" : "Play"} (${playShortcut})`}
          variant="ghost"
        >
          <PlaybackGlyph buffering={buffering} playing={playing} />
        </Button>
        <Button
          aria-label="Next frame"
          className="size-8 text-muted-foreground sm:size-8"
          disabled={!ready || frame === lastFrame}
          onClick={next}
          size="icon"
          title="Next frame (→)"
          variant="ghost"
        >
          <StepForwardIcon />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col justify-center px-2">
          {error ? (
            <span
              className="truncate text-center text-destructive text-xs"
              role="alert"
              title={error}
            >
              {error}
            </span>
          ) : (
            status
          )}
        </div>
        <Button
          aria-label={muted ? "Unmute" : "Mute"}
          className="size-8 text-muted-foreground sm:size-8"
          disabled={!ready}
          onClick={toggleMute}
          size="icon"
          title={muted ? "Unmute" : "Mute"}
          variant="ghost"
        >
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
        </Button>
        <div className="@min-[28rem]:block hidden w-20 shrink-0">
          <PlaybackSlider
            disabled={!ready}
            label="Volume"
            max={100}
            onChange={setVolume}
            value={volume}
            valueText={`${volume}%`}
          />
        </div>
        {canFullscreen ? (
          <Button
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="size-8 text-muted-foreground sm:size-8"
            disabled={!ready}
            onClick={toggleFullscreen}
            size="icon"
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            variant="ghost"
          >
            {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}

function PlaybackGlyph({
  buffering,
  playing,
}: Pick<PreviewTransport, "buffering" | "playing">) {
  if (buffering && playing) {
    return <Spinner className="size-4" />;
  }
  if (playing) {
    return <PauseIcon className="fill-current" />;
  }
  return <PlayIcon className="translate-x-px fill-current" />;
}

function PlaybackSlider({
  disabled,
  end,
  label,
  max,
  onChange,
  start,
  title,
  value,
  valueText,
}: {
  disabled: boolean;
  end?: string;
  label: string;
  max: number;
  onChange: (value: number) => void;
  start?: string;
  title?: string;
  value: number;
  valueText: string;
}) {
  return (
    <SliderPrimitive.Root
      disabled={disabled}
      max={max}
      min={0}
      onValueChange={onChange}
      step={1}
      thumbAlignment="edge"
      value={value}
    >
      <SliderPrimitive.Control
        className="group relative flex h-8 w-full touch-none select-none overflow-hidden rounded-md bg-foreground/5 has-focus-visible:ring-2 has-focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-40"
        title={title}
      >
        <SliderPrimitive.Track className="relative h-full w-full">
          <SliderPrimitive.Indicator className="bg-foreground/10 transition-colors group-hover:bg-foreground/15 group-data-dragging:bg-foreground/15" />
          <SliderPrimitive.Thumb
            aria-label={label}
            aria-valuetext={valueText}
            className="h-5 w-[3px] rounded-full bg-foreground outline-none"
          />
        </SliderPrimitive.Track>
        {start === undefined ? null : (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-2xs text-foreground tabular-nums">
            {start}
          </span>
        )}
        {end === undefined ? null : (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-2xs text-muted-foreground tabular-nums">
            {end}
          </span>
        )}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
