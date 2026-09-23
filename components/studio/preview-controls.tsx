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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SliderPrimitive } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import type { PreviewControl } from "@/hooks/use-preview";
import {
  type PreviewTransport,
  usePreviewTransport,
} from "@/hooks/use-preview-transport";
import { DOCK_ACTIONS } from "./dock-layout";

export function PreviewSurface({
  children,
  enabled,
  preview,
}: {
  children: ReactNode;
  enabled: boolean;
  preview: PreviewControl;
}) {
  const transport = usePreviewTransport(preview, enabled);
  const width = preview.pick?.metadata?.width || 16;
  const height = preview.pick?.metadata?.height || 9;

  return (
    <section
      aria-label="Video preview"
      className="flex min-h-0 flex-1 flex-col justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [container-type:size] [&:fullscreen]:bg-background [&:fullscreen]:p-4"
      ref={transport.surface}
      tabIndex={0}
    >
      <div
        className="flex min-h-0 w-full flex-col gap-2"
        style={{ height: `min(100cqh, calc(100cqw * ${height} / ${width} + 5.5rem))` }}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
          <div
            className="relative w-full overflow-hidden rounded-xl border bg-black/30"
            style={{
              aspectRatio: `${width} / ${height}`,
              maxWidth: `calc(100cqh * ${width} / ${height})`,
            }}
          >
            {children}
          </div>
        </div>
        <PreviewControls transport={transport} />
      </div>
    </section>
  );
}

export function PreviewControls({ transport, playShortcut = "Space", status }: { transport: PreviewTransport; playShortcut?: string; status?: ReactNode }) {
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
    <div
      aria-label="Playback controls"
      className={cn("@container shrink-0", status !== undefined && "flex flex-1 flex-col")}
      role="group"
    >
      <PlaybackSlider
        disabled={!ready || lastFrame === 0}
        label="Video position"
        max={Math.max(1, lastFrame)}
        onChange={seekTo}
        value={frame}
        valueText={`${position}, frame ${frame + 1} of ${lastFrame + 1}`}
      />
      {status === undefined ? null : <div className="flex min-h-0 flex-1 flex-col justify-center">{status}</div>}
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
          {buffering && playing ? (
            <Spinner className="size-4" />
          ) : playing ? (
            <PauseIcon className="fill-current" />
          ) : (
            <PlayIcon className="translate-x-px fill-current" />
          )}
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
        {error ? (
          <span
            className="min-w-0 flex-1 truncate text-destructive text-xs"
            role="alert"
            title={error}
          >
            {error}
          </span>
        ) : (
          <span
            className="min-w-0 flex-1 whitespace-nowrap pl-1 font-mono text-2xs text-muted-foreground tabular-nums"
            title={`Frame ${frame + 1} of ${lastFrame + 1}`}
          >
            <span className="text-foreground">{ready ? position : "--:--"}</span>
            <span className="px-1.5 opacity-50">/</span>
            {ready ? duration : "--:--"}
          </span>
        )}
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
        <div className="hidden w-16 shrink-0 @min-[28rem]:block">
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
    </div>
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
