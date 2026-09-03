"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentProvider } from "@/shared/providers";

export const SETTINGS_SECTIONS = [
  "appearance",
  "behavior",
  "stock",
  "updates",
  "accounts",
  "feedback",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    typeof value === "string" &&
    (SETTINGS_SECTIONS as readonly string[]).includes(value)
  );
}

export interface SettingsDialog {
  isOpen: boolean;
  open: () => void;
  openAccounts: (provider: AgentProvider) => void;
  provider: AgentProvider | null;
  section: SettingsSection;
  setOpen: (open: boolean) => void;
  setSection: (section: SettingsSection) => void;
}

// Cmd+, is the standard macOS settings shortcut. The listener lives here, not
// in the pane, so the dialog opens even while the sidebar is hidden.
export function useSettingsDialog(): SettingsDialog {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [provider, setProvider] = useState<AgentProvider | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const openAccounts = useCallback((target: AgentProvider) => {
    setSection("accounts");
    setProvider(target);
    setIsOpen(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setIsOpen(next);
    if (!next) {
      setProvider(null);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return useMemo(
    () => ({
      isOpen,
      open,
      openAccounts,
      provider,
      section,
      setOpen,
      setSection,
    }),
    [isOpen, open, openAccounts, provider, section, setOpen]
  );
}
