import { DotmSquare11 } from "@/components/ui/dotm-square-11";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { runningTime } from "@/lib/studio/time";

export function Thinking({
  label,
  now,
  startedAt,
}: {
  label: string | null;
  now: number;
  startedAt: number | null;
}) {
  return (
    <Marker className="min-w-0 items-baseline text-xs">
      <DotmSquare11
        animated
        ariaLabel=""
        className="shrink-0 self-center"
        colorPreset="grad-prism"
        dotSize={2}
        opacityBase={0.12}
        opacityMid={0.42}
        opacityPeak={1}
        pattern="full"
        size={14}
        speed={1.05}
      />
      <MarkerContent className="min-w-0 truncate" title={label ?? "Thinking…"}>
        {label ?? "Thinking…"}
      </MarkerContent>
      {startedAt === null ? null : (
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {runningTime(startedAt, now)}
        </span>
      )}
    </Marker>
  );
}
