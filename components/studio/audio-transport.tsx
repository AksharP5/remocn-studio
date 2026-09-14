"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { type AudioPlayer, audioTime } from "@/hooks/use-audio-player";

export function AudioTransport({
  name,
  player,
}: {
  name: string;
  player: AudioPlayer;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-muted/50 p-3">
      <audio
        aria-label={`Audio for ${name}`}
        onDurationChange={player.onMetadata}
        onEnded={player.onPause}
        onError={player.onError}
        onLoadedMetadata={player.onMetadata}
        onPause={player.onPause}
        onPlay={player.onPlay}
        onTimeUpdate={player.onTime}
        preload="metadata"
        ref={player.ref}
        src={player.url ?? undefined}
      >
        <track kind="captions" label="Sound effect" />
      </audio>
      <Button
        aria-label={`${player.playing ? "Pause" : "Play"} ${name}`}
        className="size-11 rounded-full before:rounded-full focus-visible:ring-foreground/50 motion-safe:transition-transform motion-safe:active:scale-[0.96] sm:size-11"
        disabled={player.pending || player.url === null}
        onClick={player.toggle}
        size="icon-xl"
        type="button"
        variant="outline"
      >
        <PlayState player={player} />
      </Button>
      <div className="flex min-w-0 flex-1 flex-col">
        <input
          aria-label={`Seek ${name}`}
          aria-valuetext={`${audioTime(player.position)} of ${audioTime(player.duration)}`}
          className="h-7 w-full cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-foreground/50 disabled:cursor-default disabled:opacity-50"
          disabled={player.duration <= 0 || player.unavailable}
          max={player.duration || 1}
          min={0}
          onChange={player.onSeek}
          step={0.01}
          type="range"
          value={Math.min(player.position, player.duration)}
        />
        <div
          aria-hidden="true"
          className="flex justify-between text-muted-foreground text-xs tabular-nums"
        >
          <span>{audioTime(player.position)}</span>
          <span>
            {player.duration > 0 ? audioTime(player.duration) : "—:—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlayState({ player }: { player: AudioPlayer }) {
  if (player.pending) {
    return <Spinner />;
  }
  return player.playing ? (
    <PauseIcon className="size-4" />
  ) : (
    <PlayIcon className="relative left-0.5 size-4" />
  );
}
