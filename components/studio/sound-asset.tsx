"use client";

import { previewUrl } from "@/lib/studio/attachments";
import type { Asset } from "@/shared/library";
import { stillFileOf } from "@/shared/library";

export function SoundAsset({ asset }: { asset: Asset }) {
  const file = stillFileOf(asset);
  const url = file === null ? null : previewUrl(file);
  if (url === null) {
    return null;
  }
  return (
    <div className="min-w-0 space-y-2 px-1 pb-2">
      <audio
        aria-label={`Listen to ${asset.name}`}
        className="h-9 w-full min-w-0"
        controls
        preload="none"
        src={url}
      >
        <track kind="captions" label="Audio" />
      </audio>
      {asset.source?.provider === "elevenlabs" ? (
        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer rounded-sm focus-visible:outline-ring">
            ElevenLabs · {asset.source.connectionName}
          </summary>
          <p className="mt-1 whitespace-pre-wrap break-words">
            {asset.source.text}
          </p>
          <p className="mt-1 break-words">
            {asset.source.format} ·{" "}
            {asset.source.durationSeconds === null
              ? "Automatic duration"
              : `${asset.source.durationSeconds} seconds`}
          </p>
        </details>
      ) : null}
    </div>
  );
}
