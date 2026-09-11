"use client";

import { useEffect, useRef } from "react";
import {
  type Command,
  findByShortcut,
  ownerOf,
  shortcutOf,
} from "@/lib/studio/command-registry";

export function useShortcuts(
  commands: readonly Command[],
  isMenuInstalled: boolean
): void {
  const latest = useRef(commands);
  latest.current = commands;
  const menu = useRef(isMenuInstalled);
  menu.current = isMenuInstalled;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const shortcut = shortcutOf(event);
      if (shortcut === null) {
        return;
      }
      const command = findByShortcut(latest.current, shortcut);
      if (command === null || command.enabled !== true) {
        return;
      }
      if (ownerOf(command.id) === "menu" && menu.current) {
        return;
      }
      event.preventDefault();
      command.run();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
