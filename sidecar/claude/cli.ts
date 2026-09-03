import { homedir } from "node:os";
import { join } from "node:path";
import { findExecutable, type LookupHost } from "../agent/cli";

export const CLAUDE_ENV = "REMOCN_STUDIO_CLAUDE";

export const CLAUDE_FALLBACK_DIRS = [
  join(homedir(), ".local", "bin"),
  join(homedir(), ".claude", "local"),
  join(homedir(), ".bun", "bin"),
  join(homedir(), ".npm-global", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export const CLAUDE_LOOKUP = {
  env: CLAUDE_ENV,
  fallbacks: CLAUDE_FALLBACK_DIRS,
  name: "claude",
} as const;

export function findClaude(at?: LookupHost): string | null {
  return findExecutable(CLAUDE_LOOKUP, at);
}
