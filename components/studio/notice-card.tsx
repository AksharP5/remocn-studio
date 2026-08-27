import type React from "react";
import { cn } from "@/lib/utils";

export function AboveComposer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mb-2 shrink-0 px-4 pt-1">
      <div className={cn("mx-auto w-full max-w-2xl", className)}>
        {children}
      </div>
    </div>
  );
}

export function NoticeCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-dashed px-3 py-2.5",
        className
      )}
      data-slot="notice-card"
      {...props}
    />
  );
}
