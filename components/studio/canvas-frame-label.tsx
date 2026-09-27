"use client";

import { memo } from "react";
import {
  type FrameCamera,
  type FrameChrome,
  isTurnWorking,
  useFrameLabel,
} from "@/hooks/use-frame-label";
import { useStudioTurn } from "./studio-provider";
import { ThinkingMark } from "./thinking";

const Mark = memo(ThinkingMark);

function FrameWorking() {
  return isTurnWorking(useStudioTurn()) ? <Mark className="shrink-0" /> : null;
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
      <span className="min-w-0 truncate">{name}</span>
      <FrameWorking />
    </div>
  );
}
