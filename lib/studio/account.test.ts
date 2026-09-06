import { Cause, Duration, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import type { SignInPoll, SignInStart } from "@/shared/account";
import {
  AccountError,
  accountError,
  awaitSignIn,
  isSignedOut,
  lastSeen,
  planWording,
  pollDelay,
  trialSpent,
} from "./account";

const START: SignInStart = {
  expiresIn: 1800,
  interval: 5,
  userCode: "ABCD-EFGH",
  verificationUri: "https://remocn.studio/device?user_code=ABCDEFGH",
};

const NOW = Date.parse("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function scripted(answers: readonly SignInPoll[]) {
  const slept: number[] = [];
  let index = 0;
  const poll = Effect.sync(() => {
    const answer = answers[index] ?? answers.at(-1);
    index += 1;
    if (answer === undefined) {
      throw new Error("polled past the script");
    }
    return answer;
  });
  const sleep = (delay: Duration.Duration) =>
    Effect.sync(() => {
      slept.push(Duration.toSeconds(delay));
    });
  return {
    poll,
    run: () => Effect.runSync(awaitSignIn(START, poll, sleep)),
    slept,
  };
}

describe("pollDelay", () => {
  it("waits the server's interval, plus five seconds per slow_down", () => {
    expect(Duration.toSeconds(pollDelay(5, 0))).toBe(5);
    expect(Duration.toSeconds(pollDelay(5, 2))).toBe(15);
  });

  it("never polls faster than once a second", () => {
    expect(Duration.toSeconds(pollDelay(0, 0))).toBe(1);
  });
});

describe("awaitSignIn", () => {
  it("sleeps before every poll and stops on the token", () => {
    const flow = scripted([
      { status: "pending" },
      { status: "pending" },
      { status: "signedIn" },
    ]);
    expect(flow.run()).toEqual({ status: "signedIn" });
    expect(flow.slept).toEqual([5, 5, 5]);
  });

  it("backs off by five seconds each time the server says slow down", () => {
    const flow = scripted([
      { status: "slowDown" },
      { status: "slowDown" },
      { status: "pending" },
      { status: "signedIn" },
    ]);
    flow.run();
    expect(flow.slept).toEqual([5, 10, 15, 15]);
  });

  it("reports an expired code and a denied one as outcomes, not failures", () => {
    expect(scripted([{ status: "expired" }]).run()).toEqual({
      status: "expired",
    });
    expect(scripted([{ status: "denied" }]).run()).toEqual({
      status: "denied",
    });
  });

  it("carries the devices back when the limit is hit", () => {
    const devices = [
      {
        id: "ses_1",
        lastSeenAt: "2026-09-06T09:00:00.000Z",
        name: "MacBook Pro",
        platform: "macos" as const,
      },
    ];
    expect(
      scripted([
        {
          devices,
          message: "Signed in on 2 devices already.",
          status: "deviceLimit",
        },
      ]).run()
    ).toEqual({
      devices,
      message: "Signed in on 2 devices already.",
      status: "deviceLimit",
    });
  });

  it("fails the flow when a poll fails", () => {
    const poll = Effect.fail(
      new AccountError({ kind: "offline", message: "offline" })
    );
    const exit = Effect.runSyncExit(
      awaitSignIn(START, poll, () => Effect.void)
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("accountError", () => {
  it("keeps the kind the core answered with", () => {
    const error = accountError({
      kind: "unauthorized",
      message: "Sign in first.",
    });
    expect(error.kind).toBe("unauthorized");
    expect(error.message).toBe("Sign in first.");
  });

  it("wraps anything else as a transport failure", () => {
    expect(accountError(new Error("no core")).kind).toBe("transport");
    expect(accountError("plain").message).toBe("plain");
  });
});

describe("isSignedOut", () => {
  it("is true only for the unauthorized kind", () => {
    const unauthorized = Cause.fail(
      new AccountError({ kind: "unauthorized", message: "" })
    );
    const offline = Cause.fail(
      new AccountError({ kind: "offline", message: "" })
    );
    expect(isSignedOut(unauthorized)).toBe(true);
    expect(isSignedOut(offline)).toBe(false);
    expect(isSignedOut(Cause.fail(new Error("x")))).toBe(false);
  });
});

describe("planWording", () => {
  it("counts a trial down in days", () => {
    const endsAt = new Date(NOW + 3 * DAY + 1000).toISOString();
    expect(
      planWording({ endsAt, kind: "trial", startedAt: null }, NOW)
    ).toMatchObject({
      name: "Pro trial",
      note: "4 days left",
    });
    expect(
      planWording(
        {
          endsAt: new Date(NOW + 1000).toISOString(),
          kind: "trial",
          startedAt: null,
        },
        NOW
      ).note
    ).toBe("1 day left");
  });

  it("names the ended trial on a free plan", () => {
    expect(
      planWording(
        { kind: "free", trialEndedAt: "2026-09-01T09:00:00.000Z" },
        NOW
      ).note
    ).toBe("Trial ended Sep 1");
    expect(planWording({ kind: "free", trialEndedAt: null }, NOW).note).toBe(
      "See what Pro adds"
    );
  });

  it("raises the alarm on a failed card", () => {
    expect(
      planWording(
        { accessUntil: "2026-09-09T09:00:00.000Z", kind: "grace" },
        NOW
      )
    ).toEqual({
      alarming: true,
      name: "Pro",
      note: "Card failed, access until Sep 9",
    });
  });
});

describe("trialSpent", () => {
  it("measures from the start the server gave", () => {
    const startedAt = new Date(NOW - 2 * DAY).toISOString();
    const endsAt = new Date(NOW + 6 * DAY).toISOString();
    expect(trialSpent({ endsAt, startedAt }, NOW)).toBeCloseTo(0.25);
  });

  it("assumes the standard seven days when the start is unknown", () => {
    const endsAt = new Date(NOW + 3.5 * DAY).toISOString();
    expect(trialSpent({ endsAt, startedAt: null }, NOW)).toBeCloseTo(0.5);
  });

  it("stays inside the bar", () => {
    const endsAt = new Date(NOW + 30 * DAY).toISOString();
    expect(trialSpent({ endsAt, startedAt: null }, NOW)).toBe(0);
    expect(trialSpent({ endsAt: "garbage", startedAt: null }, NOW)).toBe(1);
  });
});

describe("lastSeen", () => {
  it("reads as a relative time", () => {
    expect(lastSeen(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(
      "3 days ago"
    );
    expect(lastSeen(new Date(NOW - 5000).toISOString(), NOW)).toBe("just now");
    expect(lastSeen("garbage", NOW)).toBe("");
  });
});
