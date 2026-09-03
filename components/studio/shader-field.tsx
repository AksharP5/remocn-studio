"use client";

import { NeuroNoise } from "@paper-design/shaders-react";
import { useShaderBackdrop } from "@/hooks/use-shader-backdrop";
import { cn } from "@/lib/utils";

// The shader takes hex/rgb/hsl and the theme is authored in oklch, so these
// cannot read the tokens. They are the primary violet and its light end,
// carried over as rgba with the alpha doing the muting: a transparent back
// leaves whatever it sits on showing through, in either theme.
const BACK = "rgba(0, 0, 0, 0)";
const MID = "rgba(124, 58, 237, 0.55)";
const FRONT = "rgba(196, 181, 253, 0.45)";

// Decoration is soft by nature, so it renders at one device pixel per CSS
// pixel and is capped well under the library's 8.3M default. Nothing about the
// pattern survives the extra samples; the GPU time does.
const MAX_PIXELS = 1920 * 1080;

export function ShaderField({
  brightness,
  className,
  contrast,
  scale,
  speed,
}: {
  brightness: number;
  className?: string;
  contrast: number;
  scale: number;
  speed: number;
}) {
  const backdrop = useShaderBackdrop(speed);

  if (!backdrop.isReady) {
    return null;
  }

  return (
    <NeuroNoise
      brightness={brightness}
      className={cn("size-full", className)}
      colorBack={BACK}
      colorFront={FRONT}
      colorMid={MID}
      contrast={contrast}
      height="100%"
      maxPixelCount={MAX_PIXELS}
      minPixelRatio={1}
      scale={scale}
      speed={backdrop.speed}
      width="100%"
    />
  );
}
