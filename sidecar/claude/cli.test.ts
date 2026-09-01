import { describe, expect, it } from "vitest";
import { findExecutable } from "../agent/cli";
import { CLAUDE_ENV, CLAUDE_LOOKUP, findClaude } from "./cli";

function hostWith(
  present: readonly string[],
  env: Record<string, string | undefined>
) {
  return { env, exists: (path: string) => present.includes(path) };
}

describe("findClaude", () => {
  it("takes the override first, and does not fall through when it is wrong", () => {
    const at = hostWith(["/usr/local/bin/claude"], {
      [CLAUDE_ENV]: "/nowhere/claude",
      PATH: "/usr/local/bin",
    });

    expect(findClaude(at)).toBeNull();
  });

  it("prefers PATH over the fallback list", () => {
    const at = hostWith(["/opt/homebrew/bin/claude", "/custom/claude"], {
      PATH: "/custom",
    });

    expect(findClaude(at)).toBe("/custom/claude");
  });

  it("reaches the native installer's target with the minimal PATH a GUI app gets", () => {
    const [local] = CLAUDE_LOOKUP.fallbacks;
    const at = hostWith([`${local}/claude`], { PATH: "/usr/bin:/bin" });

    expect(findClaude(at)).toBe(`${local}/claude`);
    expect(local.endsWith("/.local/bin")).toBe(true);
  });

  it("answers null on a clean machine", () => {
    expect(findClaude(hostWith([], { PATH: "/usr/bin" }))).toBeNull();
  });

  it("ignores empty PATH entries", () => {
    const at = hostWith(["/x/claude"], { PATH: "::/x:" });
    expect(findExecutable(CLAUDE_LOOKUP, at)).toBe("/x/claude");
  });
});
