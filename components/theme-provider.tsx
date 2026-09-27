"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useAppIcon } from "@/hooks/use-app-icon";
import { useWindowBackground } from "@/hooks/use-window-background";

function AppIconTheme() {
  const { resolvedTheme } = useTheme();
  useAppIcon(resolvedTheme);
  useWindowBackground(resolvedTheme);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Dark stays the default — the editor chrome is designed against the
      // obsidian palette — but the choice now belongs to Settings, System
      // included. next-themes persists it under its own key.
      defaultTheme="dark"
      disableTransitionOnChange
      enableSystem
    >
      <AppIconTheme />
      {children}
    </NextThemesProvider>
  );
}
