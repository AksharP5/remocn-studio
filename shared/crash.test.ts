import { describe, expect, it } from "vitest";
import {
  CRASH_CONSENT_OFF,
  CRASH_CONSENT_ON,
  crashConsentOf,
  crashConsentValue,
  crashDecision,
  crashRelease,
  HOME_PLACEHOLDER,
  redactPaths,
  reportsFrom,
  scrub,
} from "@/shared/crash";

const HOME = "/Users/alice";

describe("consent", () => {
  it("is off until it is asked for", () => {
    expect(crashConsentOf(undefined)).toBe(false);
    expect(crashConsentOf(null)).toBe(false);
    expect(crashConsentOf("")).toBe(false);
    expect(crashConsentOf("true")).toBe(false);
  });

  it("reads the two words the settings store writes", () => {
    expect(crashConsentOf(CRASH_CONSENT_ON)).toBe(true);
    expect(crashConsentOf(CRASH_CONSENT_OFF)).toBe(false);
  });

  it("round-trips through the value that crosses a process boundary", () => {
    expect(crashConsentOf(crashConsentValue(true))).toBe(true);
    expect(crashConsentOf(crashConsentValue(false))).toBe(false);
  });
});

describe("release", () => {
  it("is the tag changeset mints", () => {
    expect(crashRelease("0.4.1")).toBe("v0.4.1");
  });

  it("does not double the prefix", () => {
    expect(crashRelease("v0.4.1")).toBe("v0.4.1");
  });
});

describe("environment", () => {
  it("reports from production only", () => {
    expect(reportsFrom("production")).toBe(true);
    expect(reportsFrom("development")).toBe(false);
    expect(reportsFrom(null)).toBe(false);
  });
});

describe("the decision", () => {
  const dsn = "https://key@example.invalid/1";

  it("starts when consent, environment and a DSN agree", () => {
    expect(
      crashDecision({ consent: true, dsn, environment: "production" })
    ).toEqual({ started: true });
  });

  it("puts consent first, so a refusal is never reported as anything else", () => {
    expect(
      crashDecision({ consent: false, dsn: null, environment: "development" })
    ).toEqual({ reason: "no-consent", started: false });
  });

  it("stops a development build even with consent", () => {
    expect(
      crashDecision({ consent: true, dsn, environment: "development" })
    ).toEqual({ reason: "development", started: false });
  });

  it("treats a missing DSN exactly as a withheld consent — nothing starts", () => {
    for (const value of [null, ""]) {
      expect(
        crashDecision({ consent: true, dsn: value, environment: "production" })
      ).toEqual({ reason: "no-dsn", started: false });
    }
  });
});

describe("redacting a path", () => {
  it("replaces the home it was told about", () => {
    expect(redactPaths(`${HOME}/Movies/intro.mp4`, HOME)).toBe(
      `${HOME_PLACEHOLDER}/Movies/intro.mp4`
    );
  });

  it("replaces a home it was not told about", () => {
    expect(redactPaths("/Users/bob/src/Root.tsx", null)).toBe(
      `${HOME_PLACEHOLDER}/src/Root.tsx`
    );
    expect(redactPaths("/home/bob/src/Root.tsx", null)).toBe(
      `${HOME_PLACEHOLDER}/src/Root.tsx`
    );
  });

  it("replaces a home that is not under /Users at all", () => {
    expect(redactPaths("/var/root/work/a.ts", "/var/root")).toBe(
      `${HOME_PLACEHOLDER}/work/a.ts`
    );
  });

  it("takes every occurrence in one string", () => {
    expect(
      redactPaths("copied /Users/bob/a.png to /Users/bob/b.png", null)
    ).toBe(`copied ${HOME_PLACEHOLDER}/a.png to ${HOME_PLACEHOLDER}/b.png`);
  });

  it("stops at the delimiters a message puts around a path", () => {
    expect(redactPaths("no such file: '/Users/bob/a.ts'", null)).toBe(
      `no such file: '${HOME_PLACEHOLDER}/a.ts'`
    );
    expect(redactPaths("at /Users/bob/a.ts:12:3", null)).toBe(
      `at ${HOME_PLACEHOLDER}/a.ts:12:3`
    );
  });

  it("leaves a path with no user segment alone", () => {
    expect(redactPaths("/usr/local/bin/bun", null)).toBe("/usr/local/bin/bun");
    expect(redactPaths("/Applications/remocn-studio.app", null)).toBe(
      "/Applications/remocn-studio.app"
    );
  });

  // The rule that is deliberately absent: a bare username is an ordinary
  // word, and replacing it everywhere would rewrite sentences that are not
  // paths at all.
  it("does not touch the username outside a path", () => {
    expect(redactPaths("alice asked for a slower intro", HOME)).toBe(
      "alice asked for a slower intro"
    );
  });
});

describe("scrubbing a payload", () => {
  it("rewrites strings at every depth, keys included", () => {
    const event = {
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename: "/Users/bob/src/videos/intro/index.tsx",
                  lineno: 4,
                },
              ],
            },
            value: "ENOENT: /Users/bob/src/a.ts",
          },
        ],
      },
      extra: { "/Users/bob/note": "at /Users/bob/note" },
    };

    expect(scrub(event, null)).toEqual({
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename: `${HOME_PLACEHOLDER}/src/videos/intro/index.tsx`,
                  lineno: 4,
                },
              ],
            },
            value: `ENOENT: ${HOME_PLACEHOLDER}/src/a.ts`,
          },
        ],
      },
      extra: { [`${HOME_PLACEHOLDER}/note`]: `at ${HOME_PLACEHOLDER}/note` },
    });
  });

  it("leaves non-strings as they are", () => {
    expect(scrub({ a: 1, b: null, c: true, d: undefined }, null)).toEqual({
      a: 1,
      b: null,
      c: true,
      d: undefined,
    });
  });

  it("does not recurse for ever", () => {
    const cyclic: Record<string, unknown> = { path: "/Users/bob/a.ts" };
    cyclic.self = cyclic;

    const cleaned = scrub(cyclic, null) as Record<string, unknown>;

    expect(cleaned.path).toBe(`${HOME_PLACEHOLDER}/a.ts`);
  });

  it("leaves a value that is not a plain object alone", () => {
    const when = new Date(0);

    expect(scrub({ when }, null)).toEqual({ when });
  });
});
