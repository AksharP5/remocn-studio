import { homedir } from "node:os";
import { join } from "node:path";
import { findExecutable, type LookupHost } from "../agent/cli";

export const COPILOT_ENV = "REMOCN_STUDIO_COPILOT";

const FALLBACK_DIRS = [
  join(homedir(), ".bun", "bin"),
  join(homedir(), ".npm-global", "bin"),
  join(homedir(), ".local", "bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

export function findCopilot(at?: LookupHost): string | null {
  return findExecutable(
    { env: COPILOT_ENV, fallbacks: FALLBACK_DIRS, name: "copilot" },
    at
  );
}
