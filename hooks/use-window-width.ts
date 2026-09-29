"use client";

import { useSyncExternalStore } from "react";

const DEFAULT_WIDTH = 1440;

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function current() {
  return window.innerWidth;
}

function server() {
  return DEFAULT_WIDTH;
}

export function useWindowWidth(): number {
  return useSyncExternalStore(subscribe, current, server);
}
