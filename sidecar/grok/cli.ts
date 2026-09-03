import { homedir } from "node:os";
import { join } from "node:path";
import { findExecutable, type LookupHost } from "../agent/cli";

export const GROK_ENV = "REMOCN_STUDIO_GROK";

const FALLBACK_DIRS = [
  join(homedir(), ".grok", "bin"),
  join(homedir(), ".local", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export function findGrok(at?: LookupHost): string | null {
  return findExecutable(
    { env: GROK_ENV, fallbacks: FALLBACK_DIRS, name: "grok" },
    at
  );
}
