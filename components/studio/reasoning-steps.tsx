"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReasoningLine } from "@/lib/studio/reasoning";
import { cn } from "@/lib/utils";
import { Thinking } from "./thinking";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function ReasoningSteps({
  label,
  lines,
  now,
  startedAt,
}: {
  label: string | null;
  lines: readonly ReasoningLine[];
  now: number;
  startedAt: number | null;
}) {
  const still = useReducedMotion() === true;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Thinking
        label={label}
        now={now}
        shimmer={!still}
        startedAt={startedAt}
      />
      {lines.length === 0 ? null : (
        <div
          aria-live="polite"
          className="flex max-h-[4.5rem] min-w-0 flex-col justify-end overflow-hidden ps-5.5 [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {lines.map((line) => (
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "line-clamp-2 text-muted-foreground text-xs leading-5",
                  line.kind === "step" && "text-foreground/70"
                )}
                exit={still ? { opacity: 0 } : { opacity: 0, y: -6 }}
                initial={still ? false : { opacity: 0, y: 6 }}
                key={line.id}
                layout={still ? false : "position"}
                transition={{ duration: still ? 0 : 0.22, ease: EASE_OUT }}
              >
                {line.text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
