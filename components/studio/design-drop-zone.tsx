"use client";

import { Effect, Fiber } from "effect";
import { FileTextIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isInside } from "@/lib/studio/drop";
import { watchFileDrops } from "@/lib/studio/shell";
import { SettingsGroup } from "./settings-group";

export function DesignDropZone({
  filename,
  loading,
  onChoose,
  onDrop,
  onError,
}: {
  filename?: string;
  loading: boolean;
  onChoose: () => void;
  onDrop: (path: string) => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);
  const held = useRef({ loading, onDrop, onError });
  held.current = { loading, onDrop, onError };
  useEffect(() => {
    const inside = (position: { x: number; y: number } | null) =>
      !(held.current.loading || ref.current?.matches(":disabled")) &&
      isInside(ref.current?.getBoundingClientRect() ?? null, position);
    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchFileDrops({
            onDrop: ({ paths, position }) => {
              setOver(false);
              if (!inside(position)) {
                return;
              }
              if (
                paths.length !== 1 ||
                !paths[0].toLowerCase().endsWith(".md")
              ) {
                held.current.onError("Drop one Markdown (.md) file.");
                return;
              }
              held.current.onDrop(paths[0]);
            },
            onOver: (position) => setOver(inside(position)),
          });
          yield* Effect.never;
        })
      ).pipe(Effect.catch(() => Effect.void))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);
  const Icon = loading ? LoaderCircleIcon : FileTextIcon;
  return (
    <SettingsGroup
      description="Bring your colors, typography and design guidelines from DESIGN.md."
      title="Design reference"
    >
      <div className="py-4">
        <button
          aria-busy={loading}
          aria-label="Import DESIGN.md"
          className="group flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-border/80 border-dashed px-5 py-6 text-center transition-[background-color,border-color] duration-150 ease-out hover:border-foreground/30 hover:bg-background/50 focus-visible:outline-2 focus-visible:outline-foreground/60 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60 data-[over=true]:border-foreground/50 data-[over=true]:bg-background/70"
          data-over={over}
          disabled={loading}
          onClick={onChoose}
          ref={ref}
          type="button"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none flex size-10 items-center justify-center rounded-xl bg-background/80 text-muted-foreground ring-1 ring-border/50"
          >
            {over ? (
              <UploadIcon className="size-5" />
            ) : (
              <Icon
                className={
                  loading ? "size-5 motion-safe:animate-spin" : "size-5"
                }
              />
            )}
          </span>
          <span
            className="pointer-events-none grid max-w-full gap-1"
            role="status"
          >
            <span className="break-all font-medium text-sm">
              {dropTitle(loading, over, filename)}
            </span>
            <span className="text-muted-foreground text-xs">
              {filename
                ? "Drop a new file or click to replace"
                : "or click anywhere here to choose a file"}
            </span>
          </span>
          <span className="pointer-events-none text-muted-foreground/70 text-xs">
            Markdown · up to 256 KB
          </span>
        </button>
      </div>
    </SettingsGroup>
  );
}
function dropTitle(loading: boolean, over: boolean, filename?: string) {
  if (loading) {
    return "Reading design reference…";
  }
  if (over) {
    return "Drop DESIGN.md here";
  }
  return filename ?? "Drop your DESIGN.md here";
}
