// @vitest-environment node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The sidecar runs on bun, and bun is where the failure is: it raises the
// child's AbortError as an uncaught exception from inside `abort()`. Vitest
// runs under node, so the probe is run in the real runtime instead.
const PROBE = fileURLToPath(new URL("./abort.probe.ts", import.meta.url));

function probe(...flags: string[]) {
  return spawnSync("bun", ["run", PROBE, ...flags], {
    encoding: "utf8",
    timeout: 10_000,
  });
}

describe("abortQuietly", () => {
  // The control: bun reports the child's AbortError as an uncaught exception
  // — a stack trace on stderr on every cancel, and on a release build with
  // crash consent Sentry's uncaught-exception handler treats it as fatal.
  it("is needed: a plain abort on a spent child raises an uncaught AbortError", () => {
    const run = probe("--plain");

    expect(run.stderr).toContain("AbortError: The operation was aborted.");
    expect(JSON.parse(run.stdout)).toEqual({ aborted: true, alive: true });
  });

  it("aborts the child and raises nothing", () => {
    const run = probe();

    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual({ aborted: true, alive: true });
  });
});
