"use client";

import { ColorControl } from "dialkit";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const PALETTE_HEX = /^#[\da-f]{6}([\da-f]{2})?$/i;

// DialKit also accepts CSS color spaces; project palettes store sRGB hex.
function paletteHex(value: string): string | null {
  if (PALETTE_HEX.test(value)) {
    return value;
  }
  if (!CSS.supports("color", value)) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const rgba = context.getImageData(0, 0, 1, 1).data;
  const channels = rgba[3] === 255 ? rgba.slice(0, 3) : rgba;
  return `#${Array.from(channels, (channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function ProjectBrandColor({
  role,
  value,
  onChange,
}: {
  role: string;
  value: string | undefined;
  onChange: (role: string, color: string) => void;
}) {
  const changeColor = useCallback(
    (color: string) => {
      const hex = paletteHex(color);
      if (hex) {
        onChange(role, hex);
      }
    },
    [onChange, role]
  );
  return (
    <div
      className={cn(
        "min-w-0 border-border/60 border-b py-2 last:border-b-0",
        "[&_.dialkit-color-control]:h-auto! [&_.dialkit-color-control]:min-h-10 [&_.dialkit-color-control]:rounded-none! [&_.dialkit-color-control]:bg-transparent! [&_.dialkit-color-control]:px-0! [&_.dialkit-color-control]:shadow-none!",
        "[&_.dialkit-color-label]:shrink! [&_.dialkit-color-label]:min-w-0 [&_.dialkit-color-label]:translate-y-0! [&_.dialkit-color-label]:break-words [&_.dialkit-color-label]:font-normal! [&_.dialkit-color-label]:text-foreground! [&_.dialkit-color-label]:text-sm!",
        "[&_.dialkit-color-inputs]:flex-none! [&_.dialkit-color-inputs]:gap-4!",
        "[&_.dialkit-color-value]:w-24! [&_.dialkit-color-value]:font-normal! [&_.dialkit-color-value]:text-muted-foreground! [&_.dialkit-color-value]:text-xs! [&_.dialkit-color-value]:tabular-nums",
        "[&_.dialkit-color-swatch]:relative [&_.dialkit-color-swatch]:size-7! [&_.dialkit-color-swatch]:basis-7! [&_.dialkit-color-swatch]:rounded-md! [&_.dialkit-color-swatch]:before:absolute [&_.dialkit-color-swatch]:before:-inset-1.5 [&_.dialkit-color-swatch]:before:content-['']"
      )}
    >
      <ColorControl
        label={role.charAt(0).toUpperCase() + role.slice(1)}
        onChange={changeColor}
        value={value ?? ""}
      />
    </div>
  );
}
