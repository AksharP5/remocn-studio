import { z } from "zod";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Everything the welcome video says about a person. Dates travel as ISO
 * strings because these props cross a network boundary twice — into the Player
 * as JSON, and later into a render — and a Date would not survive either.
 */
export const welcomeEarlyMemberSchema = z.object({
  /** The full name on the account; the video greets its first word. */
  name: z.string(),
  memberNumber: z.number().int().positive(),
  /** When they joined the waitlist. */
  joinedAt: z.string(),
  /** When they bought Pro. */
  purchasedAt: z.string(),
  /** When the wait ended for everyone — what `daysWaited` counts up to. */
  launchedAt: z.string(),
  /** Null when the plan is paid but no longer renewing. */
  period: z.enum(["month", "year"]).nullable(),
});

export type WelcomeEarlyMemberProps = z.infer<typeof welcomeEarlyMemberSchema>;

/**
 * Defaults that stand on their own, so `remotion studio` opens the composition
 * with something to look at instead of a crash.
 */
export const welcomeEarlyMemberDefaults: WelcomeEarlyMemberProps = {
  name: "Alex Rivera",
  memberNumber: 128,
  joinedAt: "2026-07-08T00:00:00.000Z",
  purchasedAt: "2026-09-06T00:00:00.000Z",
  launchedAt: "2026-09-06T00:00:00.000Z",
  period: "year",
};

/**
 * The greeting takes the first word of the name. Anything that isn't a word —
 * an empty name, whitespace — falls back to something a person would answer
 * to, never to "there".
 */
export function firstWordOf(name: string) {
  return name.trim().split(/\s+/)[0] || "friend";
}

/** "July 8, 2026" — spelled out, because the video has room for it. */
export function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Whole days from joining the list to the day Pro arrived. */
export function daysWaited(joinedAt: string, launchedAt: string) {
  const days = Math.floor(
    (new Date(launchedAt).getTime() - new Date(joinedAt).getTime()) / DAY,
  );
  return Math.max(0, days);
}
