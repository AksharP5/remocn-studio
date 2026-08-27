// What the three processes agree on about crash reporting, and the one place
// a payload is cleaned before it leaves the machine.
//
// This module is deliberately dependency-free — no Effect, no SDK types. The
// webview, the sidecar and its two re-execed hosts all import it, and the
// scrubber has to be callable from inside a `beforeSend` that runs while a
// process is dying.

import type { AppEnvironment } from "./ipc";

/**
 * The consent the Rust core reads out of `settings.json` and hands to the
 * sidecar at spawn. Spelled the way the settings store spells it, so the value
 * that crosses the process boundary is the value on disk rather than a
 * translation of it.
 */
export const CRASH_CONSENT_ENV = "REMOCN_STUDIO_CRASH_REPORTS";

export const CRASH_CONSENT_ON = "enabled";
export const CRASH_CONSENT_OFF = "disabled";

/**
 * The DSN is a build-time constant, not a secret: Sentry's own model is that a
 * DSN is public — it can only write events into one project, and the ingest
 * endpoint accepts nothing else. Baked into the sidecar by `bun build --env`
 * and into the webview by Next, exactly as the Pexels key already is.
 *
 * **Absent is the normal case.** Until a Sentry project exists this is unset,
 * and every `startCrashReporting` in the app then answers `no-dsn` and
 * initialises nothing. That is the same shape as consent being withheld, on
 * purpose: there is exactly one way for the SDK to be absent.
 */
export const SIDECAR_DSN_ENV = "REMOCN_STUDIO_SENTRY_DSN";

/**
 * Consent is opt-in. The app's standing promise is that nothing reaches a
 * third party — the Google font was cut out of grab's stylesheet and its
 * telemetry turned off to keep it — so a crash reporter that defaulted to on
 * would be the first thing in the app to break that promise, and it would
 * break it before anyone was asked.
 */
export const CRASH_CONSENT_DEFAULT = false;

export function crashConsentOf(value: string | undefined | null): boolean {
  if (value === CRASH_CONSENT_ON) {
    return true;
  }
  if (value === CRASH_CONSENT_OFF) {
    return false;
  }
  return CRASH_CONSENT_DEFAULT;
}

export function crashConsentValue(enabled: boolean): string {
  return enabled ? CRASH_CONSENT_ON : CRASH_CONSENT_OFF;
}

/**
 * `v<version>` — the same string `changeset tag` mints and the same one the
 * GitHub release carries, so a stack frame resolves against the sourcemaps
 * uploaded for that tag without a second naming scheme to keep in step.
 */
export function crashRelease(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

/**
 * Development never reports. The same signal the updater reads
 * (`studio_build.environment`, itself `cfg!(debug_assertions)`): a build
 * running from a developer's own tree must not put its noise in the project
 * the released app reports into.
 */
export function reportsFrom(environment: AppEnvironment | null): boolean {
  return environment === "production";
}

/** Why nothing was started. Logged, never shown. */
export type CrashDecision =
  | { started: false; reason: "no-consent" | "no-dsn" | "development" }
  | { started: true };

export function crashDecision(input: {
  consent: boolean;
  dsn: string | null;
  environment: AppEnvironment | null;
}): CrashDecision {
  if (!input.consent) {
    return { reason: "no-consent", started: false };
  }
  if (!reportsFrom(input.environment)) {
    return { reason: "development", started: false };
  }
  if (input.dsn === null || input.dsn.length === 0) {
    return { reason: "no-dsn", started: false };
  }
  return { started: true };
}

// A path is the one piece of PII that is in *every* event: it is in each stack
// frame, each module name, each breadcrumb the SDK writes by itself. There is
// no way to opt out of carrying paths, so they are rewritten instead.
//
// Two rules, and both are conservative on purpose:
//
//   - the real home directory, when the process knows it, is replaced by
//     `<home>` — this is the exact one, and it catches a home that is not
//     under /Users at all;
//   - `/Users/<name>` and `/home/<name>` are replaced by `<home>` wherever
//     they appear, which catches the paths the *other* two processes and the
//     project's own tooling put into a message.
//
// What is deliberately *not* done is replacing the bare username on its own.
// A username is an ordinary word — "video", "studio", "max" — and a blanket
// replacement would mangle sentences that have nothing to do with a path,
// which is worse than leaving a name that the two rules above already strip
// from every path it appears in.
const HOME_ANCESTORS = /(?:\/Users|\/home)\/[^/\s'"`:;,)\]}]+/g;

export const HOME_PLACEHOLDER = "<home>";

const MAX_DEPTH = 12;

export function redactPaths(text: string, home: string | null): string {
  const withoutHome =
    home === null || home.length === 0
      ? text
      : text.split(home).join(HOME_PLACEHOLDER);

  return withoutHome.replace(HOME_ANCESTORS, HOME_PLACEHOLDER);
}

/**
 * Walks any JSON value — an event, an envelope item, a breadcrumb — and
 * rewrites every string in it, keys included. Sentry events are plain JSON by
 * the time `beforeSend` sees them, but the walk is depth-capped and
 * cycle-guarded anyway: this runs inside a crash handler, where a stack
 * overflow would replace the report with nothing at all.
 */
export function scrub<T>(value: T, home: string | null): T {
  return walk(value, home, 0, new WeakSet()) as T;
}

function walk(
  value: unknown,
  home: string | null,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === "string") {
    return redactPaths(value, home);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (depth >= MAX_DEPTH || seen.has(value)) {
    return value;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => walk(entry, home, depth + 1, seen));
  }

  // Anything that is not a plain object — a Date, an Error, a class instance —
  // is left alone rather than being flattened into one.
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    cleaned[redactPaths(key, home)] = walk(entry, home, depth + 1, seen);
  }
  return cleaned;
}
