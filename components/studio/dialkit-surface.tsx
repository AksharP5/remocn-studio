"use client";

import "dialkit/styles.css";
import { MotionConfig } from "motion/react";
import { useTheme } from "next-themes";

export function DialKitSurface({
  children,
  targetId,
}: {
  children: React.ReactNode;
  targetId: string;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="dialkit-root remocn-dialkit flex min-h-0 flex-1 flex-col"
        data-mode="inline"
        data-target-id={targetId}
        data-theme={theme}
      >
        {children}
      </div>
    </MotionConfig>
  );
}
