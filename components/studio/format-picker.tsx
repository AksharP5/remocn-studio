"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/studio/formats";
import { cn } from "@/lib/utils";

// The ratio belongs to a video, not to a project — three TikToks and one
// full-size film is one project — so the same picker serves the project
// wizard's first video and every video created after it.
export function FormatPicker({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (id: string) => void;
  value: VideoFormat;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="font-medium text-sm leading-none" id={id}>
        Aspect ratio
      </span>
      <RadioGroup
        aria-labelledby={id}
        className="grid @lg:grid-cols-4 grid-cols-2 gap-2"
        onValueChange={onChange}
        value={value.id}
      >
        {VIDEO_FORMATS.map((format) => (
          <FormatCard format={format} key={format.id} />
        ))}
      </RadioGroup>
    </div>
  );
}

function FormatCard({ format }: { format: VideoFormat }) {
  return (
    <Label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center font-normal leading-normal transition-colors has-[:focus-visible]:border-ring has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
      <span className="sr-only">
        <RadioGroupItem value={format.id} />
      </span>

      <span className="flex h-9 w-full items-center justify-center">
        <span
          className={cn(
            "rounded-sm border-2 border-muted-foreground/60",
            format.width >= format.height ? "w-9" : "h-9"
          )}
          style={{ aspectRatio: `${format.width} / ${format.height}` }}
        />
      </span>

      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{format.label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {format.width}×{format.height}
        </span>
        <span className="text-balance text-muted-foreground text-xs">
          {format.note}
        </span>
      </span>
    </Label>
  );
}
