"use client";

import { memo } from "react";
import {
  type FrameCamera,
  type FrameChrome,
  isTurnWorking,
  useFrameLabel,
} from "@/hooks/use-frame-label";
import { useWorkingPhrase } from "@/hooks/use-working-phrase";
import { useStudioTurn } from "./studio-provider";
import { ThinkingStrip } from "./thinking";

const Strip = memo(ThinkingStrip);

function FrameText({ name }: { name: string }) {
  const working = isTurnWorking(useStudioTurn());
  const phrase = useWorkingPhrase(working);

  if (!working) {
    return <span className="min-w-0 truncate">{name}</span>;
  }

  return (
    <>
      <Strip className="shrink-0" />
      <span className="shimmer min-w-0 truncate">{phrase}</span>
    </>
  );
}

export function CanvasFrameLabel({
  camera,
  chrome,
  name,
  shown,
}: {
  camera: FrameCamera;
  chrome: FrameChrome;
  name: string | undefined;
  shown: boolean;
}) {
  return shown && name !== undefined ? (
    <FrameLabel camera={camera} chrome={chrome} name={name} />
  ) : null;
}

function FrameLabel({
  camera,
  chrome,
  name,
}: {
  camera: FrameCamera;
  chrome: FrameChrome;
  name: string;
}) {
  const label = useFrameLabel(camera, chrome);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-[7] flex h-4 items-center gap-1.5 text-muted-foreground text-xs leading-4"
      data-canvas-frame-label
      hidden
      ref={label}
    >
      <FrameText name={name} />
    </div>
  );
}
