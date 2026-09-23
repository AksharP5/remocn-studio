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
      className={cn(
        "@container min-w-0 shrink-0",
        status !== undefined && "flex flex-1 flex-col"
      )}
    >
      <PlaybackSlider
        disabled={!ready || lastFrame === 0}
        label="Video position"
        max={Math.max(1, lastFrame)}
        onChange={seekTo}
        value={frame}
        valueText={`${position}, frame ${frame + 1} of ${lastFrame + 1}`}
      />
      {status === undefined ? null : (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {status}
        </div>
      )}
      <div className={cn(DOCK_ACTIONS, "shrink-0 flex-wrap gap-1")}>
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
        <PlaybackReadout
          duration={duration}
          error={error}
          frame={frame}
          lastFrame={lastFrame}
          position={position}
          ready={ready}
        />
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
        <div className="@min-[28rem]:block hidden w-16 shrink-0">
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

function PlaybackReadout({
  duration,
  error,
  frame,
  lastFrame,
  position,
  ready,
}: Pick<
  PreviewTransport,
  "duration" | "error" | "frame" | "lastFrame" | "position" | "ready"
>) {
  if (error) {
    return (
      <span
        className="min-w-0 flex-1 truncate text-destructive text-xs"
        role="alert"
        title={error}
      >
        {error}
      </span>
    );
  }
  return (
    <span
      className="min-w-0 flex-1 whitespace-nowrap pl-1 font-mono text-2xs text-muted-foreground tabular-nums"
      title={`Frame ${frame + 1} of ${lastFrame + 1}`}
    >
      <span className="text-foreground">{ready ? position : "--:--"}</span>
      <span className="px-1.5 opacity-50">/</span>
      {ready ? duration : "--:--"}
    </span>
  );
}

function PlaybackSlider({
  disabled,
  label,
  max,
  onChange,
  value,
  valueText,
}: {
  disabled: boolean;
  label: string;
  max: number;
  onChange: (value: number) => void;
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
      <SliderPrimitive.Control className="group flex h-8 w-full touch-none select-none items-center data-disabled:pointer-events-none data-disabled:opacity-40">
        <SliderPrimitive.Track className="relative h-1 w-full rounded-full bg-foreground/10">
          <SliderPrimitive.Indicator className="rounded-full bg-foreground/65" />
          <SliderPrimitive.Thumb
            aria-label={label}
            aria-valuetext={valueText}
            className="block size-2.5 rounded-full bg-foreground shadow-xs outline-none transition-[box-shadow] has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
