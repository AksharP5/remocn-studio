import { homedir } from "node:os";
import {
  close,
  eventFiltersIntegration,
  functionToStringIntegration,
  initWithoutDefaultIntegrations,
  linkedErrorsIntegration,
  onUncaughtExceptionIntegration,
  onUnhandledRejectionIntegration,
} from "@sentry/bun";
import { Effect } from "effect";
import {
  CRASH_CONSENT_ENV,
  type CrashDecision,
  crashConsentOf,
  crashDecision,
  crashRelease,
  scrub,
} from "@/shared/crash";
import {
  APP_ENVIRONMENT_ENV,
  APP_VERSION_ENV,
  type AppEnvironment,
} from "@/shared/ipc";

// The sidecar knows where home is, so the scrubber gets the exact prefix as
// well as its pattern rule. Read once: a process does not change its home.
const HOME = homedir();

let consented = false;
let started = false;

export function isReporting(): boolean {
  return started;
}

/**
 * Read as a *static* `process.env.X`, and it has to be: `bun build --env` only
 * substitutes that form, so a lookup through `SIDECAR_DSN_ENV` would compile
 * to a runtime read of a variable the release never sets. `stock.ts` reads the
 * Pexels key the same way and for the same reason.
 *
 * The build takes one glob for both — `--env` accepts exactly one pattern, and
 * silently drops the rest: a second `--env` flag replaces the first, and a
 * comma-separated list honours only its first entry. Both were measured.
 */
function bakedDsn(): string | null {
  const value = process.env.REMOCN_STUDIO_SENTRY_DSN;

  return value === undefined || value.length === 0 ? null : value;
}

function environmentOf(): AppEnvironment | null {
  const value = process.env[APP_ENVIRONMENT_ENV];

  if (value === "production" || value === "development") {
    return value;
  }

  // Run by hand, with no core to ask. The same direction the data directory
  // takes in that case: assume the developer's machine, not a release.
  return null;
}

/**
 * Applies a consent. Idempotent, so the boot path and the `crash.consent`
 * method are the same code and cannot drift.
 *
 * The SDK is never initialised without consent — not initialised-and-silent.
 * That is #268's rule, and it is why this starts the client rather than
 * flipping a flag on one that is always there.
 */
export function applyCrashConsent(enabled: boolean): CrashDecision {
  const dsn = bakedDsn();
  const environment = environmentOf();
  const version = process.env[APP_VERSION_ENV] ?? null;

  const decision = crashDecision({ consent: enabled, dsn, environment });

  consented = decision.started;

  if (decision.started && dsn !== null && environment !== null) {
    if (!started) {
      start({ dsn, environment, version });
      started = true;
    }
    return decision;
  }

  if (started) {
    started = false;
    // Zero, not the default: withdrawing consent must not be followed by a
    // pause while what was already captured is flushed out. Nothing awaits
    // it — `consented` is already false, so the answer changes nothing.
    close(0).catch(() => undefined);
  }

  return decision;
}

function start(input: {
  dsn: string;
  environment: AppEnvironment;
  version: string | null;
}) {
  // `initWithoutDefaultIntegrations`, and the list below is the whole reason.
  // The Bun SDK's default set carries three things this app must not send:
  // `contextLinesIntegration` attaches the source lines around every frame —
  // which is the contents of the person's project; `consoleIntegration` turns
  // every log line into a breadcrumb, and the sidecar logs what it is doing
  // with a turn; `nodeContextIntegration` and `modulesIntegration` describe
  // the machine and its dependency tree. What is kept is what makes a stack
  // readable, plus the two handlers that are the point of the exercise.
  initWithoutDefaultIntegrations({
    beforeBreadcrumb: () => null,
    beforeSend: (event) => (consented ? scrub(event, HOME) : null),
    dsn: input.dsn,
    environment: input.environment,
    // Off, and not for tidiness: `_init` in @sentry/bun fills `serverName`
    // from `os.hostname()` before anything else sees the options, and a
    // personal Mac's hostname is the owner's name. The client discards it
    // when this is false — which is the only thing that stops it.
    includeServerName: false,
    integrations: [
      eventFiltersIntegration(),
      functionToStringIntegration(),
      linkedErrorsIntegration(),
      onUncaughtExceptionIntegration(),
      onUnhandledRejectionIntegration(),
    ],
    maxBreadcrumbs: 0,
    release: input.version === null ? undefined : crashRelease(input.version),
    // Off, and it is not tidiness: a client report is Sentry's telemetry about
    // its own telemetry — "one event was discarded, reason before_send" — and
    // it is sent even when every event was dropped. Withdrawing consent left
    // the process still making one request to Sentry, which was measured with
    // `bun run crash:verify` and is the wrong answer for an app whose promise
    // is that nothing reaches a third party.
    sendClientReports: false,
    sendDefaultPii: false,
    // The sidecar is not a server and this SDK's tracing would instrument the
    // agent's own HTTP calls. Crashes only.
    skipOpenTelemetrySetup: true,
    tracesSampleRate: 0,
  });
}

/**
 * The boot half of the consent: what Rust read out of `settings.json` and
 * handed over at spawn. It exists so that a crash in the first seconds — long
 * before a webview has connected to say anything — is still reported when it
 * was consented to.
 *
 * Both re-execed children take this path too. `--preview-host` and
 * `--tools-host` are the same bundle with the same environment, so the
 * preview's compiler and the tool gateway are covered by the same call.
 */
export const startCrashReporting: Effect.Effect<void> = Effect.sync(() => {
  const decision = applyCrashConsent(
    crashConsentOf(process.env[CRASH_CONSENT_ENV])
  );

  // Straight to stderr rather than through `SidecarChannel`: this runs ahead
  // of whichever of the three entry points was chosen, and only one of them
  // has a channel. stderr is where the channel's own `log` writes anyway, so
  // the line lands in the same `sidecar.log` either way.
  process.stderr.write(
    decision.started
      ? "crash reports are on\n"
      : `crash reports are off (${decision.reason})\n`
  );
});
