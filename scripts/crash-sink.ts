/**
 * Measures what crash reporting actually sends, without a Sentry account.
 *
 * A DSN is only a URL, so this stands a local HTTP server in Sentry's place
 * and points a real `@sentry/bun` client at it. That answers the two questions
 * an account would otherwise be needed for — *does an event leave this
 * process at all*, and *what is in it* — and it answers the second one better
 * than the Sentry UI would, because the raw envelope is right here to grep.
 *
 * What it cannot answer: whether a minified frame symbolicates against an
 * uploaded sourcemap, and whether the three processes group under one release.
 * Both are server-side and are the last checkbox of REM-268.
 *
 *     bun run crash:verify
 *
 * `--probe` re-execs this same file as the process under test, the way
 * `sidecar/index.ts` re-execs itself for the preview and tool hosts.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { CRASH_CONSENT_ENV } from "@/shared/crash";
import { APP_ENVIRONMENT_ENV, APP_VERSION_ENV } from "@/shared/ipc";

const PROBE_FLAG = "--probe";
// What the `crash.consent` method does mid-process, exercised in the probe.
const REVOKE_FLAG = "--revoke";
const GRANT_FLAG = "--grant";
const DSN_ENV = "REMOCN_STUDIO_SENTRY_DSN";
const SETTLE_MS = 1500;

// A path under the real home, and a sentence that is not a path. The first
// must come back rewritten; the second must come back untouched, because a
// scrubber that eats ordinary words is a scrubber nobody can read the reports
// of afterwards.
const SECRET_PATH = `${homedir()}/Projects/nda-client/src/videos/intro/index.tsx`;
const ORDINARY_WORDS = "the user asked for a slower intro";

interface Scenario {
  consent: string;
  environment: string;
  expected: number;
  /** A `crash.consent` call after boot, the way the Settings switch arrives. */
  flip?: typeof GRANT_FLAG | typeof REVOKE_FLAG;
  name: string;
  withDsn: boolean;
}

const SCENARIOS: readonly Scenario[] = [
  {
    consent: "enabled",
    environment: "production",
    expected: 1,
    name: "consent given, released build",
    withDsn: true,
  },
  {
    consent: "disabled",
    environment: "production",
    expected: 0,
    name: "consent withheld",
    withDsn: true,
  },
  {
    consent: "enabled",
    environment: "development",
    expected: 0,
    name: "development build",
    withDsn: true,
  },
  {
    consent: "enabled",
    environment: "production",
    expected: 0,
    name: "no DSN in the build",
    withDsn: false,
  },
  {
    consent: "",
    environment: "production",
    expected: 0,
    name: "never answered",
    withDsn: true,
  },
  {
    consent: "enabled",
    environment: "production",
    expected: 0,
    flip: REVOKE_FLAG,
    name: "consent withdrawn while running",
    withDsn: true,
  },
  {
    consent: "disabled",
    environment: "production",
    expected: 1,
    flip: GRANT_FLAG,
    name: "consent given while running",
    withDsn: true,
  },
];

if (process.argv.includes(PROBE_FLAG)) {
  await probe();
} else {
  await verify();
}

/**
 * The process under test. It starts reporting exactly as the sidecar does —
 * through `startCrashReporting`, off the same environment variables the Rust
 * core sets — and then dies of an uncaught exception, which is the failure
 * this whole feature exists to catch.
 */
async function probe(): Promise<void> {
  const { applyCrashConsent, startCrashReporting } = await import(
    "@/sidecar/crash"
  );
  const { Effect } = await import("effect");

  Effect.runSync(startCrashReporting);

  if (process.argv.includes(REVOKE_FLAG)) {
    applyCrashConsent(false);
  }
  if (process.argv.includes(GRANT_FLAG)) {
    applyCrashConsent(true);
  }

  setTimeout(() => {
    throw new Error(`could not read ${SECRET_PATH} — ${ORDINARY_WORDS}`);
  }, 0);
}

async function verify(): Promise<void> {
  const envelopes: string[] = [];

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      envelopes.push(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });

  const port = await listen(server);
  const dsn = `http://0123456789abcdef0123456789abcdef@127.0.0.1:${port}/1`;
  let failures = 0;

  for (const scenario of SCENARIOS) {
    envelopes.length = 0;

    // biome-ignore lint/performance/noAwaitInLoops: one sink and one counter — two probes in flight could not be told apart, and the probe dies of its exception, so the send is still going after it exits
    await run(scenario, dsn);
    await settle();

    const got = envelopes.length;
    const ok = got === scenario.expected;
    failures += ok ? 0 : 1;

    process.stdout.write(
      `${ok ? "  ok  " : " FAIL "} ${scenario.name}: ${got} envelope(s), expected ${scenario.expected}\n`
    );

    if (ok && got > 0) {
      failures += inspect(envelopes.join("\n"));
    }
  }

  server.close();

  process.stdout.write(
    failures === 0
      ? "\nevery scenario behaved as designed\n"
      : `\n${failures} check(s) failed\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(
        typeof address === "object" && address !== null ? address.port : 0
      );
    });
  });
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SETTLE_MS);
  });
}

function run(scenario: Scenario, dsn: string): Promise<void> {
  const child = spawn(
    "bun",
    [
      "run",
      fileURLToPath(import.meta.url),
      PROBE_FLAG,
      ...(scenario.flip === undefined ? [] : [scenario.flip]),
    ],
    {
      env: {
        ...process.env,
        [APP_ENVIRONMENT_ENV]: scenario.environment,
        [APP_VERSION_ENV]: "0.4.1",
        [CRASH_CONSENT_ENV]: scenario.consent,
        // Set on the *build*, not at runtime, in the real app — `bun build
        // --env` inlines it. Here the probe runs from source, so the same
        // static read picks it out of the environment.
        [DSN_ENV]: scenario.withDsn ? dsn : "",
      },
      stdio: "ignore",
    }
  );

  return new Promise((resolve) => {
    child.on("close", () => resolve());
  });
}

/** What must and must not be in a payload that leaves the machine. */
function inspect(body: string): number {
  const home = homedir();
  const checks: readonly { ok: boolean; what: string }[] = [
    {
      ok: !body.includes(home),
      what: `the home directory (${home}) is not in the payload`,
    },
    {
      ok: body.includes("<home>"),
      what: "the path was rewritten, not dropped",
    },
    {
      ok: body.includes(ORDINARY_WORDS),
      what: "ordinary words in the message survived",
    },
    { ok: !body.includes("server_name"), what: "no hostname is reported" },
    {
      ok: !body.includes('"breadcrumbs"'),
      what: "no breadcrumb trail is attached",
    },
    {
      ok: !(body.includes("pre_context") || body.includes("context_line")),
      what: "no source code from the project is attached",
    },
  ];

  let failed = 0;
  for (const check of checks) {
    failed += check.ok ? 0 : 1;
    process.stdout.write(`    ${check.ok ? "ok  " : "FAIL"} ${check.what}\n`);
  }
  return failed;
}
